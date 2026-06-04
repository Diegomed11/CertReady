package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// newTestRouter construye un router con tiempo fijo y logger silencioso para que
// las aserciones sean deterministas y los tests no ensucien la salida.
func newTestRouter(t *testing.T, checks []ReadinessCheck) http.Handler {
	t.Helper()
	prev := nowFunc
	nowFunc = func() time.Time { return time.Date(2026, 6, 3, 12, 0, 0, 0, time.UTC) }
	t.Cleanup(func() { nowFunc = prev })

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	return NewRouter(Options{Service: "health", Version: "test", Logger: logger, Checks: checks})
}

// do ejecuta una petición contra el router y devuelve la respuesta grabada.
func do(t *testing.T, router http.Handler, method, path string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(method, path, nil))
	return rec
}

// TestHealthEndpoints cubre liveness y readiness, incluyendo readiness degradada
// cuando una dependencia falla.
func TestHealthEndpoints(t *testing.T) {
	failing := []ReadinessCheck{
		{Name: "ok_dep", Check: func() error { return nil }},
		{Name: "bad_dep", Check: func() error { return errors.New("sin conexión") }},
	}

	tests := []struct {
		name       string
		method     string
		path       string
		checks     []ReadinessCheck
		wantStatus int
		wantLabel  string
	}{
		{"liveness siempre ok", http.MethodGet, "/v1/health", nil, http.StatusOK, "ok"},
		{"readiness sin checks", http.MethodGet, "/v1/ready", nil, http.StatusOK, "ready"},
		{"readiness con checks ok", http.MethodGet, "/v1/ready",
			[]ReadinessCheck{{Name: "db", Check: func() error { return nil }}},
			http.StatusOK, "ready"},
		{"readiness con check fallido", http.MethodGet, "/v1/ready", failing,
			http.StatusServiceUnavailable, "not_ready"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := newTestRouter(t, tt.checks)
			rec := do(t, router, tt.method, tt.path)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d; quería %d", rec.Code, tt.wantStatus)
			}

			var body statusPayload
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("respuesta no es JSON válido: %v", err)
			}
			if body.Status != tt.wantLabel {
				t.Errorf("status JSON = %q; quería %q", body.Status, tt.wantLabel)
			}
			if body.Service != "health" {
				t.Errorf("service = %q; quería %q", body.Service, "health")
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
				t.Errorf("Content-Type = %q; quería JSON", ct)
			}
		})
	}
}

// TestReadinessReportaDependenciaFallida verifica que el detalle por dependencia
// llega en el cuerpo, no solo el estado agregado.
func TestReadinessReportaDependenciaFallida(t *testing.T) {
	checks := []ReadinessCheck{{Name: "mongo", Check: func() error { return errors.New("timeout") }}}
	router := newTestRouter(t, checks)

	rec := do(t, router, http.MethodGet, "/v1/ready")

	var body statusPayload
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("respuesta no es JSON válido: %v", err)
	}
	if got := body.Checks["mongo"]; got != "timeout" {
		t.Errorf("checks[mongo] = %q; quería %q", got, "timeout")
	}
}

// TestRequestIDPropagado verifica que el id de correlación se refleja en la
// respuesta: se respeta el provisto por el cliente y se genera uno si falta.
func TestRequestIDPropagado(t *testing.T) {
	router := newTestRouter(t, nil)

	t.Run("genera id cuando falta", func(t *testing.T) {
		rec := do(t, router, http.MethodGet, "/v1/health")
		if rec.Header().Get(requestIDHeader) == "" {
			t.Error("se esperaba un X-Request-ID generado")
		}
	})

	t.Run("respeta id del cliente", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
		req.Header.Set(requestIDHeader, "abc-123")
		router.ServeHTTP(rec, req)
		if got := rec.Header().Get(requestIDHeader); got != "abc-123" {
			t.Errorf("X-Request-ID = %q; quería %q", got, "abc-123")
		}
	})
}
