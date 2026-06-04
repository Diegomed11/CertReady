package httpapi_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/auth/authtest"

	"github.com/certready/certready/services/enrollments/internal/catalogclient"
	"github.com/certready/certready/services/enrollments/internal/enrollments"
	"github.com/certready/certready/services/enrollments/internal/httpapi"
	"github.com/certready/certready/services/enrollments/internal/store"
)

// TestEnd2End_FlujoCompleto ejerce el servicio completo SIN base de datos, con
// dependencias reales por HTTP: un emisor OIDC mock con discovery + JWKS reales
// y un servidor mock de catalog. El router se construye con el cliente OIDC
// real (auth.New) y el cliente HTTP real de catalog (catalogclient.New).
//
// Si este test pasa, el servicio funciona tal cual en producción cambiando solo
// la URL del emisor OIDC (Cognito) y la URL de catalog.
func TestEnd2End_FlujoCompleto(t *testing.T) {
	// 1) Firmador y emisor OIDC mock con discovery + JWKS HTTP.
	signer, err := authtest.NewSigner("placeholder")
	if err != nil {
		t.Fatalf("signer: %v", err)
	}

	var issuerURL string
	oidcMux := http.NewServeMux()
	oidcMux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issuer":   issuerURL,
			"jwks_uri": issuerURL + "/jwks",
		})
	})
	oidcMux.HandleFunc("/jwks", func(w http.ResponseWriter, _ *http.Request) {
		pub := signer.PublicKey()
		n := base64.RawURLEncoding.EncodeToString(pub.N.Bytes())
		e := base64.RawURLEncoding.EncodeToString(new(big.Int).SetInt64(int64(pub.E)).Bytes())
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]any{
				{"kty": "RSA", "alg": "RS256", "use": "sig", "kid": "test", "n": n, "e": e},
			},
		})
	})
	oidcSrv := httptest.NewServer(oidcMux)
	defer oidcSrv.Close()
	issuerURL = oidcSrv.URL
	signer.Issuer = issuerURL

	// 2) Catalog mock: una certificación existe; las demás no.
	const objOK = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	const objMissing = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
	catSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/certifications/"+objOK {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer catSrv.Close()

	// 3) Autenticador OIDC real (discovery contra el mock).
	const aud = "ent-api"
	authn, err := auth.New(context.Background(), auth.Config{Issuer: issuerURL, Audience: aud})
	if err != nil {
		t.Fatalf("descubrir OIDC mock: %v", err)
	}

	// 4) Router con store en memoria y cliente HTTP real hacia catalog.
	st := newMemStore()
	router := httpapi.NewRouter(httpapi.Options{
		Service: "enrollments", Version: "e2e",
		Logger:  slog.New(slog.NewJSONHandler(io.Discard, nil)),
		Store:   st,
		Catalog: catalogclient.New(catSrv.URL, 2*time.Second),
		Auth:    authn,
	})

	tokenA := emitir(t, signer, "user-a", aud)
	tokenB := emitir(t, signer, "user-b", aud)

	// --- Casos de uso end-to-end ---

	// (1) Crear inscripción con objetivo válido → 201.
	if rec := do(router, "POST", "/v1/enrollments", body(objOK), tokenA); rec.Code != http.StatusCreated {
		t.Fatalf("crear válido: status %d (%s)", rec.Code, rec.Body.String())
	}

	// (2) Crear con objetivo inexistente → 422 (validado contra catalog real).
	if rec := do(router, "POST", "/v1/enrollments", body(objMissing), tokenA); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("objetivo inexistente: status %d", rec.Code)
	}

	// (3) Duplicar la misma inscripción → 409.
	if rec := do(router, "POST", "/v1/enrollments", body(objOK), tokenA); rec.Code != http.StatusConflict {
		t.Fatalf("duplicada: status %d", rec.Code)
	}

	// (4) user-a ve 1 inscripción propia; user-b ve 0 (anti-IDOR).
	var listaA, listaB struct {
		Data []enrollments.Inscripcion `json:"data"`
	}
	mustDecode(t, do(router, "GET", "/v1/me/enrollments", "", tokenA), &listaA)
	mustDecode(t, do(router, "GET", "/v1/me/enrollments", "", tokenB), &listaB)
	if len(listaA.Data) != 1 || len(listaB.Data) != 0 {
		t.Fatalf("listas: A=%d B=%d; quería A=1 B=0", len(listaA.Data), len(listaB.Data))
	}

	idAjeno := listaA.Data[0].ID

	// (5) user-b intenta borrar la de user-a → 404 (BOLA cubierto, sin filtrar existencia).
	if rec := do(router, "DELETE", "/v1/enrollments/"+idAjeno, "", tokenB); rec.Code != http.StatusNotFound {
		t.Fatalf("DELETE ajeno: status %d; quería 404", rec.Code)
	}

	// (6) user-a borra la suya → 204.
	if rec := do(router, "DELETE", "/v1/enrollments/"+idAjeno, "", tokenA); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE propia: status %d", rec.Code)
	}

	// (7) Token con audiencia incorrecta → 401 (defensa "manipulación de JWT").
	tokenMalAud := emitir(t, signer, "user-a", "otra-api")
	if rec := do(router, "GET", "/v1/me/enrollments", "", tokenMalAud); rec.Code != http.StatusUnauthorized {
		t.Fatalf("aud incorrecta: status %d; quería 401", rec.Code)
	}
}

// --- helpers ---------------------------------------------------------------

func emitir(t *testing.T, s *authtest.Signer, sub, aud string) string {
	t.Helper()
	tok, err := s.Token(authtest.Claims{Subject: sub, Audience: aud})
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	return tok
}

func body(objID string) string {
	return `{"tipo_objetivo":"certificacion","objetivo_id":"` + objID + `"}`
}

func do(h http.Handler, method, path, body, token string) *httptest.ResponseRecorder {
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func mustDecode(t *testing.T, rec *httptest.ResponseRecorder, dst any) {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d (%s)", rec.Code, rec.Body.String())
	}
	if err := json.Unmarshal(rec.Body.Bytes(), dst); err != nil {
		t.Fatalf("decode: %v", err)
	}
}

// --- memStore: doble del EnrollmentStore para el e2e -----------------------

type memStore struct {
	datos map[string]enrollments.Inscripcion
	seq   int
}

func newMemStore() *memStore { return &memStore{datos: map[string]enrollments.Inscripcion{}} }

func (m *memStore) Ping(context.Context) error { return nil }

func (m *memStore) Crear(_ context.Context, usuarioID string, n enrollments.NuevaInscripcion) (enrollments.Inscripcion, error) {
	for _, v := range m.datos {
		if v.UsuarioID == usuarioID && v.TipoObjetivo == n.TipoObjetivo && v.ObjetivoID == n.ObjetivoID {
			return enrollments.Inscripcion{}, store.ErrConflict
		}
	}
	m.seq++
	id := nuevoID(m.seq)
	ins := enrollments.Inscripcion{
		ID: id, UsuarioID: usuarioID, TipoObjetivo: n.TipoObjetivo,
		ObjetivoID: n.ObjetivoID, Estado: enrollments.EstadoActiva,
	}
	m.datos[id] = ins
	return ins, nil
}

func (m *memStore) ListarDeUsuario(_ context.Context, usuarioID string, _ store.FiltroDeUsuario) ([]enrollments.Inscripcion, error) {
	var out []enrollments.Inscripcion
	for _, v := range m.datos {
		if v.UsuarioID == usuarioID {
			out = append(out, v)
		}
	}
	return out, nil
}

func (m *memStore) CambiarEstadoDeUsuario(_ context.Context, usuarioID, id string, e enrollments.Estado) (enrollments.Inscripcion, error) {
	v, ok := m.datos[id]
	if !ok || v.UsuarioID != usuarioID {
		return enrollments.Inscripcion{}, store.ErrNotFound
	}
	v.Estado = e
	m.datos[id] = v
	return v, nil
}

func (m *memStore) EliminarDeUsuario(_ context.Context, usuarioID, id string) error {
	v, ok := m.datos[id]
	if !ok || v.UsuarioID != usuarioID {
		return store.ErrNotFound
	}
	delete(m.datos, id)
	return nil
}

// nuevoID produce un UUID-like determinista a partir de un contador.
func nuevoID(seq int) string {
	const tpl = "00000000-0000-0000-0000-000000000000"
	s := []byte(tpl)
	for i := len(s) - 1; i >= 0 && seq > 0; i-- {
		if s[i] == '-' {
			continue
		}
		d := seq % 16
		if d < 10 {
			s[i] = byte('0' + d)
		} else {
			s[i] = byte('a' + d - 10)
		}
		seq /= 16
	}
	return string(s)
}
