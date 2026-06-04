package httpx

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func init() {
	// Tiempo fijo para respuestas deterministas en los tests.
	nowFunc = func() time.Time { return time.Date(2026, 6, 3, 12, 0, 0, 0, time.UTC) }
}

func TestLivenessSiempreOK(t *testing.T) {
	h := NewHealth("svc", "test")
	rec := httptest.NewRecorder()
	h.Liveness(rec, httptest.NewRequest(http.MethodGet, "/v1/health", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; quería 200", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("respuesta no es JSON: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("status = %v; quería ok", body["status"])
	}
}

func TestReadiness(t *testing.T) {
	tests := []struct {
		name       string
		checks     []Check
		wantStatus int
		wantLabel  string
	}{
		{"sin checks", nil, http.StatusOK, "ready"},
		{"check ok", []Check{{Name: "db", Probe: func(context.Context) error { return nil }}},
			http.StatusOK, "ready"},
		{"check falla", []Check{{Name: "db", Probe: func(context.Context) error { return errors.New("caída") }}},
			http.StatusServiceUnavailable, "not_ready"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := NewHealth("svc", "test", tt.checks...)
			rec := httptest.NewRecorder()
			h.Readiness(rec, httptest.NewRequest(http.MethodGet, "/v1/ready", nil))

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d; quería %d", rec.Code, tt.wantStatus)
			}
			var body healthPayload
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("respuesta no es JSON: %v", err)
			}
			if body.Status != tt.wantLabel {
				t.Errorf("status = %q; quería %q", body.Status, tt.wantLabel)
			}
		})
	}
}
