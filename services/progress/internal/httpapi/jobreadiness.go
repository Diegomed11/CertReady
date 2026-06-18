package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/httpx"
	"github.com/certready/certready/services/progress/internal/puestos"
)

// jobReadiness estima la preparación del usuario para un puesto combinando tres
// señales operativas, cada una en [0,1]: exámenes (preparación por certificación,
// vía el servicio exams), código (problemas resueltos por área, vía judge) y Q&A
// (autoevaluación por área, local). Los pesos del catálogo se renormalizan sobre
// las señales con datos. Reemplaza al antiguo DSS por usuario (ClickHouse) por un
// cálculo en vivo. Returns 404 si el puesto no existe; 200 siempre que exista (las
// señales sin datos se marcan y no hunden el resultado).
func (a *API) jobReadiness(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}
	slug := strings.TrimSpace(r.URL.Query().Get("puesto"))
	p, ok := puestos.Por(slug)
	if !ok {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "puesto no encontrado")
		return
	}

	ctx := r.Context()
	token := r.Header.Get("Authorization") // se reenvía a exams/judge

	// Señal de exámenes: promedio de la preparación sobre las certificaciones del puesto.
	var exScore *float64
	exCobertura := 0
	if a.examsBaseURL != "" {
		suma, n := 0.0, 0
		for _, cert := range p.Senales.Examenes.Certificaciones {
			if frac, ok := a.readinessCert(ctx, token, cert); ok {
				suma += frac
				n++
			}
		}
		if n > 0 {
			v := suma / float64(n)
			exScore = &v
			exCobertura = n
		}
	}

	// Señal de código: problemas resueltos / intentados en las áreas del puesto.
	var coScore *float64
	coCobertura, coResueltos := 0, 0
	if a.judgeBaseURL != "" {
		if problemas, resueltos, ok := a.codeSummary(ctx, token, p.Senales.Codigo.Areas); ok && problemas > 0 {
			v := float64(resueltos) / float64(problemas)
			coScore = &v
			coCobertura = problemas
			coResueltos = resueltos
		}
	}

	// Señal de Q&A: autoevaluación promedio en las áreas del puesto (local).
	var qaScore *float64
	qaCobertura := 0
	if cob, sc, err := a.store.ResumenQAPorArea(ctx, ident.Subject, p.Senales.Qa.Areas); err != nil {
		a.errorInterno(w, r, "resumen Q&A por área", err)
		return
	} else if cob > 0 {
		qaScore = &sc
		qaCobertura = cob
	}

	combinado := combinar([]componente{
		{p.Senales.Examenes.Peso, exScore},
		{p.Senales.Codigo.Peso, coScore},
		{p.Senales.Qa.Peso, qaScore},
	})

	senales := []senalPreparacion{
		{
			Clave: "examenes", Etiqueta: "Exámenes", ScorePct: pctPtr(exScore),
			Peso: p.Senales.Examenes.Peso, Cobertura: exCobertura,
			Detalle: detalleExamenes(exCobertura),
		},
		{
			Clave: "codigo", Etiqueta: "Código", ScorePct: pctPtr(coScore),
			Peso: p.Senales.Codigo.Peso, Cobertura: coCobertura,
			Detalle: detalleCodigo(coCobertura, coResueltos),
		},
		{
			Clave: "qa", Etiqueta: "Entrevista (Q&A)", ScorePct: pctPtr(qaScore),
			Peso: p.Senales.Qa.Peso, Cobertura: qaCobertura,
			Detalle: detalleQA(qaCobertura),
		},
	}

	httpx.WriteJSON(w, http.StatusOK, jobReadinessResponse{
		UsuarioID:    ident.Subject,
		Puesto:       p.Slug,
		Nombre:       p.Nombre,
		ReadinessPct: pctPtr(combinado),
		Nivel:        nivelLabel(combinado),
		Senales:      senales,
		Enfoque:      enfoque(senales),
	})
}

type senalPreparacion struct {
	Clave     string   `json:"clave"`
	Etiqueta  string   `json:"etiqueta"`
	ScorePct  *float64 `json:"score_pct"`
	Peso      float64  `json:"peso"`
	Cobertura int      `json:"cobertura"`
	Detalle   string   `json:"detalle"`
}

type jobReadinessResponse struct {
	UsuarioID    string             `json:"usuario_id"`
	Puesto       string             `json:"puesto"`
	Nombre       string             `json:"nombre"`
	ReadinessPct *float64           `json:"readiness_pct"`
	Nivel        string             `json:"nivel"`
	Senales      []senalPreparacion `json:"senales"`
	Enfoque      *string            `json:"enfoque"`
}

type componente struct {
	peso  float64
	score *float64
}

// combinar funde señales (peso, score) en una readiness en [0,1], renormalizando
// los pesos sobre las señales con datos. Returns nil si ninguna tiene datos.
func combinar(cs []componente) *float64 {
	total, suma := 0.0, 0.0
	hay := false
	for _, c := range cs {
		if c.score != nil && c.peso > 0 {
			total += c.peso
			suma += c.peso * (*c.score)
			hay = true
		}
	}
	if !hay || total <= 0 {
		return nil
	}
	v := suma / total
	return &v
}

// nivelLabel etiqueta una readiness [0,1] (o "Sin datos" si es nil).
func nivelLabel(score *float64) string {
	if score == nil {
		return "Sin datos"
	}
	switch s := *score; {
	case s < 0.4:
		return "Inicial"
	case s < 0.6:
		return "En progreso"
	case s < 0.8:
		return "Sólido"
	default:
		return "Listo"
	}
}

// enfoque devuelve la etiqueta de la señal (con datos) de menor score: dónde
// conviene mejorar. nil si ninguna señal tiene datos.
func enfoque(senales []senalPreparacion) *string {
	peor := -1
	for i := range senales {
		if senales[i].ScorePct == nil {
			continue
		}
		if peor == -1 || *senales[i].ScorePct < *senales[peor].ScorePct {
			peor = i
		}
	}
	if peor == -1 {
		return nil
	}
	return &senales[peor].Etiqueta
}

// pctPtr pasa una fracción [0,1] (o nil) a porcentaje [0,100] con un decimal.
func pctPtr(frac *float64) *float64 {
	if frac == nil {
		return nil
	}
	v := math.Round(*frac*1000) / 10.0
	return &v
}

func detalleExamenes(cobertura int) string {
	if cobertura > 0 {
		return fmt.Sprintf("%d certificación(es) con intentos", cobertura)
	}
	return "sin intentos de examen"
}

func detalleCodigo(problemas, resueltos int) string {
	if problemas > 0 {
		return fmt.Sprintf("%d/%d problemas resueltos", resueltos, problemas)
	}
	return "sin envíos de código"
}

func detalleQA(cobertura int) string {
	if cobertura > 0 {
		return fmt.Sprintf("%d preguntas autoevaluadas", cobertura)
	}
	return "sin autoevaluaciones"
}

// readinessCert consulta al servicio exams la preparación del usuario en una
// certificación. Returns (fracción [0,1], true) si responde 200; (0, false) si no
// hay datos (404) o el servicio falla (degradación elegante).
func (a *API) readinessCert(ctx context.Context, token, cert string) (float64, bool) {
	var body struct {
		ReadinessPct float64 `json:"readiness_pct"`
	}
	u := a.examsBaseURL + "/v1/me/readiness?certificacion=" + url.QueryEscape(cert)
	code, err := a.getJSON(ctx, token, u, &body)
	if err != nil || code != http.StatusOK {
		return 0, false
	}
	return body.ReadinessPct / 100.0, true
}

// codeSummary consulta al servicio judge los problemas intentados/resueltos del
// usuario en las áreas dadas. Returns (problemas, resueltos, true) si responde 200.
func (a *API) codeSummary(ctx context.Context, token string, areas []string) (problemas, resueltos int, ok bool) {
	if len(areas) == 0 {
		return 0, 0, false
	}
	var body struct {
		Problemas int `json:"problemas"`
		Resueltos int `json:"resueltos"`
	}
	u := a.judgeBaseURL + "/v1/me/code/summary?areas=" + url.QueryEscape(strings.Join(areas, ","))
	code, err := a.getJSON(ctx, token, u, &body)
	if err != nil || code != http.StatusOK {
		return 0, 0, false
	}
	return body.Problemas, body.Resueltos, true
}

// getJSON hace un GET a otro servicio reenviando el token del usuario y decodifica
// el cuerpo en out si la respuesta es 200. Returns el código HTTP y el error de red.
func (a *API) getJSON(ctx context.Context, token, rawURL string, out any) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return 0, err
	}
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	resp, err := a.http.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK && out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			return resp.StatusCode, err
		}
	}
	return resp.StatusCode, nil
}
