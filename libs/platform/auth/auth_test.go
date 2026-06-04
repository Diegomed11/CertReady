package auth_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/auth/authtest"
)

const issuer = "https://issuer.test/certready"
const audience = "certready-api"

func nuevoAuth(t *testing.T) (*auth.Authenticator, *authtest.Signer) {
	t.Helper()
	signer, err := authtest.NewSigner(issuer)
	if err != nil {
		t.Fatalf("crear signer: %v", err)
	}
	return auth.NewWithKeySet(signer.KeySet(), auth.Config{Issuer: issuer, Audience: audience}), signer
}

func TestVerifyTokenValido(t *testing.T) {
	a, signer := nuevoAuth(t)
	tok, err := signer.Token(authtest.Claims{
		Subject: "user-1", Email: "a@b.co", Groups: []string{"admin"}, Audience: audience,
	})
	if err != nil {
		t.Fatalf("firmar: %v", err)
	}

	id, err := a.Verify(context.Background(), tok)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if id.Subject != "user-1" || id.Email != "a@b.co" {
		t.Errorf("identidad inesperada: %+v", id)
	}
	if !id.HasRole("admin") {
		t.Error("se esperaba el rol admin")
	}
}

func TestVerifyRechaza(t *testing.T) {
	a, signer := nuevoAuth(t)

	tests := []struct {
		name   string
		claims authtest.Claims
		raw    string // si != "", se usa en vez de firmar claims
	}{
		{name: "expirado", claims: authtest.Claims{Subject: "u", Audience: audience, Expira: -time.Hour}},
		{name: "audiencia incorrecta", claims: authtest.Claims{Subject: "u", Audience: "otra-api"}},
		{name: "token basura", raw: "no.es.un.jwt"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			raw := tt.raw
			if raw == "" {
				var err error
				raw, err = signer.Token(tt.claims)
				if err != nil {
					t.Fatalf("firmar: %v", err)
				}
			}
			if _, err := a.Verify(context.Background(), raw); err == nil {
				t.Fatal("se esperaba error de validación, se obtuvo nil")
			}
		})
	}
}

// TestVerifyRechazaOtroEmisor: un token firmado por otra clave (otro emisor) no
// debe validar contra nuestro KeySet.
func TestVerifyRechazaOtraClave(t *testing.T) {
	a, _ := nuevoAuth(t)
	otro, err := authtest.NewSigner(issuer)
	if err != nil {
		t.Fatal(err)
	}
	tok, err := otro.Token(authtest.Claims{Subject: "u", Audience: audience})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := a.Verify(context.Background(), tok); err == nil {
		t.Fatal("un token de otra clave no debería validar")
	}
}

func TestMiddlewareYRequireRole(t *testing.T) {
	a, signer := nuevoAuth(t)

	// Handler final: solo accesible con rol admin.
	final := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	protegido := a.Middleware(auth.RequireRole("admin")(final))

	token := func(groups ...string) string {
		tok, err := signer.Token(authtest.Claims{Subject: "u", Audience: audience, Groups: groups})
		if err != nil {
			t.Fatalf("firmar: %v", err)
		}
		return tok
	}

	tests := []struct {
		name       string
		authHeader string
		wantStatus int
	}{
		{"sin token", "", http.StatusUnauthorized},
		{"token inválido", "Bearer basura", http.StatusUnauthorized},
		{"válido sin rol admin", "Bearer " + token("estudiante"), http.StatusForbidden},
		{"válido con rol admin", "Bearer " + token("admin"), http.StatusOK},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/protegido", nil)
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}
			rec := httptest.NewRecorder()
			protegido.ServeHTTP(rec, req)
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d; quería %d", rec.Code, tt.wantStatus)
			}
		})
	}
}
