// Package httpapi expone la API HTTP del servicio content.
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
	store  ContentStore
	logger *slog.Logger
}

// Options son las dependencias del router. Auth es opcional: si es nil, las
// rutas de administración responden 501 (no se exponen sin control).
type Options struct {
	Service string
	Version string
	Logger  *slog.Logger
	Store   ContentStore
	Auth    *auth.Authenticator
}

// NewRouter construye el http.Handler raíz del servicio.
//
// Rutas (API versionada bajo /v1):
//
//	GET  /v1/health              liveness
//	GET  /v1/ready               readiness (ping a MongoDB)
//	GET  /v1/content             lista de material (filtros: certificacion, tema)
//	GET  /v1/content/{id}        detalle de material
//	POST /v1/content             crear material (admin)
func NewRouter(opts Options) http.Handler {
	api := &API{store: opts.Store, logger: opts.Logger}

	health := httpx.NewHealth(opts.Service, opts.Version, httpx.Check{
		Name:  "mongodb",
		Probe: func(ctx context.Context) error { return opts.Store.Ping(ctx) },
	})

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", health.Liveness)
	mux.HandleFunc("GET /v1/ready", health.Readiness)
	mux.HandleFunc("GET /v1/content", api.listar)
	mux.HandleFunc("GET /v1/content/{id}", api.obtener)
	mux.Handle("POST /v1/content", adminGate(opts.Auth, http.HandlerFunc(api.crear)))

	return httpx.Chain(mux,
		httpx.Recover(opts.Logger),
		httpx.RequestID,
		httpx.AccessLog(opts.Logger),
	)
}

// adminGate protege un handler exigiendo JWT + rol admin; sin autenticador
// devuelve 501 en lugar de dejar la ruta abierta.
func adminGate(authn *auth.Authenticator, next http.Handler) http.Handler {
	if authn == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			httpx.WriteError(w, http.StatusNotImplemented, "auth_no_disponible",
				"la administración de contenido requiere OIDC configurado (CONTENT_OIDC_ISSUER)")
		})
	}
	return authn.Middleware(auth.RequireRole("admin")(next))
}
