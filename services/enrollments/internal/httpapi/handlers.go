package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/httpx"

	"github.com/certready/certready/services/enrollments/internal/catalogclient"
	"github.com/certready/certready/services/enrollments/internal/enrollments"
	"github.com/certready/certready/services/enrollments/internal/store"
)

const (
	defaultLimit = 20
	maxLimit     = 100
)

// crear inscribe al usuario autenticado en el objetivo indicado.
//
// El usuario_id sale SIEMPRE del `sub` del token, nunca del body (defensa IDOR).
// El objetivo se valida llamando al servicio catalog antes de insertar; si no
// existe, se rechaza con 422 (entidad no procesable) sin tocar la base.
func (a *API) crear(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	var in enrollments.NuevaInscripcion
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}
	if errs := in.Validar(); len(errs) > 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", errs...)
		return
	}

	if err := a.verificarObjetivo(r, in); err != nil {
		switch {
		case errors.Is(err, errObjetivoNoExiste):
			httpx.WriteError(w, http.StatusUnprocessableEntity, "objetivo_no_existe",
				"el objetivo indicado no existe en el catálogo")
		case errors.Is(err, catalogclient.ErrCatalogoNoDisponible):
			httpx.WriteError(w, http.StatusServiceUnavailable, "dependencia_no_disponible",
				"no se pudo validar el objetivo contra el catálogo")
		default:
			a.errorInterno(w, r, "verificar objetivo en catalog", err)
		}
		return
	}

	ins, err := a.store.Crear(r.Context(), ident.Subject, in)
	if errors.Is(err, store.ErrConflict) {
		httpx.WriteError(w, http.StatusConflict, "conflicto", "ya estás inscrito a ese objetivo")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "crear inscripción", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, ins)
}

// listarMias devuelve las inscripciones del usuario autenticado.
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

	items, err := a.store.ListarDeUsuario(r.Context(), ident.Subject, store.FiltroDeUsuario{
		Estado: enrollments.Estado(r.URL.Query().Get("estado")),
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		a.errorInterno(w, r, "listar inscripciones", err)
		return
	}
	if items == nil {
		items = []enrollments.Inscripcion{}
	}
	var next *int
	if len(items) == limit {
		n := offset + limit
		next = &n
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"data": items, "count": len(items), "next_offset": next,
	})
}

// cambiarEstado modifica el estado de una inscripción del propio usuario.
//
// Si el id no existe o pertenece a otro usuario, se devuelve 404 indistintamente
// (no se filtra la existencia de IDs ajenos — defensa BOLA).
func (a *API) cambiarEstado(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	var in enrollments.CambioEstado
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}
	if errs := in.Validar(); len(errs) > 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", errs...)
		return
	}

	ins, err := a.store.CambiarEstadoDeUsuario(r.Context(), ident.Subject, r.PathValue("id"), in.Estado)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "inscripción no encontrada")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "cambiar estado", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ins)
}

// eliminar borra una inscripción del propio usuario. 404 indistinto si no existe
// o no pertenece (defensa BOLA).
func (a *API) eliminar(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	err := a.store.EliminarDeUsuario(r.Context(), ident.Subject, r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "inscripción no encontrada")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "eliminar inscripción", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// errObjetivoNoExiste señala que el objetivo de inscripción no existe en catalog.
var errObjetivoNoExiste = errors.New("objetivo no existe")

// verificarObjetivo consulta a catalog si el objetivo (certificación o pista)
// existe. Devuelve errObjetivoNoExiste si responde 404, o el error transparente
// (catalogclient.ErrCatalogoNoDisponible) si catalog no responde.
func (a *API) verificarObjetivo(r *http.Request, n enrollments.NuevaInscripcion) error {
	var (
		existe bool
		err    error
	)
	switch n.TipoObjetivo {
	case enrollments.TipoCertificacion:
		existe, err = a.catalog.CertificacionExiste(r.Context(), n.ObjetivoID)
	case enrollments.TipoPista:
		existe, err = a.catalog.PistaExiste(r.Context(), n.ObjetivoID)
	}
	if err != nil {
		return err
	}
	if !existe {
		return errObjetivoNoExiste
	}
	return nil
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

// errorInterno registra el error real y responde 500 genérico al cliente.
func (a *API) errorInterno(w http.ResponseWriter, r *http.Request, contexto string, err error) {
	a.logger.LogAttrs(r.Context(), slog.LevelError, "error_interno",
		slog.String("op", contexto),
		slog.String("err", err.Error()),
		slog.String("request_id", httpx.RequestIDFromContext(r.Context())),
	)
	httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "ocurrió un error interno")
}
