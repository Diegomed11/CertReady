package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/httpx"

	"github.com/certready/certready/services/users/internal/store"
	"github.com/certready/certready/services/users/internal/users"
)

const (
	defaultLimit = 20
	maxLimit     = 100
)

// me devuelve la cuenta del usuario autenticado, provisionándola en el primer
// acceso a partir de los claims del token (JIT provisioning).
//
// El usuario se identifica SIEMPRE por el `sub` del token, nunca por un id del
// cliente: por diseño es imposible leer la cuenta de otro (anti-IDOR).
func (a *API) me(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	u, err := a.store.ObtenerOProvisionar(r.Context(), ident.Subject, ident.Email, nombreDe(ident), rolDe(ident))
	if err != nil {
		a.errorInterno(w, r, "provisionar usuario", err)
		return
	}
	p, err := a.store.ObtenerPerfil(r.Context(), u.ID)
	if err != nil {
		a.errorInterno(w, r, "obtener perfil", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, users.Cuenta{Usuario: u, Perfil: p})
}

// actualizarMe edita el perfil del propio usuario autenticado.
func (a *API) actualizarMe(w http.ResponseWriter, r *http.Request) {
	ident, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	var in users.ActualizarPerfil
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "cuerpo_invalido", err.Error())
		return
	}
	if errs := in.Validar(); len(errs) > 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "validacion", "datos inválidos", errs...)
		return
	}

	// Asegura que el usuario exista antes de actualizar (idempotente).
	if _, err := a.store.ObtenerOProvisionar(r.Context(), ident.Subject, ident.Email, nombreDe(ident), rolDe(ident)); err != nil {
		a.errorInterno(w, r, "provisionar usuario", err)
		return
	}

	u, p, err := a.store.ActualizarCuenta(r.Context(), ident.Subject, in)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "usuario no encontrado")
		return
	}
	if err != nil {
		a.errorInterno(w, r, "actualizar cuenta", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, users.Cuenta{Usuario: u, Perfil: p})
}

// listarUsuarios devuelve una página de usuarios (solo admin).
func (a *API) listarUsuarios(w http.ResponseWriter, r *http.Request) {
	limit, offset, err := paginacion(r)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "parametros_invalidos", err.Error())
		return
	}
	items, err := a.store.ListarUsuarios(r.Context(), limit, offset)
	if err != nil {
		a.errorInterno(w, r, "listar usuarios", err)
		return
	}
	if items == nil {
		items = []users.Usuario{}
	}
	var next *int
	if len(items) == limit {
		n := offset + limit
		next = &n
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"data": items, "count": len(items), "next_offset": next})
}

// nombreDe devuelve el nombre del token como *string (nil si está vacío).
func nombreDe(id auth.Identity) *string {
	if id.Nombre == "" {
		return nil
	}
	return &id.Nombre
}

// rolDe deriva el rol de aplicación a partir de los roles del token.
func rolDe(id auth.Identity) string {
	if id.HasRole("admin") {
		return "admin"
	}
	return "estudiante"
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

// errorInterno registra el error real y responde 500 genérico (sin filtrar
// detalles internos al cliente).
func (a *API) errorInterno(w http.ResponseWriter, r *http.Request, contexto string, err error) {
	a.logger.LogAttrs(r.Context(), slog.LevelError, "error_interno",
		slog.String("op", contexto),
		slog.String("err", err.Error()),
		slog.String("request_id", httpx.RequestIDFromContext(r.Context())),
	)
	httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "ocurrió un error interno")
}
