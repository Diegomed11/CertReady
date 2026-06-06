// Package httpapi expone la API HTTP del servicio judge (juez de código).
package httpapi

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/httpx"

	"github.com/certready/certready/judge/internal/runner"
)

// API agrupa las dependencias de los handlers.
type API struct {
	problemas ProblemasStore
	corridas  CorridasStore
	runner    runner.Runner
	logger    *slog.Logger
}

// Options son las dependencias del router. Auth es opcional: si es nil, las
// rutas protegidas responden 501.
type Options struct {
	Service   string
	Version   string
	Logger    *slog.Logger
	Problemas ProblemasStore
	Corridas  CorridasStore
	Runner    runner.Runner
	Auth      *auth.Authenticator
}

// NewRouter construye el http.Handler raíz del servicio.
//
// Rutas (API versionada bajo /v1):
//
//	GET  /v1/health              liveness
//	GET  /v1/ready               readiness (ping a MongoDB y Postgres)
//	POST /v1/judge/runs          enviar código y calificar (auth)
//	GET  /v1/judge/runs/{id}     consultar una corrida propia (auth)
//	GET  /v1/me/judge/runs       historial de corridas propio (auth)
func NewRouter(opts Options) http.Handler {
	api := &API{
		problemas: opts.Problemas,
		corridas:  opts.Corridas,
		runner:    opts.Runner,
		logger:    opts.Logger,
	}

	health := httpx.NewHealth(opts.Service, opts.Version,
		httpx.Check{Name: "mongodb", Probe: func(ctx context.Context) error { return opts.Problemas.PingMongo(ctx) }},
		httpx.Check{Name: "postgres", Probe: func(ctx context.Context) error { return opts.Corridas.PingPostgres(ctx) }},
	)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", health.Liveness)
	mux.HandleFunc("GET /v1/ready", health.Readiness)

	mux.Handle("POST /v1/judge/runs", authGate(opts.Auth, http.HandlerFunc(api.enviar)))
	mux.Handle("GET /v1/judge/runs/{id}", authGate(opts.Auth, http.HandlerFunc(api.obtener)))
	mux.Handle("GET /v1/me/judge/runs", authGate(opts.Auth, http.HandlerFunc(api.listarMias)))

	return httpx.Chain(mux,
		httpx.Recover(opts.Logger),
		httpx.RequestID,
		httpx.AccessLog(opts.Logger),
	)
}

func authGate(authn *auth.Authenticator, next http.Handler) http.Handler {
	if authn == nil {
		return gateCerrado()
	}
	return authn.Middleware(next)
}

func gateCerrado() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteError(w, http.StatusNotImplemented, "auth_no_disponible",
			"esta ruta requiere OIDC configurado (JUDGE_OIDC_ISSUER)")
	})
}
