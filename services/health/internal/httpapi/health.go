package httpapi

import (
	"encoding/json"
	"net/http"
	"time"
)

// nowFunc es la fuente de tiempo del paquete. Es una variable (y no una llamada
// directa a time.Now) para poder fijarla de forma determinista en los tests.
var nowFunc = time.Now

// ReadinessCheck es una comprobación nombrada de la que depende la disponibilidad
// del servicio (p. ej. conectividad con Postgres o Mongo en servicios futuros).
//
// Devuelve nil si la dependencia está sana, o un error describiendo el fallo. El
// servicio health no tiene dependencias, por lo que su lista de checks va vacía;
// el contrato existe para que los servicios de negocio lo reutilicen.
type ReadinessCheck struct {
	Name  string
	Check func() error
}

// healthHandler implementa las sondas de salud del servicio.
//
// service y version se incluyen en la respuesta para identificar sin ambigüedad
// qué instancia/imagen respondió, dato útil durante despliegues blue/green.
type healthHandler struct {
	service string
	version string
	checks  []ReadinessCheck
}

// statusPayload es el envoltorio JSON común de las respuestas de salud.
//
// Checks contiene el resultado por dependencia y se omite cuando está vacío para
// no ensuciar la respuesta del servicio sin dependencias.
type statusPayload struct {
	Status  string            `json:"status"`
	Service string            `json:"service"`
	Version string            `json:"version"`
	Time    string            `json:"time"`
	Checks  map[string]string `json:"checks,omitempty"`
}

// liveness responde a GET /v1/health.
//
// Indica únicamente que el proceso está vivo y atendiendo: no consulta
// dependencias, por lo que siempre devuelve 200 mientras el servidor corra. Es
// la sonda que ECS usa para decidir reinicios.
func (h *healthHandler) liveness(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, statusPayload{
		Status:  "ok",
		Service: h.service,
		Version: h.version,
		Time:    nowFunc().UTC().Format(time.RFC3339),
	})
}

// readiness responde a GET /v1/ready.
//
// Ejecuta todas las comprobaciones registradas y devuelve 200 solo si todas
// pasan; si alguna falla, responde 503 con el detalle por dependencia, que es la
// señal por la que el balanceador deja de enviar tráfico a la instancia.
func (h *healthHandler) readiness(w http.ResponseWriter, _ *http.Request) {
	results := make(map[string]string, len(h.checks))
	ready := true
	for _, c := range h.checks {
		if err := c.Check(); err != nil {
			results[c.Name] = err.Error()
			ready = false
			continue
		}
		results[c.Name] = "ok"
	}

	status := http.StatusOK
	label := "ready"
	if !ready {
		status = http.StatusServiceUnavailable
		label = "not_ready"
	}

	writeJSON(w, status, statusPayload{
		Status:  label,
		Service: h.service,
		Version: h.version,
		Time:    nowFunc().UTC().Format(time.RFC3339),
		Checks:  results,
	})
}

// writeJSON serializa payload como JSON y lo escribe con el código de estado
// indicado y el Content-Type apropiado.
//
// El estado se fija antes de escribir el cuerpo porque WriteHeader debe llamarse
// una sola vez y antes de cualquier escritura. Un error de codificación se
// ignora deliberadamente: la cabecera ya se envió y no hay forma de corregir la
// respuesta a medio camino.
func writeJSON(w http.ResponseWriter, status int, payload statusPayload) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
