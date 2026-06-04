package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/auth/authtest"

	"github.com/certready/certready/services/users/internal/users"
)

const (
	issuer  = "https://issuer.test"
	aud     = "users-api"
	subTest = "11111111-1111-1111-1111-111111111111"
)

// fakeStore implementa UserStore con campos función configurables.
type fakeStore struct {
	provision  func(context.Context, string, string, *string, string) (users.Usuario, error)
	perfil     func(context.Context, string) (users.Perfil, error)
	actualizar func(context.Context, string, users.ActualizarPerfil) (users.Usuario, users.Perfil, error)
	listar     func(context.Context, int, int) ([]users.Usuario, error)
}

func (f *fakeStore) Ping(context.Context) error { return nil }
func (f *fakeStore) ObtenerOProvisionar(ctx context.Context, id, email string, nombre *string, rol string) (users.Usuario, error) {
	if f.provision != nil {
		return f.provision(ctx, id, email, nombre, rol)
	}
	return users.Usuario{ID: id, Email: email, Nombre: nombre, Rol: rol}, nil
}
func (f *fakeStore) ObtenerPerfil(ctx context.Context, id string) (users.Perfil, error) {
	if f.perfil != nil {
		return f.perfil(ctx, id)
	}
	return users.Perfil{UsuarioID: id}, nil
}
func (f *fakeStore) ActualizarCuenta(ctx context.Context, id string, in users.ActualizarPerfil) (users.Usuario, users.Perfil, error) {
	return f.actualizar(ctx, id, in)
}
func (f *fakeStore) ListarUsuarios(ctx context.Context, limit, offset int) ([]users.Usuario, error) {
	return f.listar(ctx, limit, offset)
}

func nuevoRouter(t *testing.T, fs *fakeStore) (http.Handler, *authtest.Signer) {
	t.Helper()
	signer, err := authtest.NewSigner(issuer)
	if err != nil {
		t.Fatalf("signer: %v", err)
	}
	authn := auth.NewWithKeySet(signer.KeySet(), auth.Config{Issuer: issuer, Audience: aud})
	r := NewRouter(Options{
		Service: "users", Version: "test",
		Logger: slog.New(slog.NewJSONHandler(io.Discard, nil)),
		Store:  fs, Auth: authn,
	})
	return r, signer
}

func token(t *testing.T, s *authtest.Signer, c authtest.Claims) string {
	t.Helper()
	if c.Audience == "" {
		c.Audience = aud
	}
	tok, err := s.Token(c)
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	return tok
}

func TestMeProvisionaYDevuelveCuenta(t *testing.T) {
	r, signer := nuevoRouter(t, &fakeStore{})
	tok := token(t, signer, authtest.Claims{Subject: subTest, Email: "a@b.co", Groups: []string{"admin"}})

	req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; quería 200", rec.Code)
	}
	var c users.Cuenta
	if err := json.Unmarshal(rec.Body.Bytes(), &c); err != nil {
		t.Fatalf("JSON inválido: %v", err)
	}
	if c.ID != subTest || c.Email != "a@b.co" || c.Rol != "admin" {
		t.Errorf("cuenta inesperada: %+v", c.Usuario)
	}
}

func TestMeSinToken401(t *testing.T) {
	r, _ := nuevoRouter(t, &fakeStore{})
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/me", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d; quería 401", rec.Code)
	}
}

func TestListarUsuariosRequiereAdmin(t *testing.T) {
	fs := &fakeStore{
		listar: func(context.Context, int, int) ([]users.Usuario, error) {
			return []users.Usuario{{ID: subTest, Email: "a@b.co", Rol: "estudiante"}}, nil
		},
	}
	r, signer := nuevoRouter(t, fs)

	tests := []struct {
		name       string
		groups     []string
		withToken  bool
		wantStatus int
	}{
		{"sin token", nil, false, http.StatusUnauthorized},
		{"estudiante", []string{"estudiante"}, true, http.StatusForbidden},
		{"admin", []string{"admin"}, true, http.StatusOK},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/v1/users", nil)
			if tt.withToken {
				req.Header.Set("Authorization", "Bearer "+token(t, signer, authtest.Claims{Subject: subTest, Groups: tt.groups}))
			}
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d; quería %d", rec.Code, tt.wantStatus)
			}
		})
	}
}

// TestRutasProtegidasSinAuth verifica que sin autenticador las rutas protegidas
// responden 501 (no quedan abiertas).
func TestRutasProtegidasSinAuth(t *testing.T) {
	r := NewRouter(Options{
		Service: "users", Version: "test",
		Logger: slog.New(slog.NewJSONHandler(io.Discard, nil)),
		Store:  &fakeStore{}, Auth: nil,
	})
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/me", nil))
	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("status = %d; quería 501", rec.Code)
	}
}
