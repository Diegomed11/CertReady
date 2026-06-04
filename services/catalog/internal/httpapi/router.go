// Package httpapi expone la API HTTP del servicio catalog: enrutado, handlers y
// traducción de errores de dominio a respuestas REST. Construye un http.Handler;
// el ciclo de vida del servidor vive en cmd/server y cmd/lambda.
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
	store  CatalogStore
	logger *slog.Logger
}

// Options son las dependencias para construir el router.
//
// Auth es opcional: si es nil (p. ej. dev sin OIDC configurado), las rutas de
// administración quedan cerradas con 501 en lugar de exponerse sin control.
type Options struct {
	Service string
	Version string
	Logger  *slog.Logger
	Store   CatalogStore
	Auth    *auth.Authenticator
}

// NewRouter construye el http.Handler raíz del servicio con rutas y middleware.
//
// Rutas (API versionada bajo /v1):
//
//	GET  /v1/health                          liveness
//	GET  /v1/ready                           readiness (incluye ping a Postgres)
//	GET  /v1/certifications                  lista (filtros: proveedor, nivel, activo)
//	GET  /v1/certifications/{idOrSlug}        detalle
//	GET  /v1/certifications/{id}/topics       temas de una certificación
//	GET  /v1/topics/{id}                      detalle de tema
//	GET  /v1/tracks                          lista de pistas (filtros: puesto, area)
//	GET  /v1/tracks/{idOrSlug}                detalle de pista
//	POST /v1/certifications                  crear (admin — gated hasta Inc. 2)
//
// Orden de middleware (de fuera hacia dentro): recover → request-id → access-log.
func NewRouter(opts Options) http.Handler {
	api := &API{store: opts.Store, logger: opts.Logger}

	// Readiness comprueba la conectividad con Postgres.
	health := httpx.NewHealth(opts.Service, opts.Version, httpx.Check{
		Name:  "postgres",
		Probe: func(ctx context.Context) error { return opts.Store.Ping(ctx) },
	})

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", health.Liveness)
	mux.HandleFunc("GET /v1/ready", health.Readiness)

	mux.HandleFunc("GET /v1/certifications", api.listarCertificaciones)
	mux.HandleFunc("GET /v1/certifications/{idOrSlug}", api.obtenerCertificacion)
	mux.HandleFunc("GET /v1/certifications/{id}/topics", api.listarTemas)
	mux.HandleFunc("GET /v1/topics/{id}", api.obtenerTema)
	mux.HandleFunc("GET /v1/tracks", api.listarPistas)
	mux.HandleFunc("GET /v1/tracks/{idOrSlug}", api.obtenerPista)

	// Escritura admin: protegida con JWT + rol admin si hay autenticador; si no,
	// cerrada con 501 para no exponerla sin control.
	mux.Handle("POST /v1/certifications", adminGate(opts.Auth, http.HandlerFunc(api.crearCertificacion)))

	return httpx.Chain(mux,
		httpx.Recover(opts.Logger),
		httpx.RequestID,
		httpx.AccessLog(opts.Logger),
	)
}

// adminGate protege un handler exigiendo un JWT válido con rol `admin`.
//
// Si authn es nil (OIDC no configurado, p. ej. en dev), devuelve 501 en lugar de
// dejar la ruta abierta. Con autenticador, compone Middleware + RequireRole.
func adminGate(authn *auth.Authenticator, next http.Handler) http.Handler {
	if authn == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			httpx.WriteError(w, http.StatusNotImplemented, "auth_no_disponible",
				"la autorización de administración requiere OIDC configurado (CATALOG_OIDC_ISSUER)")
		})
	}
	return authn.Middleware(auth.RequireRole("admin")(next))
}
