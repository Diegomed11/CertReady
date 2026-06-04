// Package httpapi expone la API HTTP del servicio users.
package httpapi

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/httpx"
)

// API agrupa las dependencias de los handlers.
type API struct {
	store  UserStore
	logger *slog.Logger
}

// Options son las dependencias del router. Auth es opcional: si es nil, las rutas
// protegidas responden 501 (no se exponen sin control).
type Options struct {
	Service string
	Version string
	Logger  *slog.Logger
	Store   UserStore
	Auth    *auth.Authenticator
}

// NewRouter construye el http.Handler raíz del servicio.
//
// Rutas (API versionada bajo /v1):
//
//	GET   /v1/health           liveness
//	GET   /v1/ready            readiness (ping a Postgres)
//	GET   /v1/me               perfil propio (auth; provisión JIT en primer acceso)
//	PATCH /v1/me               editar perfil propio (auth)
//	GET   /v1/users            listar usuarios (auth + rol admin)
func NewRouter(opts Options) http.Handler {
	api := &API{store: opts.Store, logger: opts.Logger}

	health := httpx.NewHealth(opts.Service, opts.Version, httpx.Check{
		Name:  "postgres",
		Probe: func(ctx context.Context) error { return opts.Store.Ping(ctx) },
	})

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", health.Liveness)
	mux.HandleFunc("GET /v1/ready", health.Readiness)

	mux.Handle("GET /v1/me", authGate(opts.Auth, http.HandlerFunc(api.me)))
	mux.Handle("PATCH /v1/me", authGate(opts.Auth, http.HandlerFunc(api.actualizarMe)))
	mux.Handle("GET /v1/users", adminGate(opts.Auth, http.HandlerFunc(api.listarUsuarios)))

	return httpx.Chain(mux,
		httpx.Recover(opts.Logger),
		httpx.RequestID,
		httpx.AccessLog(opts.Logger),
	)
}

// authGate exige un JWT válido (cualquier usuario autenticado).
func authGate(authn *auth.Authenticator, next http.Handler) http.Handler {
	if authn == nil {
		return gateCerrado()
	}
	return authn.Middleware(next)
}

// adminGate exige un JWT válido con rol admin.
func adminGate(authn *auth.Authenticator, next http.Handler) http.Handler {
	if authn == nil {
		return gateCerrado()
	}
	return authn.Middleware(auth.RequireRole("admin")(next))
}

// gateCerrado responde 501 cuando no hay OIDC configurado, para no dejar rutas
// protegidas abiertas en entornos sin autenticación.
func gateCerrado() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteError(w, http.StatusNotImplemented, "auth_no_disponible",
			"esta ruta requiere OIDC configurado (USERS_OIDC_ISSUER)")
	})
}
