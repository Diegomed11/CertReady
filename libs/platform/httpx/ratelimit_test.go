package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// rps=0 → sin recarga: el bucket solo permite el burst inicial (determinista).

func TestRateLimitBurstThen429(t *testing.T) {
	h := RateLimit(0, 3)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	call := func() int {
		req := httptest.NewRequest(http.MethodGet, "/v1/x", nil)
		req.RemoteAddr = "10.0.0.1:1234"
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	for i := 0; i < 3; i++ {
		if code := call(); code != http.StatusOK {
			t.Fatalf("petición %d: esperaba 200, obtuvo %d", i+1, code)
		}
	}
	if code := call(); code != http.StatusTooManyRequests {
		t.Fatalf("esperaba 429 tras agotar el burst, obtuvo %d", code)
	}
}

func TestRateLimitExemptsHealth(t *testing.T) {
	h := RateLimit(0, 1)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
		req.RemoteAddr = "10.0.0.2:1"
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("/v1/health no debe limitarse; obtuvo %d", rec.Code)
		}
	}
}

func TestRateLimitPerIP(t *testing.T) {
	h := RateLimit(0, 1)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	call := func(ip string) int {
		req := httptest.NewRequest(http.MethodGet, "/v1/x", nil)
		req.RemoteAddr = ip + ":1"
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	if call("1.1.1.1") != http.StatusOK {
		t.Fatal("la primera IP debe pasar")
	}
	if call("2.2.2.2") != http.StatusOK {
		t.Fatal("una IP distinta debe pasar (cupo independiente por IP)")
	}
	if call("1.1.1.1") != http.StatusTooManyRequests {
		t.Fatal("la primera IP, ya agotada, debe dar 429")
	}
}
