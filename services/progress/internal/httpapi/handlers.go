package httpapi

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/httpx"

	"github.com/certready/certready/services/progress/internal/progress"
)

// marcarLeccion registra una lección como leída por el usuario autenticado.
//
// El usuario_id sale SIEMPRE del `sub` del token, nunca del body (defensa IDOR).
func (a *API) marcarLeccion(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	var in progress.NuevaLeccion
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}
	if errs := in.Validar(); len(errs) > 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", errs...)
		return
	}

	if err := a.store.MarcarLeccion(r.Context(), ident.Subject, in); err != nil {
		a.errorInterno(w, r, "marcar lección", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// guardarQuiz registra el resultado del quiz de un tema y devuelve el estado
// resultante (mejor puntaje y si el tema quedó aprobado).
func (a *API) guardarQuiz(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	var in progress.NuevoQuiz
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}
	if errs := in.Validar(); len(errs) > 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", errs...)
		return
	}

	aprobado := in.Puntaje >= progress.UmbralAprobado
	res, err := a.store.GuardarQuiz(r.Context(), ident.Subject, in, aprobado)
	if err != nil {
		a.errorInterno(w, r, "guardar quiz", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

// guardarRevisionQA registra la autoevaluación de una pregunta de entrevista del
// usuario autenticado (señal de Q&A para el DSS de preparación por puesto).
func (a *API) guardarRevisionQA(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	var in progress.NuevaRevisionQA
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}
	if errs := in.Validar(); len(errs) > 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", errs...)
		return
	}

	if err := a.store.GuardarRevisionQA(r.Context(), ident.Subject, in); err != nil {
		a.errorInterno(w, r, "guardar revisión Q&A", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// obtenerMio devuelve el progreso del usuario autenticado en una certificación.
func (a *API) obtenerMio(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	cert := strings.TrimSpace(r.URL.Query().Get("certificacion"))
	if cert == "" {
		httpx.WriteError(w, http.StatusBadRequest, "parametros_invalidos", "certificacion es requerida")
		return
	}

	prog, err := a.store.ObtenerDeUsuario(r.Context(), ident.Subject, cert)
	if err != nil {
		a.errorInterno(w, r, "obtener progreso", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, prog)
}

// errorInterno registra el error real y responde 500 genérico al cliente.
func (a *API) errorInterno(w http.ResponseWriter, r *http.Request, contexto string, err error) {
	a.logger.LogAttrs(r.Context(), slog.LevelError, "error_interno",
		slog.String("op", contexto),
		slog.String("err", err.Error()),
		slog.String("request_id", httpx.RequestIDFromContext(r.Context())),
	)
	httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "ocurrió un error interno")
}
