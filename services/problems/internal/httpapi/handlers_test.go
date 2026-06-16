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

	"github.com/certready/certready/services/problems/internal/problems"
	"github.com/certready/certready/services/problems/internal/store"
)

// fakeStore es un doble en memoria de ProblemsStore. Cada método delega en un
// campo función configurable por test; si es nil, devuelve el valor cero.
type fakeStore struct {
	ping          func(context.Context) error
	listProblemas func(context.Context, store.FiltroProblemas) ([]problems.Problema, error)
	getProblema   func(context.Context, string) (problems.Problema, error)
	crearProblema func(context.Context, problems.NuevoProblema) (problems.Problema, error)
	listQA        func(context.Context, store.FiltroQA) ([]problems.PreguntaQA, error)
	getQA         func(context.Context, string) (problems.PreguntaQA, error)
	crearQA       func(context.Context, problems.NuevaPreguntaQA) (problems.PreguntaQA, error)
}

func (f *fakeStore) Ping(ctx context.Context) error {
	if f.ping != nil {
		return f.ping(ctx)
	}
	return nil
}

func (f *fakeStore) ListarProblemas(ctx context.Context, fl store.FiltroProblemas) ([]problems.Problema, error) {
	return f.listProblemas(ctx, fl)
}
func (f *fakeStore) ObtenerProblema(ctx context.Context, id string) (problems.Problema, error) {
	return f.getProblema(ctx, id)
}
func (f *fakeStore) CrearProblema(ctx context.Context, n problems.NuevoProblema) (problems.Problema, error) {
	return f.crearProblema(ctx, n)
}
func (f *fakeStore) ListarQA(ctx context.Context, fl store.FiltroQA) ([]problems.PreguntaQA, error) {
	return f.listQA(ctx, fl)
}
func (f *fakeStore) ObtenerQA(ctx context.Context, id string) (problems.PreguntaQA, error) {
	return f.getQA(ctx, id)
}
func (f *fakeStore) CrearQA(ctx context.Context, n problems.NuevaPreguntaQA) (problems.PreguntaQA, error) {
	return f.crearQA(ctx, n)
}

func newTestRouter(fs *fakeStore) http.Handler {
	return NewRouter(Options{
		Service: "problems",
		Version: "test",
		Logger:  slog.New(slog.NewJSONHandler(io.Discard, nil)),
		Store:   fs,
	})
}

func do(t *testing.T, h http.Handler, method, target, body string) *httptest.ResponseRecorder {
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

// problemaConOculto es un problema con un caso visible y otro oculto cuyo
// contenido NO debe aparecer en ninguna respuesta pública.
func problemaConOculto() problems.Problema {
	return problems.Problema{
		ID: "p_two_sum", Titulo: "Two Sum", Dificultad: "facil", Area: "algoritmos",
		LenguajesPermitidos: []string{"python"},
		Casos: []problems.Caso{
			{Entrada: "1 2", SalidaEsperada: "3", Oculto: false},
			{Entrada: "SECRETO_ENTRADA", SalidaEsperada: "SECRETO_SALIDA", Oculto: true},
		},
	}
}

const marcadorSecreto = "SECRETO_SALIDA"

// TestObtenerProblemaNoFiltraOcultos es la prueba de anti-fuga: el detalle
// público no debe contener casos ocultos ni su salida esperada.
func TestObtenerProblemaNoFiltraOcultos(t *testing.T) {
	fs := &fakeStore{getProblema: func(context.Context, string) (problems.Problema, error) {
		return problemaConOculto(), nil
	}}
	rec := do(t, newTestRouter(fs), http.MethodGet, "/v1/problems/p_two_sum", "")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; quería 200", rec.Code)
	}
	if strings.Contains(rec.Body.String(), marcadorSecreto) {
		t.Fatalf("la respuesta filtró datos de un caso oculto:\n%s", rec.Body.String())
	}
	var p problems.Problema
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil {
		t.Fatalf("JSON inválido: %v", err)
	}
	if len(p.Casos) != 1 || p.Casos[0].Oculto {
		t.Errorf("se esperaba 1 caso visible; got %+v", p.Casos)
	}
}

// TestListarProblemasNoFiltraOcultos verifica la anti-fuga también en el listado.
func TestListarProblemasNoFiltraOcultos(t *testing.T) {
	fs := &fakeStore{listProblemas: func(context.Context, store.FiltroProblemas) ([]problems.Problema, error) {
		return []problems.Problema{problemaConOculto()}, nil
	}}
	rec := do(t, newTestRouter(fs), http.MethodGet, "/v1/problems?area=algoritmos", "")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; quería 200", rec.Code)
	}
	if strings.Contains(rec.Body.String(), marcadorSecreto) {
		t.Fatalf("el listado filtró datos de un caso oculto:\n%s", rec.Body.String())
	}
}

func TestListarProblemasLimitInvalido(t *testing.T) {
	rec := do(t, newTestRouter(&fakeStore{}), http.MethodGet, "/v1/problems?limit=abc", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d; quería 400", rec.Code)
	}
}

// TestCrearProblemaSinAuth: sin OIDC configurado, la ruta admin queda en 501.
func TestCrearProblemaSinAuth(t *testing.T) {
	rec := do(t, newTestRouter(&fakeStore{}), http.MethodPost, "/v1/problems", `{"id":"x"}`)
	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("status = %d; quería 501 (gated sin auth)", rec.Code)
	}
}

// TestCrearProblemaConAuth verifica la autorización admin: sin token 401, sin rol
// admin 403, con rol admin 201.
func TestCrearProblemaConAuth(t *testing.T) {
	const issuer, aud = "https://issuer.test", "problems-api"
	signer, err := authtest.NewSigner(issuer)
	if err != nil {
		t.Fatalf("signer: %v", err)
	}
	authn := auth.NewWithKeySet(signer.KeySet(), auth.Config{Issuer: issuer, Audience: aud})

	fs := &fakeStore{crearProblema: func(_ context.Context, n problems.NuevoProblema) (problems.Problema, error) {
		return problems.Problema{ID: n.ID, Titulo: n.Titulo}, nil
	}}
	router := NewRouter(Options{
		Service: "problems", Version: "test",
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
	body := `{"id":"p_two_sum","titulo":"Two Sum","enunciado":"...","dificultad":"facil","area":"algoritmos","lenguajes_permitidos":["python"],"casos":[{"entrada":"1 2","salida_esperada":"3"}]}`

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
			req := httptest.NewRequest(http.MethodPost, "/v1/problems", strings.NewReader(body))
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d; quería %d (body: %s)", rec.Code, tt.wantStatus, rec.Body.String())
			}
		})
	}
}

func TestObtenerQA(t *testing.T) {
	tests := []struct {
		name       string
		getQA      func(context.Context, string) (problems.PreguntaQA, error)
		wantStatus int
	}{
		{"encontrada", func(context.Context, string) (problems.PreguntaQA, error) {
			return problems.PreguntaQA{ID: "qa_1", Area: "backend"}, nil
		}, http.StatusOK},
		{"no encontrada", func(context.Context, string) (problems.PreguntaQA, error) {
			return problems.PreguntaQA{}, store.ErrNotFound
		}, http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, newTestRouter(&fakeStore{getQA: tt.getQA}), http.MethodGet, "/v1/qa/qa_1", "")
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d; quería %d", rec.Code, tt.wantStatus)
			}
		})
	}
}

// TestListarQAFiltraPorAreas verifica que el handler parsea `areas` (CSV, con
// espacios) y lo pasa al filtro como lista para el `$in` del store.
func TestListarQAFiltraPorAreas(t *testing.T) {
	var capturado store.FiltroQA
	fs := &fakeStore{listQA: func(_ context.Context, fl store.FiltroQA) ([]problems.PreguntaQA, error) {
		capturado = fl
		return []problems.PreguntaQA{}, nil
	}}
	rec := do(t, newTestRouter(fs), http.MethodGet, "/v1/qa?areas=sistemas,%20bases-de-datos", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; quería 200", rec.Code)
	}
	want := []string{"sistemas", "bases-de-datos"}
	if len(capturado.Areas) != len(want) || capturado.Areas[0] != want[0] || capturado.Areas[1] != want[1] {
		t.Fatalf("Areas = %v; quería %v", capturado.Areas, want)
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
