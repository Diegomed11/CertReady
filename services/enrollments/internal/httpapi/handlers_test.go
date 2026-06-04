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

	"github.com/certready/certready/services/enrollments/internal/catalogclient"
	"github.com/certready/certready/services/enrollments/internal/enrollments"
	"github.com/certready/certready/services/enrollments/internal/store"
)

const (
	issuer  = "https://issuer.test"
	aud     = "enrollments-api"
	subA    = "11111111-1111-1111-1111-111111111111"
	subB    = "22222222-2222-2222-2222-222222222222"
	objCert = "33333333-3333-3333-3333-333333333333"
	insID   = "44444444-4444-4444-4444-444444444444"
)

// fakeStore es un doble en memoria de EnrollmentStore.
type fakeStore struct {
	crear    func(context.Context, string, enrollments.NuevaInscripcion) (enrollments.Inscripcion, error)
	listar   func(context.Context, string, store.FiltroDeUsuario) ([]enrollments.Inscripcion, error)
	cambiar  func(context.Context, string, string, enrollments.Estado) (enrollments.Inscripcion, error)
	eliminar func(context.Context, string, string) error
}

func (f *fakeStore) Ping(context.Context) error { return nil }
func (f *fakeStore) Crear(ctx context.Context, usuarioID string, n enrollments.NuevaInscripcion) (enrollments.Inscripcion, error) {
	return f.crear(ctx, usuarioID, n)
}
func (f *fakeStore) ListarDeUsuario(ctx context.Context, usuarioID string, fl store.FiltroDeUsuario) ([]enrollments.Inscripcion, error) {
	return f.listar(ctx, usuarioID, fl)
}
func (f *fakeStore) CambiarEstadoDeUsuario(ctx context.Context, usuarioID, id string, e enrollments.Estado) (enrollments.Inscripcion, error) {
	return f.cambiar(ctx, usuarioID, id, e)
}
func (f *fakeStore) EliminarDeUsuario(ctx context.Context, usuarioID, id string) error {
	return f.eliminar(ctx, usuarioID, id)
}

// fakeCatalog es un doble del cliente de catalog. Configura existencia por id.
type fakeCatalog struct {
	certs  map[string]bool
	pistas map[string]bool
	err    error
}

func (f *fakeCatalog) CertificacionExiste(_ context.Context, id string) (bool, error) {
	if f.err != nil {
		return false, f.err
	}
	return f.certs[id], nil
}
func (f *fakeCatalog) PistaExiste(_ context.Context, id string) (bool, error) {
	if f.err != nil {
		return false, f.err
	}
	return f.pistas[id], nil
}

func nuevoRouter(t *testing.T, fs *fakeStore, fc *fakeCatalog) (http.Handler, *authtest.Signer) {
	t.Helper()
	signer, err := authtest.NewSigner(issuer)
	if err != nil {
		t.Fatalf("signer: %v", err)
	}
	authn := auth.NewWithKeySet(signer.KeySet(), auth.Config{Issuer: issuer, Audience: aud})
	if fc == nil {
		fc = &fakeCatalog{}
	}
	r := NewRouter(Options{
		Service: "enrollments", Version: "test",
		Logger: slog.New(slog.NewJSONHandler(io.Discard, nil)),
		Store:  fs, Catalog: fc, Auth: authn,
	})
	return r, signer
}

func tokenDe(t *testing.T, s *authtest.Signer, sub string) string {
	t.Helper()
	tok, err := s.Token(authtest.Claims{Subject: sub, Audience: aud})
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	return tok
}

func TestCrearInscripcion(t *testing.T) {
	bodyOK := `{"tipo_objetivo":"certificacion","objetivo_id":"` + objCert + `"}`

	tests := []struct {
		name       string
		body       string
		catalog    *fakeCatalog
		storeErr   error
		withToken  bool
		wantStatus int
	}{
		{"sin token", bodyOK, &fakeCatalog{certs: map[string]bool{objCert: true}}, nil, false, http.StatusUnauthorized},
		{"validación: tipo desconocido",
			`{"tipo_objetivo":"otro","objetivo_id":"` + objCert + `"}`,
			&fakeCatalog{}, nil, true, http.StatusUnprocessableEntity},
		{"validación: id no UUID",
			`{"tipo_objetivo":"certificacion","objetivo_id":"abc"}`,
			&fakeCatalog{}, nil, true, http.StatusUnprocessableEntity},
		{"objetivo no existe",
			bodyOK,
			&fakeCatalog{certs: map[string]bool{}}, nil, true, http.StatusUnprocessableEntity},
		{"catalog caído",
			bodyOK,
			&fakeCatalog{err: catalogclient.ErrCatalogoNoDisponible}, nil, true, http.StatusServiceUnavailable},
		{"duplicada",
			bodyOK,
			&fakeCatalog{certs: map[string]bool{objCert: true}}, store.ErrConflict, true, http.StatusConflict},
		{"ok",
			bodyOK,
			&fakeCatalog{certs: map[string]bool{objCert: true}}, nil, true, http.StatusCreated},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fs := &fakeStore{
				crear: func(_ context.Context, usuarioID string, n enrollments.NuevaInscripcion) (enrollments.Inscripcion, error) {
					if usuarioID != subA {
						t.Fatalf("usuario_id = %q; quería %q (sub del token)", usuarioID, subA)
					}
					if tt.storeErr != nil {
						return enrollments.Inscripcion{}, tt.storeErr
					}
					return enrollments.Inscripcion{ID: insID, UsuarioID: usuarioID, TipoObjetivo: n.TipoObjetivo, ObjetivoID: n.ObjetivoID, Estado: enrollments.EstadoActiva}, nil
				},
			}
			r, signer := nuevoRouter(t, fs, tt.catalog)

			req := httptest.NewRequest(http.MethodPost, "/v1/enrollments", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			if tt.withToken {
				req.Header.Set("Authorization", "Bearer "+tokenDe(t, signer, subA))
			}
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d; quería %d (body: %s)", rec.Code, tt.wantStatus, rec.Body.String())
			}
		})
	}
}

// TestCrearIgnoraUsuarioIdDelBody comprueba que un cliente NO puede inscribir a
// otro usuario aunque envíe usuario_id en el body: el handler usa siempre el
// sub del token y el campo es desconocido para el DTO (DecodeJSON lo rechaza).
func TestCrearIgnoraUsuarioIdDelBody(t *testing.T) {
	fs := &fakeStore{
		crear: func(_ context.Context, usuarioID string, _ enrollments.NuevaInscripcion) (enrollments.Inscripcion, error) {
			if usuarioID != subA {
				t.Fatalf("se esperaba sub=%q, se pasó %q", subA, usuarioID)
			}
			return enrollments.Inscripcion{ID: insID, UsuarioID: usuarioID}, nil
		},
	}
	fc := &fakeCatalog{certs: map[string]bool{objCert: true}}
	r, signer := nuevoRouter(t, fs, fc)

	// Body con usuario_id ajeno: como el DTO usa DisallowUnknownFields, la
	// petición se rechaza con 400 antes de llegar al store.
	body := `{"tipo_objetivo":"certificacion","objetivo_id":"` + objCert + `","usuario_id":"` + subB + `"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/enrollments", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+tokenDe(t, signer, subA))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d; quería 400 (usuario_id no es un campo aceptado)", rec.Code)
	}
}

func TestListarMiasUsaSubDelToken(t *testing.T) {
	fs := &fakeStore{
		listar: func(_ context.Context, usuarioID string, _ store.FiltroDeUsuario) ([]enrollments.Inscripcion, error) {
			if usuarioID != subA {
				t.Fatalf("usuario_id = %q; quería %q (sub del token)", usuarioID, subA)
			}
			return []enrollments.Inscripcion{{ID: insID, UsuarioID: subA}}, nil
		},
	}
	r, signer := nuevoRouter(t, fs, nil)
	req := httptest.NewRequest(http.MethodGet, "/v1/me/enrollments", nil)
	req.Header.Set("Authorization", "Bearer "+tokenDe(t, signer, subA))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; quería 200", rec.Code)
	}
	var body struct {
		Data  []enrollments.Inscripcion `json:"data"`
		Count int                       `json:"count"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("JSON: %v", err)
	}
	if body.Count != 1 || body.Data[0].UsuarioID != subA {
		t.Errorf("respuesta inesperada: %+v", body)
	}
}

func TestCambiarYEliminarSegunPertenencia(t *testing.T) {
	// El doble del store devuelve ErrNotFound cuando el usuario_id no coincide
	// (igual que la versión real, donde el WHERE de pertenencia no encuentra fila).
	fs := &fakeStore{
		cambiar: func(_ context.Context, usuarioID, id string, _ enrollments.Estado) (enrollments.Inscripcion, error) {
			if usuarioID != subA {
				return enrollments.Inscripcion{}, store.ErrNotFound
			}
			return enrollments.Inscripcion{ID: id, UsuarioID: usuarioID, Estado: enrollments.EstadoPausada}, nil
		},
		eliminar: func(_ context.Context, usuarioID, _ string) error {
			if usuarioID != subA {
				return store.ErrNotFound
			}
			return nil
		},
	}
	r, signer := nuevoRouter(t, fs, nil)

	patch := func(sub string) int {
		req := httptest.NewRequest(http.MethodPatch, "/v1/enrollments/"+insID,
			strings.NewReader(`{"estado":"pausada"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+tokenDe(t, signer, sub))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec.Code
	}
	del := func(sub string) int {
		req := httptest.NewRequest(http.MethodDelete, "/v1/enrollments/"+insID, nil)
		req.Header.Set("Authorization", "Bearer "+tokenDe(t, signer, sub))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec.Code
	}

	if got := patch(subA); got != http.StatusOK {
		t.Errorf("PATCH propio: status = %d; quería 200", got)
	}
	if got := patch(subB); got != http.StatusNotFound {
		t.Errorf("PATCH ajeno: status = %d; quería 404 (BOLA)", got)
	}
	if got := del(subA); got != http.StatusNoContent {
		t.Errorf("DELETE propio: status = %d; quería 204", got)
	}
	if got := del(subB); got != http.StatusNotFound {
		t.Errorf("DELETE ajeno: status = %d; quería 404 (BOLA)", got)
	}
}

func TestRutasProtegidasSinAuth(t *testing.T) {
	r := NewRouter(Options{
		Service: "enrollments", Version: "test",
		Logger: slog.New(slog.NewJSONHandler(io.Discard, nil)),
		Store:  &fakeStore{}, Catalog: &fakeCatalog{}, Auth: nil,
	})
	// Cada ruta protegida debe responder 501 cuando no hay autenticador.
	probas := []struct{ method, path string }{
		{http.MethodPost, "/v1/enrollments"},
		{http.MethodGet, "/v1/me/enrollments"},
		{http.MethodPatch, "/v1/enrollments/" + insID},
		{http.MethodDelete, "/v1/enrollments/" + insID},
	}
	for _, p := range probas {
		req := httptest.NewRequest(p.method, p.path, strings.NewReader(`{}`))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotImplemented {
			t.Errorf("%s %s: status = %d; quería 501", p.method, p.path, rec.Code)
		}
	}
}
