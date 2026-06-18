// Package httpapi expone la API HTTP del servicio exams.
package httpapi

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/httpx"
	"github.com/certready/certready/libs/platform/postgres"
)

// API agrupa las dependencias de los handlers.
type API struct {
	preguntas     PreguntasStore
	sesiones      SesionesStore
	logger        *slog.Logger
	numPorDefecto int
}

// Options son las dependencias del router. Auth es opcional: si es nil, las
// rutas protegidas responden 501.
type Options struct {
	Service       string
	Version       string
	Logger        *slog.Logger
	Preguntas     PreguntasStore
	Sesiones      SesionesStore
	Auth          *auth.Authenticator
	NumPorDefecto int
	Pool          *pgxpool.Pool // pool para la transacción RLS por petición
	RLSEnabled    bool          // interruptor de Row Level Security (defensa en profundidad)
}

// NewRouter construye el http.Handler raíz del servicio.
//
// Rutas (API versionada bajo /v1):
//
//	GET  /v1/health                       liveness
//	GET  /v1/ready                        readiness (ping a MongoDB y Postgres)
//	POST /v1/exams/sessions               iniciar simulacro (auth)
//	POST /v1/exams/sessions/{id}/submit   entregar y calificar (auth, propia)
//	GET  /v1/exams/sessions/{id}          consultar/repasar (auth, propia)
//	GET  /v1/me/exams                     listar mis sesiones (auth)
//	GET  /v1/me/analytics                 acierto por tema + tendencia (auth)
//	GET  /v1/me/readiness                 preparación operativa por cert (auth)
//	POST /v1/questions                    crear pregunta (admin)
func NewRouter(opts Options) http.Handler {
	api := &API{
		preguntas:     opts.Preguntas,
		sesiones:      opts.Sesiones,
		logger:        opts.Logger,
		numPorDefecto: opts.NumPorDefecto,
	}

	health := httpx.NewHealth(opts.Service, opts.Version,
		httpx.Check{Name: "mongodb", Probe: func(ctx context.Context) error { return opts.Preguntas.PingMongo(ctx) }},
		httpx.Check{Name: "postgres", Probe: func(ctx context.Context) error { return opts.Sesiones.PingPostgres(ctx) }},
	)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", health.Liveness)
	mux.HandleFunc("GET /v1/ready", health.Readiness)

	// RLS por petición (no-op si RLSEnabled=false) en las rutas que tocan Postgres
	// (sesiones/intentos). /v1/questions es admin sobre Mongo: no aplica.
	rls := postgres.RLSTx(opts.Pool, opts.RLSEnabled, subjectOf)

	mux.Handle("POST /v1/exams/sessions", authGate(opts.Auth, rls(http.HandlerFunc(api.crearSesion))))
	mux.Handle("POST /v1/exams/sessions/{id}/submit", authGate(opts.Auth, rls(http.HandlerFunc(api.enviar))))
	mux.Handle("GET /v1/exams/sessions/{id}", authGate(opts.Auth, rls(http.HandlerFunc(api.obtenerSesion))))
	mux.Handle("GET /v1/me/exams", authGate(opts.Auth, rls(http.HandlerFunc(api.listarMias))))
	mux.Handle("GET /v1/me/analytics", authGate(opts.Auth, rls(http.HandlerFunc(api.analitica))))
	mux.Handle("GET /v1/me/readiness", authGate(opts.Auth, rls(http.HandlerFunc(api.readiness))))
	mux.Handle("POST /v1/questions", adminGate(opts.Auth, http.HandlerFunc(api.crearPregunta)))

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

func adminGate(authn *auth.Authenticator, next http.Handler) http.Handler {
	if authn == nil {
		return gateCerrado()
	}
	return authn.Middleware(auth.RequireRole("admin")(next))
}

func gateCerrado() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteError(w, http.StatusNotImplemented, "auth_no_disponible",
			"esta ruta requiere OIDC configurado (EXAMS_OIDC_ISSUER)")
	})
}

// subjectOf extrae el `sub` del usuario autenticado del context (lo coloca el auth);
// "" si la petición no pasó por auth, en cuyo caso RLSTx no abre transacción.
func subjectOf(ctx context.Context) string {
	if id, ok := auth.IdentityFromContext(ctx); ok {
		return id.Subject
	}
	return ""
}
