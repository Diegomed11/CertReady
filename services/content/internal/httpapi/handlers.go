package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/certready/certready/libs/platform/httpx"

	"github.com/certready/certready/services/content/internal/content"
	"github.com/certready/certready/services/content/internal/store"
)

const (
	defaultLimit = 20
	maxLimit     = 100
)

func (a *API) listar(w http.ResponseWriter, r *http.Request) {
	limit, offset, err := paginacion(r)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "parametros_invalidos", err.Error())
		return
	}
	items, err := a.store.Listar(r.Context(), store.Filtro{
		Certificacion: r.URL.Query().Get("certificacion"),
		Tema:          r.URL.Query().Get("tema"),
		Limit:         limit,
		Offset:        offset,
	})
	if err != nil {
		a.errorInterno(w, r, "listar material", err)
		return
	}
	if items == nil {
		items = []content.Material{}
	}
	var next *int
	if len(items) == limit {
		n := offset + limit
		next = &n
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"data": items, "count": len(items), "next_offset": next})
}

func (a *API) obtener(w http.ResponseWriter, r *http.Request) {
	m, err := a.store.Obtener(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "material no encontrado")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "obtener material", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, m)
}

func (a *API) crear(w http.ResponseWriter, r *http.Request) {
	var in content.NuevoMaterial
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}
	if errs := in.Validar(); len(errs) > 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", errs...)
		return
	}
	m, err := a.store.Crear(r.Context(), in)
	if errors.Is(err, store.ErrConflict) {
		httpx.WriteError(w, http.StatusConflict, "conflicto", "ya existe material con ese id")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "crear material", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, m)
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
