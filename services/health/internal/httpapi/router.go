package httpapi

import (
	"log/slog"
	"net/http"
)

// Options agrupa las dependencias necesarias para construir el router.
//
// Checks es la lista de comprobaciones de readiness; vacía en el servicio health.
type Options struct {
	Service string
	Version string
	Logger  *slog.Logger
	Checks  []ReadinessCheck
}

// NewRouter construye el http.Handler raíz del servicio con sus rutas y la
// cadena de middleware transversal ya aplicada.
//
// Parameters
//
//	opts : dependencias del router (servicio, versión, logger y checks).
//
// Returns
//
//	http.Handler : handler listo para montar en un http.Server.
//
// Rutas registradas (API versionada bajo /v1, según la convención del proyecto):
//
//	GET /v1/health : liveness — el proceso está vivo.
//	GET /v1/ready  : readiness — el servicio y sus dependencias están listos.
//
// Orden de middleware (de fuera hacia dentro): recover → request-id → access-log.
// El recover queda más externo para capturar también panics originados en el
// resto de la cadena.
func NewRouter(opts Options) http.Handler {
	h := &healthHandler{
		service: opts.Service,
		version: opts.Version,
		checks:  opts.Checks,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", h.liveness)
	mux.HandleFunc("GET /v1/ready", h.readiness)

	var handler http.Handler = mux
	handler = withAccessLog(opts.Logger, handler)
	handler = withRequestID(handler)
	handler = withRecover(opts.Logger, handler)
	return handler
}
