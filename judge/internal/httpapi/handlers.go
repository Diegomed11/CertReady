package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/httpx"

	"github.com/certready/certready/judge/internal/judge"
	"github.com/certready/certready/judge/internal/store"
)

const (
	defaultLimit = 20
	maxLimit     = 100
)

// enviar recibe un envío de código, lo califica en el sandbox contra los casos
// del problema y persiste la ejecucion. La respuesta no revela los casos ocultos.
func (a *API) enviar(w http.ResponseWriter, r *http.Request) {
	identidad, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	var in judge.EnvioCodigo
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}
	if errs := in.Validar(); len(errs) > 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", errs...)
		return
	}

	problema, err := a.problemas.ObtenerProblema(r.Context(), in.ProblemaRef)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "problema no encontrado")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "obtener problema", err)
		return
	}
	if !problema.PermiteLenguaje(in.Lenguaje) {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "lenguaje_no_permitido",
			"el problema no admite ese lenguaje")
		return
	}

	resultado, err := judge.Calificar(r.Context(), a.runner, problema, in)
	if err != nil {
		// Fallo del sandbox (p. ej. Docker no disponible): no es culpa del usuario.
		a.logger.LogAttrs(r.Context(), slog.LevelError, "sandbox_no_disponible",
			slog.String("err", err.Error()),
			slog.String("request_id", httpx.RequestIDFromContext(r.Context())),
		)
		httpx.WriteError(w, http.StatusServiceUnavailable, "juez_no_disponible",
			"el juez de código no está disponible en este momento")
		return
	}

	area := problema.Area
	if area == "" {
		area = "desconocido"
	}
	ejecucion, err := a.ejecuciones.CrearEjecucion(r.Context(), identidad.Subject, in, resultado, area)
	if err != nil {
		a.errorInterno(w, r, "registrar ejecucion", err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"ejecucion":   ejecucion,
		"resultado": resultado,
	})
}

// obtener devuelve una ejecucion del usuario autenticado (ajena ⇒ 404, BOLA).
func (a *API) obtener(w http.ResponseWriter, r *http.Request) {
	identidad, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}
	c, err := a.ejecuciones.ObtenerEjecucion(r.Context(), identidad.Subject, r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "ejecucion no encontrada")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "obtener ejecucion", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, c)
}

// listarMias devuelve el historial de ejecuciones del usuario autenticado.
func (a *API) listarMias(w http.ResponseWriter, r *http.Request) {
	identidad, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}
	limit, offset, err := paginacion(r)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "parametros_invalidos", err.Error())
		return
	}
	items, err := a.ejecuciones.ListarEjecuciones(r.Context(), identidad.Subject, limit, offset)
	if err != nil {
		a.errorInterno(w, r, "listar ejecuciones", err)
		return
	}
	if items == nil {
		items = []judge.Ejecucion{}
	}
	var next *int
	if len(items) == limit {
		n := offset + limit
		next = &n
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"data":        items,
		"count":       len(items),
		"next_offset": next,
	})
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
