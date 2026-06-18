package httpapi

import (
	"math"
	"net/http"
	"strings"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/httpx"
)

// Estos handlers sustituyen a los antiguos endpoints por-usuario del DSS
// (/v1/analytics, /v1/readiness sobre ClickHouse): la analítica del estudiante es
// OPERATIVA (tiempo real, desde Postgres), no analítica por lotes. El JSON de
// respuesta replica el del DSS para que web y móvil no cambien de contrato.

type temaAcierto struct {
	Tema     string  `json:"tema"`
	Aciertos int     `json:"aciertos"`
	Total    int     `json:"total"`
	Pct      float64 `json:"pct"`
}

type puntoTendencia struct {
	Fecha    string  `json:"fecha"`
	Pct      float64 `json:"pct"`
	Intentos int     `json:"intentos"`
}

type analiticaResponse struct {
	Certificacion string           `json:"certificacion"`
	Total         int              `json:"total"`
	Aciertos      int              `json:"aciertos"`
	Pct           float64          `json:"pct"`
	PorTema       []temaAcierto    `json:"por_tema"`
	Tendencia     []puntoTendencia `json:"tendencia"`
}

type celdaDominio struct {
	Tema       string  `json:"tema"`
	Dificultad string  `json:"dificultad"`
	DominioPct float64 `json:"dominio_pct"`
	Intentos   int     `json:"intentos"`
}

type siguienteAccion struct {
	Tema       string `json:"tema"`
	Dificultad string `json:"dificultad"`
	Motivo     string `json:"motivo"`
}

type readinessResponse struct {
	UsuarioID           string           `json:"usuario_id"`
	Certificacion       string           `json:"certificacion"`
	ReadinessPct        float64          `json:"readiness_pct"`
	ProbabilidadAprobar float64          `json:"probabilidad_aprobar"`
	HabilidadTheta      float64          `json:"habilidad_theta"`
	PorCelda            []celdaDominio   `json:"por_celda"`
	SiguienteAccion     *siguienteAccion `json:"siguiente_accion"`
}

// pct1 devuelve el porcentaje a/n en [0,100] con un decimal (0 si n == 0).
func pct1(a, n int) float64 {
	if n == 0 {
		return 0
	}
	return math.Round(1000.0*float64(a)/float64(n)) / 10.0
}

// certParam lee y valida el parámetro de certificación (query).
func certParam(w http.ResponseWriter, r *http.Request) (string, bool) {
	cert := strings.TrimSpace(r.URL.Query().Get("certificacion"))
	if cert == "" {
		httpx.WriteError(w, http.StatusBadRequest, "parametros_invalidos", "certificacion es requerida")
		return "", false
	}
	return cert, true
}

// analitica devuelve el acierto por tema y la tendencia diaria del usuario en una
// certificación (para los dashboards). Sin intentos: listas vacías (200).
func (a *API) analitica(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}
	cert, ok := certParam(w, r)
	if !ok {
		return
	}

	celdas, err := a.sesiones.AgregadoPorCelda(r.Context(), ident.Subject, cert)
	if err != nil {
		a.errorInterno(w, r, "agregado por celda", err)
		return
	}
	serie, err := a.sesiones.AgregadoPorFecha(r.Context(), ident.Subject, cert)
	if err != nil {
		a.errorInterno(w, r, "agregado por fecha", err)
		return
	}

	// Agregamos celdas (tema, dificultad) a nivel de tema, preservando el orden.
	idx := make(map[string]int, len(celdas))
	porTema := make([]temaAcierto, 0, len(celdas))
	totA, totN := 0, 0
	for _, c := range celdas {
		i, exists := idx[c.Tema]
		if !exists {
			i = len(porTema)
			idx[c.Tema] = i
			porTema = append(porTema, temaAcierto{Tema: c.Tema})
		}
		porTema[i].Aciertos += c.Aciertos
		porTema[i].Total += c.Total
		totA += c.Aciertos
		totN += c.Total
	}
	for i := range porTema {
		porTema[i].Pct = pct1(porTema[i].Aciertos, porTema[i].Total)
	}

	tendencia := make([]puntoTendencia, 0, len(serie))
	for _, p := range serie {
		tendencia = append(tendencia, puntoTendencia{Fecha: p.Fecha, Pct: pct1(p.Aciertos, p.Total), Intentos: p.Total})
	}

	httpx.WriteJSON(w, http.StatusOK, analiticaResponse{
		Certificacion: cert,
		Total:         totN,
		Aciertos:      totA,
		Pct:           pct1(totA, totN),
		PorTema:       porTema,
		Tendencia:     tendencia,
	})
}

// readiness estima la preparación operativa del usuario en una certificación: el
// acierto global, el dominio por celda y la siguiente acción (la celda con menor
// acierto). A diferencia del DSS (IRT por lotes), es una métrica directa y fresca.
// Returns 404 si el usuario no tiene intentos en la certificación.
func (a *API) readiness(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}
	cert, ok := certParam(w, r)
	if !ok {
		return
	}

	celdas, err := a.sesiones.AgregadoPorCelda(r.Context(), ident.Subject, cert)
	if err != nil {
		a.errorInterno(w, r, "agregado por celda", err)
		return
	}

	totA, totN := 0, 0
	porCelda := make([]celdaDominio, 0, len(celdas))
	for _, c := range celdas {
		porCelda = append(porCelda, celdaDominio{
			Tema: c.Tema, Dificultad: c.Dificultad,
			DominioPct: pct1(c.Aciertos, c.Total), Intentos: c.Total,
		})
		totA += c.Aciertos
		totN += c.Total
	}
	if totN == 0 {
		httpx.WriteError(w, http.StatusNotFound, "sin_datos", "sin intentos suficientes para la certificación")
		return
	}

	// Siguiente acción: la celda con menor dominio (desempate: más intentos).
	peor := -1
	for i := range porCelda {
		if porCelda[i].Intentos == 0 {
			continue
		}
		if peor == -1 ||
			porCelda[i].DominioPct < porCelda[peor].DominioPct ||
			(porCelda[i].DominioPct == porCelda[peor].DominioPct && porCelda[i].Intentos > porCelda[peor].Intentos) {
			peor = i
		}
	}
	var accion *siguienteAccion
	if peor != -1 {
		accion = &siguienteAccion{
			Tema: porCelda[peor].Tema, Dificultad: porCelda[peor].Dificultad,
			Motivo: "es el tema con menor acierto; reforzarlo sube más tu preparación",
		}
	}

	readinessPct := pct1(totA, totN)
	httpx.WriteJSON(w, http.StatusOK, readinessResponse{
		UsuarioID:           ident.Subject,
		Certificacion:       cert,
		ReadinessPct:        readinessPct,
		ProbabilidadAprobar: readinessPct / 100.0,
		HabilidadTheta:      0,
		PorCelda:            porCelda,
		SiguienteAccion:     accion,
	})
}
