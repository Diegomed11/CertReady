package httpx

import (
	"context"
	"net/http"
	"time"
)

// nowFunc es la fuente de tiempo del paquete. Es una variable para poder fijarla
// de forma determinista en los tests.
var nowFunc = time.Now

// Check es una comprobación de readiness nombrada de la que depende la
// disponibilidad de un servicio (p. ej. conectividad con Postgres).
//
// Probe devuelve nil si la dependencia está sana, o un error describiendo el
// fallo. Recibe un context para poder acotar el tiempo de la comprobación.
type Check struct {
	Name  string
	Probe func(ctx context.Context) error
}

// Health implementa las sondas de salud de un servicio.
type Health struct {
	service string
	version string
	checks  []Check
}

// NewHealth construye el manejador de salud con su lista de comprobaciones de
// readiness (vacía si el servicio no tiene dependencias).
func NewHealth(service, version string, checks ...Check) *Health {
	return &Health{service: service, version: version, checks: checks}
}

type healthPayload struct {
	Status  string            `json:"status"`
	Service string            `json:"service"`
	Version string            `json:"version"`
	Time    string            `json:"time"`
	Checks  map[string]string `json:"checks,omitempty"`
}

// Liveness responde a GET /v1/health: indica solo que el proceso está vivo y
// atendiendo. No consulta dependencias, así que siempre devuelve 200.
func (h *Health) Liveness(w http.ResponseWriter, _ *http.Request) {
	WriteJSON(w, http.StatusOK, healthPayload{
		Status:  "ok",
		Service: h.service,
		Version: h.version,
		Time:    nowFunc().UTC().Format(time.RFC3339),
	})
}

// Readiness responde a GET /v1/ready: ejecuta todas las comprobaciones y
// devuelve 200 solo si todas pasan; si alguna falla, 503 con el detalle por
// dependencia (señal por la que un balanceador deja de enviar tráfico).
func (h *Health) Readiness(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	results := make(map[string]string, len(h.checks))
	ready := true
	for _, c := range h.checks {
		if err := c.Probe(ctx); err != nil {
			results[c.Name] = err.Error()
			ready = false
			continue
		}
		results[c.Name] = "ok"
	}

	status, label := http.StatusOK, "ready"
	if !ready {
		status, label = http.StatusServiceUnavailable, "not_ready"
	}

	WriteJSON(w, status, healthPayload{
		Status:  label,
		Service: h.service,
		Version: h.version,
		Time:    nowFunc().UTC().Format(time.RFC3339),
		Checks:  results,
	})
}
