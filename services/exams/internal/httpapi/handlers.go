package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/httpx"

	"github.com/certready/certready/services/exams/internal/exams"
	"github.com/certready/certready/services/exams/internal/store"
)

const (
	defaultLimit  = 20
	maxLimit      = 100
	maxPreguntas  = 50
	minPreguntas  = 1
	modoSimulacro = "simulacro"
	modoPractica  = "practica"
)

// crearSesion inicia un simulacro: muestrea preguntas del banco, crea la sesión
// y devuelve las preguntas en su forma pública (sin respuestas correctas).
func (a *API) crearSesion(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	var in exams.CrearSesion
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}
	if in.Certificacion == "" {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", "certificacion: requerida")
		return
	}
	modo := in.Modo
	if modo == "" {
		modo = modoSimulacro
	}
	if modo != modoSimulacro && modo != modoPractica {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", "modo: simulacro | practica")
		return
	}
	n := in.NumPreguntas
	if n < minPreguntas {
		n = a.numPorDefecto
	}
	if n > maxPreguntas {
		n = maxPreguntas
	}

	preguntas, err := a.preguntas.Muestrear(r.Context(), in.Certificacion, in.Tema, n)
	if err != nil {
		a.errorInterno(w, r, "muestrear preguntas", err)
		return
	}
	if len(preguntas) == 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "sin_preguntas",
			"no hay preguntas disponibles para esa certificación")
		return
	}

	refs := make([]string, len(preguntas))
	publicas := make([]exams.PreguntaPublica, len(preguntas))
	for i, p := range preguntas {
		refs[i] = p.ID
		publicas[i] = exams.Publica(p)
	}

	ses, err := a.sesiones.CrearSesion(r.Context(), ident.Subject, in.Certificacion, modo, refs)
	if err != nil {
		a.errorInterno(w, r, "crear sesión", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, exams.SesionConPreguntas{Sesion: ses, Preguntas: publicas})
}

// enviar califica las respuestas, registra los intentos y cierra la sesión.
func (a *API) enviar(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	var in exams.EnviarRespuestas
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}

	id := r.PathValue("id")
	ses, refs, err := a.sesiones.ObtenerSesion(r.Context(), ident.Subject, id)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "sesión no encontrada")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "obtener sesión", err)
		return
	}
	if ses.Estado != "en_curso" {
		httpx.WriteError(w, http.StatusConflict, "ya_finalizada", "la sesión ya fue entregada")
		return
	}

	preguntas, err := a.preguntas.PorRefs(r.Context(), refs)
	if err != nil {
		a.errorInterno(w, r, "cargar preguntas", err)
		return
	}

	// Solo se consideran respuestas de preguntas que pertenecen a la sesión.
	respuestas := make(map[string][]string, len(in.Respuestas))
	enSesion := make(map[string]struct{}, len(refs))
	for _, ref := range refs {
		enSesion[ref] = struct{}{}
	}
	for _, rsp := range in.Respuestas {
		if _, ok := enSesion[rsp.Ref]; ok {
			respuestas[rsp.Ref] = rsp.Seleccion
		}
	}

	resultado := exams.Calificar(id, refs, preguntas, respuestas)

	intentos := make([]exams.Intento, 0, len(resultado.Resultados))
	for _, rp := range resultado.Resultados {
		intentos = append(intentos, exams.Intento{
			PreguntaRef: rp.Ref, Correcto: rp.Correcto, Seleccion: rp.Seleccion,
		})
	}

	if err := a.sesiones.Finalizar(r.Context(), ident.Subject, id, resultado.Puntaje, intentos); err != nil {
		switch {
		case errors.Is(err, store.ErrYaFinalizada):
			httpx.WriteError(w, http.StatusConflict, "ya_finalizada", "la sesión ya fue entregada")
		case errors.Is(err, store.ErrNotFound):
			httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "sesión no encontrada")
		default:
			a.errorInterno(w, r, "finalizar sesión", err)
		}
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resultado)
}

// obtenerSesion devuelve la sesión propia: preguntas públicas si está en curso, o
// el resultado completo (con respuestas y explicaciones) si está finalizada.
func (a *API) obtenerSesion(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	id := r.PathValue("id")
	ses, refs, err := a.sesiones.ObtenerSesion(r.Context(), ident.Subject, id)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "sesión no encontrada")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "obtener sesión", err)
		return
	}

	preguntas, err := a.preguntas.PorRefs(r.Context(), refs)
	if err != nil {
		a.errorInterno(w, r, "cargar preguntas", err)
		return
	}

	rev := exams.RevisionSesion{Sesion: ses}
	if ses.Estado == "en_curso" {
		rev.Preguntas = make([]exams.PreguntaPublica, 0, len(refs))
		for _, ref := range refs {
			if p, ok := preguntas[ref]; ok {
				rev.Preguntas = append(rev.Preguntas, exams.Publica(p))
			}
		}
		httpx.WriteJSON(w, http.StatusOK, rev)
		return
	}

	// Finalizada: reconstruir el resultado a partir de los intentos guardados.
	intentos, err := a.sesiones.ObtenerIntentos(r.Context(), id)
	if err != nil {
		a.errorInterno(w, r, "obtener intentos", err)
		return
	}
	seleccionPorRef := make(map[string][]string, len(intentos))
	for _, it := range intentos {
		seleccionPorRef[it.PreguntaRef] = it.Seleccion
	}
	resultado := exams.Calificar(id, refs, preguntas, seleccionPorRef)
	rev.Resultado = &resultado
	httpx.WriteJSON(w, http.StatusOK, rev)
}

// listarMias devuelve las sesiones del usuario autenticado.
func (a *API) listarMias(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}
	limit, offset, err := paginacion(r)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "parametros_invalidos", err.Error())
		return
	}
	items, err := a.sesiones.ListarSesiones(r.Context(), ident.Subject, limit, offset)
	if err != nil {
		a.errorInterno(w, r, "listar sesiones", err)
		return
	}
	if items == nil {
		items = []exams.Sesion{}
	}
	var next *int
	if len(items) == limit {
		n := offset + limit
		next = &n
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"data": items, "count": len(items), "next_offset": next})
}

// crearPregunta inserta una pregunta en el banco (admin).
func (a *API) crearPregunta(w http.ResponseWriter, r *http.Request) {
	var in exams.NuevaPregunta
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}
	if errs := in.Validar(); len(errs) > 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", errs...)
		return
	}
	p, err := a.preguntas.CrearPregunta(r.Context(), in)
	if errors.Is(err, store.ErrConflict) {
		httpx.WriteError(w, http.StatusConflict, "conflicto", "ya existe una pregunta con ese id")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "crear pregunta", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, p)
}

func paginacion(r *http.Request) (limit, offset int, err error) {
	limit = defaultLimit
	if v := r.URL.Query().Get("limit"); v != "" {
		limit, err = strconv.Atoi(v)
		if err != nil || limit < 1 {
			return 0, 0, errors.New("limit debe ser un entero >= 1")
		}
		if limit > maxLimit {
			limit = maxLimit
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		offset, err = strconv.Atoi(v)
		if err != nil || offset < 0 {
			return 0, 0, errors.New("offset debe ser un entero >= 0")
		}
	}
	return limit, offset, nil
}

func (a *API) errorInterno(w http.ResponseWriter, r *http.Request, contexto string, err error) {
	a.logger.LogAttrs(r.Context(), slog.LevelError, "error_interno",
		slog.String("op", contexto),
		slog.String("err", err.Error()),
		slog.String("request_id", httpx.RequestIDFromContext(r.Context())),
	)
	httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "ocurrió un error interno")
}
