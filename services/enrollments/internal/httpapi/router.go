// Package httpapi expone la API HTTP del servicio enrollments.
package httpapi

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/httpx"

	"github.com/certready/certready/services/enrollments/internal/catalogclient"
)

// API agrupa las dependencias de los handlers.
type API struct {
	store   EnrollmentStore
	catalog catalogclient.Client
	logger  *slog.Logger
}

// Options son las dependencias del router. Auth es opcional: si es nil, las
// rutas protegidas responden 501 (no se exponen sin control).
type Options struct {
	Service string
	Version string
	Logger  *slog.Logger
	Store   EnrollmentStore
	Catalog catalogclient.Client
	Auth    *auth.Authenticator
}

// NewRouter construye el http.Handler raíz del servicio.
//
// Rutas (API versionada bajo /v1):
//
//	GET    /v1/health              liveness
//	GET    /v1/ready               readiness (ping a Postgres)
//	POST   /v1/enrollments         crear (auth; usuario_id = sub del token)
//	GET    /v1/me/enrollments      listar las del usuario autenticado
//	PATCH  /v1/enrollments/{id}    cambiar estado (solo del propio usuario)
//	DELETE /v1/enrollments/{id}    eliminar (solo del propio usuario)
//
// Toda la autorización es por **pertenencia**: el handler usa el `sub` del JWT
// para acotar consultas y mutaciones (defensa IDOR/BOLA).
func NewRouter(opts Options) http.Handler {
	api := &API{store: opts.Store, catalog: opts.Catalog, logger: opts.Logger}

	health := httpx.NewHealth(opts.Service, opts.Version, httpx.Check{
		Name:  "postgres",
		Probe: func(ctx context.Context) error { return opts.Store.Ping(ctx) },
	})

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", health.Liveness)
	mux.HandleFunc("GET /v1/ready", health.Readiness)

	mux.Handle("POST /v1/enrollments", authGate(opts.Auth, http.HandlerFunc(api.crear)))
	mux.Handle("GET /v1/me/enrollments", authGate(opts.Auth, http.HandlerFunc(api.listarMias)))
	mux.Handle("PATCH /v1/enrollments/{id}", authGate(opts.Auth, http.HandlerFunc(api.cambiarEstado)))
	mux.Handle("DELETE /v1/enrollments/{id}", authGate(opts.Auth, http.HandlerFunc(api.eliminar)))

	return httpx.Chain(mux,
		httpx.Recover(opts.Logger),
		httpx.RequestID,
		httpx.AccessLog(opts.Logger),
	)
}

// authGate exige un JWT válido (cualquier usuario autenticado).
//
// Sin autenticador, devuelve 501 en lugar de dejar la ruta abierta.
func authGate(authn *auth.Authenticator, next http.Handler) http.Handler {
	if authn == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			httpx.WriteError(w, http.StatusNotImplemented, "auth_no_disponible",
				"esta ruta requiere OIDC configurado (ENROLLMENTS_OIDC_ISSUER)")
		})
	}
	return authn.Middleware(next)
}
