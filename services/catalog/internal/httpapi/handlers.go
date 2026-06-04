package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/certready/certready/libs/platform/httpx"

	"github.com/certready/certready/services/catalog/internal/catalog"
	"github.com/certready/certready/services/catalog/internal/store"
)

// defaultLimit y maxLimit acotan el tamaño de página de los listados.
const (
	defaultLimit = 20
	maxLimit     = 100
)

// ---------------------------------------------------------------------------
// Certificaciones
// ---------------------------------------------------------------------------

func (a *API) listarCertificaciones(w http.ResponseWriter, r *http.Request) {
	limit, offset, err := paginacion(r)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "parametros_invalidos", err.Error())
		return
	}
	activo, err := boolQuery(r, "activo")
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "parametros_invalidos", err.Error())
		return
	}

	items, err := a.store.ListarCertificaciones(r.Context(), store.FiltroCertificaciones{
		Proveedor: r.URL.Query().Get("proveedor"),
		Nivel:     r.URL.Query().Get("nivel"),
		Activo:    activo,
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil {
		a.errorInterno(w, r, "listar certificaciones", err)
		return
	}
	escribirLista(w, items, limit, offset)
}

func (a *API) obtenerCertificacion(w http.ResponseWriter, r *http.Request) {
	c, err := a.store.ObtenerCertificacion(r.Context(), r.PathValue("idOrSlug"))
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "certificación no encontrada")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "obtener certificación", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, c)
}

func (a *API) crearCertificacion(w http.ResponseWriter, r *http.Request) {
	var in catalog.NuevaCertificacion
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}
	if errs := in.Validar(); len(errs) > 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", errs...)
		return
	}

	c, err := a.store.CrearCertificacion(r.Context(), in)
	if errors.Is(err, store.ErrConflict) {
		httpx.WriteError(w, http.StatusConflict, "conflicto", "ya existe una certificación con ese slug")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "crear certificación", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, c)
}

// ---------------------------------------------------------------------------
// Temas
// ---------------------------------------------------------------------------

func (a *API) listarTemas(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.ListarTemasDeCertificacion(r.Context(), r.PathValue("id"))
	if err != nil {
		a.errorInterno(w, r, "listar temas", err)
		return
	}
	// Sin paginación: el número de temas por certificación es acotado.
	if items == nil {
		items = []catalog.Tema{}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"data": items, "count": len(items)})
}

func (a *API) obtenerTema(w http.ResponseWriter, r *http.Request) {
	t, err := a.store.ObtenerTema(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "tema no encontrado")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "obtener tema", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, t)
}

// ---------------------------------------------------------------------------
// Pistas de entrevista
// ---------------------------------------------------------------------------

func (a *API) listarPistas(w http.ResponseWriter, r *http.Request) {
	limit, offset, err := paginacion(r)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "parametros_invalidos", err.Error())
		return
	}
	activo, err := boolQuery(r, "activo")
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "parametros_invalidos", err.Error())
		return
	}

	items, err := a.store.ListarPistas(r.Context(), store.FiltroPistas{
		Puesto: r.URL.Query().Get("puesto"),
		Area:   r.URL.Query().Get("area"),
		Activo: activo,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		a.errorInterno(w, r, "listar pistas", err)
		return
	}
	escribirLista(w, items, limit, offset)
}

func (a *API) obtenerPista(w http.ResponseWriter, r *http.Request) {
	p, err := a.store.ObtenerPista(r.Context(), r.PathValue("idOrSlug"))
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "pista no encontrada")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "obtener pista", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// escribirLista emite la envoltura de lista estándar: data, count y next_offset.
//
// next_offset es offset+limit cuando la página vino llena (heurística de "hay
// más"), o null cuando vino incompleta. Evita una consulta COUNT adicional.
func escribirLista[T any](w http.ResponseWriter, items []T, limit, offset int) {
	if items == nil {
		items = []T{}
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

// paginacion lee y valida los parámetros limit/offset de la query.
func paginacion(r *http.Request) (limit, offset int, err error) {
	limit = defaultLimit
	if v := r.URL.Query().Get("limit"); v != "" {
		limit, err = strconv.Atoi(v)
		if err != nil || limit < 1 {
			return 0, 0, errLimit()
		}
		if limit > maxLimit {
			limit = maxLimit
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		offset, err = strconv.Atoi(v)
		if err != nil || offset < 0 {
			return 0, 0, errOffset()
		}
	}
	return limit, offset, nil
}

// boolQuery interpreta un parámetro booleano opcional de la query.
//
// Returns (nil, nil) si está ausente; (*bool, nil) si es un booleano válido;
// (nil, error) si está presente pero mal formado.
func boolQuery(r *http.Request, key string) (*bool, error) {
	v := r.URL.Query().Get(key)
	if v == "" {
		return nil, nil
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return nil, errBool(key)
	}
	return &b, nil
}

func errLimit() error        { return &paramError{"limit debe ser un entero >= 1"} }
func errOffset() error       { return &paramError{"offset debe ser un entero >= 0"} }
func errBool(k string) error { return &paramError{k + " debe ser booleano (true/false)"} }

type paramError struct{ msg string }

func (e *paramError) Error() string { return e.msg }

// errorInterno registra el error real y responde con un 500 genérico, sin filtrar
// detalles internos al cliente (defensa de divulgación de información).
func (a *API) errorInterno(w http.ResponseWriter, r *http.Request, contexto string, err error) {
	a.logger.LogAttrs(r.Context(), slog.LevelError, "error_interno",
		slog.String("op", contexto),
		slog.String("err", err.Error()),
		slog.String("request_id", httpx.RequestIDFromContext(r.Context())),
	)
	httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "ocurrió un error interno")
}
