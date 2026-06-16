package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/certready/certready/libs/platform/httpx"

	"github.com/certready/certready/services/problems/internal/problems"
	"github.com/certready/certready/services/problems/internal/store"
)

const (
	defaultLimit = 20
	maxLimit     = 100
)

func (a *API) listarProblemas(w http.ResponseWriter, r *http.Request) {
	limit, offset, err := paginacion(r)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "parametros_invalidos", err.Error())
		return
	}
	items, err := a.store.ListarProblemas(r.Context(), store.FiltroProblemas{
		Area:       r.URL.Query().Get("area"),
		Areas:      areasCSV(r),
		Dificultad: r.URL.Query().Get("dificultad"),
		Etiqueta:   r.URL.Query().Get("etiqueta"),
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		a.errorInterno(w, r, "listar problemas", err)
		return
	}
	// Proyección a vista pública: nunca se exponen casos ocultos.
	publicos := make([]problems.Problema, 0, len(items))
	for _, p := range items {
		publicos = append(publicos, p.VistaPublica())
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"data":        publicos,
		"count":       len(publicos),
		"next_offset": siguienteOffset(len(publicos), limit, offset),
	})
}

func (a *API) obtenerProblema(w http.ResponseWriter, r *http.Request) {
	p, err := a.store.ObtenerProblema(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "problema no encontrado")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "obtener problema", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p.VistaPublica())
}

func (a *API) crearProblema(w http.ResponseWriter, r *http.Request) {
	var in problems.NuevoProblema
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}
	if errs := in.Validar(); len(errs) > 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", errs...)
		return
	}
	p, err := a.store.CrearProblema(r.Context(), in)
	if errors.Is(err, store.ErrConflict) {
		httpx.WriteError(w, http.StatusConflict, "conflicto", "ya existe un problema con ese id")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "crear problema", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, p)
}

func (a *API) listarQA(w http.ResponseWriter, r *http.Request) {
	limit, offset, err := paginacion(r)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "parametros_invalidos", err.Error())
		return
	}
	items, err := a.store.ListarQA(r.Context(), store.FiltroQA{
		Puesto:    r.URL.Query().Get("puesto"),
		Area:      r.URL.Query().Get("area"),
		Areas:     areasCSV(r),
		Categoria: r.URL.Query().Get("categoria"),
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil {
		a.errorInterno(w, r, "listar qa", err)
		return
	}
	if items == nil {
		items = []problems.PreguntaQA{}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"data":        items,
		"count":       len(items),
		"next_offset": siguienteOffset(len(items), limit, offset),
	})
}

func (a *API) obtenerQA(w http.ResponseWriter, r *http.Request) {
	q, err := a.store.ObtenerQA(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "pregunta no encontrada")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "obtener qa", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, q)
}

func (a *API) crearQA(w http.ResponseWriter, r *http.Request) {
	var in problems.NuevaPreguntaQA
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}
	if errs := in.Validar(); len(errs) > 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", errs...)
		return
	}
	q, err := a.store.CrearQA(r.Context(), in)
	if errors.Is(err, store.ErrConflict) {
		httpx.WriteError(w, http.StatusConflict, "conflicto", "ya existe una pregunta con ese id")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "crear qa", err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, q)
}

// areasCSV lee el parámetro `areas` (lista separada por comas) y devuelve los
// valores no vacíos, ya recortados. Returns nil si el parámetro no viene; permite
// filtrar por una especialidad que agrupa varias áreas.
func areasCSV(r *http.Request) []string {
	raw := r.URL.Query().Get("areas")
	if raw == "" {
		return nil
	}
	var out []string
	for _, a := range strings.Split(raw, ",") {
		if a = strings.TrimSpace(a); a != "" {
			out = append(out, a)
		}
	}
	return out
}

// paginacion lee y valida los parámetros limit/offset comunes a los listados.
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

// siguienteOffset devuelve el offset de la página siguiente, o nil si esta página
// no llenó el límite (no hay más resultados que pedir).
func siguienteOffset(n, limit, offset int) *int {
	if n == limit {
		next := offset + limit
		return &next
	}
	return nil
}

func (a *API) errorInterno(w http.ResponseWriter, r *http.Request, contexto string, err error) {
	a.logger.LogAttrs(r.Context(), slog.LevelError, "error_interno",
		slog.String("op", contexto),
		slog.String("err", err.Error()),
		slog.String("request_id", httpx.RequestIDFromContext(r.Context())),
	)
	httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "ocurrió un error interno")
}
