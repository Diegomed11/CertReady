// Package httpapi expone la API HTTP del servicio progress.
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
	store  ProgresoStore
	logger *slog.Logger
}

// Options son las dependencias del router. Auth es opcional: si es nil, las rutas
// protegidas responden 501 (no se exponen sin control).
type Options struct {
	Service string
	Version string
	Logger  *slog.Logger
	Store   ProgresoStore
	Auth    *auth.Authenticator
}

// NewRouter construye el http.Handler raíz del servicio.
//
// Rutas (API versionada bajo /v1):
//
//	GET  /v1/health              liveness
//	GET  /v1/ready               readiness (ping a Postgres)
//	POST /v1/progress/lessons    marcar una lección como leída (auth)
//	POST /v1/progress/quizzes    registrar el resultado del quiz de un tema (auth)
//	POST /v1/progress/qa         autoevaluación de una pregunta de entrevista (auth)
//	GET  /v1/me/progress         progreso del usuario en una certificación (auth)
//
// Toda la autorización es por **pertenencia**: el handler usa el `sub` del JWT
// para acotar consultas y mutaciones (defensa IDOR/BOLA).
func NewRouter(opts Options) http.Handler {
	api := &API{store: opts.Store, logger: opts.Logger}

	health := httpx.NewHealth(opts.Service, opts.Version, httpx.Check{
		Name:  "postgres",
		Probe: func(ctx context.Context) error { return opts.Store.Ping(ctx) },
	})

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", health.Liveness)
	mux.HandleFunc("GET /v1/ready", health.Readiness)

	mux.Handle("POST /v1/progress/lessons", authGate(opts.Auth, http.HandlerFunc(api.marcarLeccion)))
	mux.Handle("POST /v1/progress/quizzes", authGate(opts.Auth, http.HandlerFunc(api.guardarQuiz)))
	mux.Handle("POST /v1/progress/qa", authGate(opts.Auth, http.HandlerFunc(api.guardarRevisionQA)))
	mux.Handle("GET /v1/me/progress", authGate(opts.Auth, http.HandlerFunc(api.obtenerMio)))

	return httpx.Chain(mux,
		httpx.Recover(opts.Logger),
		httpx.RequestID,
		httpx.AccessLog(opts.Logger),
	)
}

// authGate exige un JWT válido (cualquier usuario autenticado). Sin autenticador,
// devuelve 501 en lugar de dejar la ruta abierta.
func authGate(authn *auth.Authenticator, next http.Handler) http.Handler {
	if authn == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			httpx.WriteError(w, http.StatusNotImplemented, "auth_no_disponible",
				"esta ruta requiere OIDC configurado (PROGRESS_OIDC_ISSUER)")
		})
	}
	return authn.Middleware(next)
}
