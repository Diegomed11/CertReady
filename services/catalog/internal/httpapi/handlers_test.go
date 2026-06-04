package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/auth/authtest"

	"github.com/certready/certready/services/catalog/internal/catalog"
	"github.com/certready/certready/services/catalog/internal/store"
)

// fakeStore es un doble en memoria de CatalogStore. Cada método delega en un
// campo función configurable por test; si es nil, devuelve el valor cero.
type fakeStore struct {
	ping       func(context.Context) error
	listCerts  func(context.Context, store.FiltroCertificaciones) ([]catalog.Certificacion, error)
	getCert    func(context.Context, string) (catalog.Certificacion, error)
	createCert func(context.Context, catalog.NuevaCertificacion) (catalog.Certificacion, error)
	listTemas  func(context.Context, string) ([]catalog.Tema, error)
	getTema    func(context.Context, string) (catalog.Tema, error)
	listPistas func(context.Context, store.FiltroPistas) ([]catalog.Pista, error)
	getPista   func(context.Context, string) (catalog.Pista, error)
}

func (f *fakeStore) Ping(ctx context.Context) error {
	if f.ping != nil {
		return f.ping(ctx)
	}
	return nil
}

func (f *fakeStore) ListarCertificaciones(ctx context.Context, fl store.FiltroCertificaciones) ([]catalog.Certificacion, error) {
	return f.listCerts(ctx, fl)
}
func (f *fakeStore) ObtenerCertificacion(ctx context.Context, s string) (catalog.Certificacion, error) {
	return f.getCert(ctx, s)
}
func (f *fakeStore) CrearCertificacion(ctx context.Context, n catalog.NuevaCertificacion) (catalog.Certificacion, error) {
	return f.createCert(ctx, n)
}
func (f *fakeStore) ListarTemasDeCertificacion(ctx context.Context, id string) ([]catalog.Tema, error) {
	return f.listTemas(ctx, id)
}
func (f *fakeStore) ObtenerTema(ctx context.Context, id string) (catalog.Tema, error) {
	return f.getTema(ctx, id)
}
func (f *fakeStore) ListarPistas(ctx context.Context, fl store.FiltroPistas) ([]catalog.Pista, error) {
	return f.listPistas(ctx, fl)
}
func (f *fakeStore) ObtenerPista(ctx context.Context, s string) (catalog.Pista, error) {
	return f.getPista(ctx, s)
}

func newTestRouter(fs *fakeStore) http.Handler {
	return NewRouter(Options{
		Service: "catalog",
		Version: "test",
		Logger:  slog.New(slog.NewJSONHandler(io.Discard, nil)),
		Store:   fs,
	})
}

func do(t *testing.T, h http.Handler, method, target string, body string) *httptest.ResponseRecorder {
	t.Helper()
	var r *http.Request
	if body != "" {
		r = httptest.NewRequest(method, target, strings.NewReader(body))
	} else {
		r = httptest.NewRequest(method, target, nil)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, r)
	return rec
}

func TestListarCertificaciones(t *testing.T) {
	fs := &fakeStore{
		listCerts: func(context.Context, store.FiltroCertificaciones) ([]catalog.Certificacion, error) {
			return []catalog.Certificacion{
				{ID: "1", Slug: "aws-saa", Nombre: "AWS SAA", Proveedor: "AWS", Nivel: "associate", Activo: true},
			}, nil
		},
	}
	rec := do(t, newTestRouter(fs), http.MethodGet, "/v1/certifications?proveedor=AWS", "")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; quería 200", rec.Code)
	}
	var body struct {
		Data  []catalog.Certificacion `json:"data"`
		Count int                     `json:"count"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("JSON inválido: %v", err)
	}
	if body.Count != 1 || len(body.Data) != 1 || body.Data[0].Slug != "aws-saa" {
		t.Errorf("respuesta inesperada: %+v", body)
	}
}

func TestListarCertificaciones_LimitInvalido(t *testing.T) {
	rec := do(t, newTestRouter(&fakeStore{}), http.MethodGet, "/v1/certifications?limit=abc", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d; quería 400", rec.Code)
	}
}

func TestObtenerCertificacion(t *testing.T) {
	tests := []struct {
		name       string
		getCert    func(context.Context, string) (catalog.Certificacion, error)
		wantStatus int
	}{
		{"encontrada", func(context.Context, string) (catalog.Certificacion, error) {
			return catalog.Certificacion{ID: "1", Slug: "aws-saa"}, nil
		}, http.StatusOK},
		{"no encontrada", func(context.Context, string) (catalog.Certificacion, error) {
			return catalog.Certificacion{}, store.ErrNotFound
		}, http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fs := &fakeStore{getCert: tt.getCert}
			rec := do(t, newTestRouter(fs), http.MethodGet, "/v1/certifications/aws-saa", "")
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d; quería %d", rec.Code, tt.wantStatus)
			}
		})
	}
}

// TestCrearCertificacionSinAuth verifica que, sin OIDC configurado, la ruta de
// escritura admin queda cerrada con 501 (no expuesta).
func TestCrearCertificacionSinAuth(t *testing.T) {
	body := `{"slug":"x","nombre":"X","proveedor":"AWS","nivel":"associate"}`
	rec := do(t, newTestRouter(&fakeStore{}), http.MethodPost, "/v1/certifications", body)
	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("status = %d; quería 501 (gated sin auth)", rec.Code)
	}
}

// TestCrearCertificacionConAuth verifica la autorización admin de la ruta de
// escritura cuando hay OIDC configurado: sin token 401, sin rol admin 403, con
// rol admin 201.
func TestCrearCertificacionConAuth(t *testing.T) {
	const issuer, aud = "https://issuer.test", "catalog-api"
	signer, err := authtest.NewSigner(issuer)
	if err != nil {
		t.Fatalf("signer: %v", err)
	}
	authn := auth.NewWithKeySet(signer.KeySet(), auth.Config{Issuer: issuer, Audience: aud})

	fs := &fakeStore{
		createCert: func(_ context.Context, n catalog.NuevaCertificacion) (catalog.Certificacion, error) {
			return catalog.Certificacion{ID: "1", Slug: n.Slug, Nombre: n.Nombre, Proveedor: n.Proveedor, Nivel: n.Nivel}, nil
		},
	}
	router := NewRouter(Options{
		Service: "catalog", Version: "test",
		Logger: slog.New(slog.NewJSONHandler(io.Discard, nil)),
		Store:  fs, Auth: authn,
	})

	token := func(groups ...string) string {
		tok, err := signer.Token(authtest.Claims{Subject: "u", Audience: aud, Groups: groups})
		if err != nil {
			t.Fatalf("token: %v", err)
		}
		return tok
	}
	body := `{"slug":"aws-saa","nombre":"AWS SAA","proveedor":"AWS","nivel":"associate"}`

	tests := []struct {
		name       string
		authHeader string
		wantStatus int
	}{
		{"sin token", "", http.StatusUnauthorized},
		{"sin rol admin", "Bearer " + token("estudiante"), http.StatusForbidden},
		{"con rol admin", "Bearer " + token("admin"), http.StatusCreated},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/v1/certifications", strings.NewReader(body))
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d; quería %d", rec.Code, tt.wantStatus)
			}
		})
	}
}

func TestReadinessSegunPing(t *testing.T) {
	tests := []struct {
		name       string
		ping       func(context.Context) error
		wantStatus int
	}{
		{"db ok", func(context.Context) error { return nil }, http.StatusOK},
		{"db caída", func(context.Context) error { return context.DeadlineExceeded }, http.StatusServiceUnavailable},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, newTestRouter(&fakeStore{ping: tt.ping}), http.MethodGet, "/v1/ready", "")
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d; quería %d", rec.Code, tt.wantStatus)
			}
		})
	}
}
