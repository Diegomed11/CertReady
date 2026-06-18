package httpapi

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/auth/authtest"

	"github.com/certready/certready/judge/internal/judge"
	"github.com/certready/certready/judge/internal/runner"
	"github.com/certready/certready/judge/internal/store"
)

// --- dobles de prueba ------------------------------------------------------

type fakeProblemas struct {
	get func(context.Context, string) (judge.Problema, error)
}

func (f fakeProblemas) PingMongo(context.Context) error { return nil }
func (f fakeProblemas) ObtenerProblema(ctx context.Context, id string) (judge.Problema, error) {
	return f.get(ctx, id)
}

type fakeEjecuciones struct {
	crear func(context.Context, string, judge.EnvioCodigo, judge.Resultado, string) (judge.Ejecucion, error)
	get   func(context.Context, string, string) (judge.Ejecucion, error)
	list  func(context.Context, string, int, int) ([]judge.Ejecucion, error)
}

func (f fakeEjecuciones) PingPostgres(context.Context) error { return nil }
func (f fakeEjecuciones) CrearEjecucion(ctx context.Context, u string, e judge.EnvioCodigo, r judge.Resultado, area string) (judge.Ejecucion, error) {
	return f.crear(ctx, u, e, r, area)
}
func (f fakeEjecuciones) ObtenerEjecucion(ctx context.Context, u, id string) (judge.Ejecucion, error) {
	return f.get(ctx, u, id)
}
func (f fakeEjecuciones) ListarEjecuciones(ctx context.Context, u string, l, o int) ([]judge.Ejecucion, error) {
	return f.list(ctx, u, l, o)
}
func (f fakeEjecuciones) ResumenCodigoPorArea(context.Context, string, []string) (int, int, error) {
	return 0, 0, nil
}

type fakeRunner struct {
	por func(stdin string) runner.RunResult
}

func (r fakeRunner) Run(_ context.Context, req runner.RunRequest) (runner.RunResult, error) {
	return r.por(req.Stdin), nil
}

// problemaConOculto tiene un caso visible y otro oculto cuya salida esperada
// (marcador SECRETO) no debe aparecer nunca en una respuesta.
func problemaConOculto() judge.Problema {
	return judge.Problema{
		ID: "p_sum", LenguajesPermitidos: []string{"python"},
		LimiteTiempoMs: 1000, LimiteMemoriaMB: 128,
		Casos: []judge.Caso{
			{Entrada: "1 2", SalidaEsperada: "3", Oculto: false},
			{Entrada: "10 20", SalidaEsperada: "SECRETO_30", Oculto: true},
		},
	}
}

const marcadorSecreto = "SECRETO_30"

func withAuth(t *testing.T) (http.Handler, func(groups ...string) string, *fakeProblemas, *fakeEjecuciones) {
	t.Helper()
	const issuer, aud = "https://issuer.test", "judge-api"
	signer, err := authtest.NewSigner(issuer)
	if err != nil {
		t.Fatalf("signer: %v", err)
	}
	authn := auth.NewWithKeySet(signer.KeySet(), auth.Config{Issuer: issuer, Audience: aud})

	fp := &fakeProblemas{get: func(context.Context, string) (judge.Problema, error) {
		return problemaConOculto(), nil
	}}
	fc := &fakeEjecuciones{
		crear: func(_ context.Context, u string, e judge.EnvioCodigo, r judge.Resultado, _ string) (judge.Ejecucion, error) {
			return judge.Ejecucion{ID: "c1", UsuarioID: u, ProblemaRef: e.ProblemaRef, Veredicto: string(r.Veredicto)}, nil
		},
	}
	run := fakeRunner{por: func(stdin string) runner.RunResult {
		out := map[string]string{"1 2": "3", "10 20": "SECRETO_30"}
		return runner.RunResult{Estado: runner.EstadoOK, Stdout: out[stdin] + "\n", DuracionMs: 3}
	}}

	router := NewRouter(Options{
		Service: "judge", Version: "test",
		Logger:    slog.New(slog.NewJSONHandler(io.Discard, nil)),
		Problemas: fp, Ejecuciones: fc, Runner: run, Auth: authn,
	})
	token := func(groups ...string) string {
		tok, err := signer.Token(authtest.Claims{Subject: "u-est", Audience: aud, Groups: groups})
		if err != nil {
			t.Fatalf("token: %v", err)
		}
		return tok
	}
	return router, token, fp, fc
}

// --- tests -----------------------------------------------------------------

// TestEnviarSinAuthDevuelve501: sin OIDC configurado la ruta queda cerrada.
func TestEnviarSinAuthDevuelve501(t *testing.T) {
	router := NewRouter(Options{
		Service: "judge", Version: "test",
		Logger:    slog.New(slog.NewJSONHandler(io.Discard, nil)),
		Problemas: fakeProblemas{}, Ejecuciones: fakeEjecuciones{}, Runner: fakeRunner{},
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/judge/runs", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("status = %d; quería 501", rec.Code)
	}
}

func TestEnviarSinTokenDevuelve401(t *testing.T) {
	router, _, _, _ := withAuth(t)
	req := httptest.NewRequest(http.MethodPost, "/v1/judge/runs", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d; quería 401", rec.Code)
	}
}

// TestEnviarAcceptedNoFiltraOcultos: envío correcto ⇒ 201, y la respuesta no
// contiene la salida esperada del caso oculto (anti-fuga vía HTTP).
func TestEnviarAcceptedNoFiltraOcultos(t *testing.T) {
	router, token, _, _ := withAuth(t)
	body := `{"problema_ref":"p_sum","lenguaje":"python","fuente":"print(sum(map(int,input().split())))"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/judge/runs", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token("estudiante"))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d; quería 201 (body: %s)", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), marcadorSecreto) {
		t.Fatalf("la respuesta filtró la salida de un caso oculto:\n%s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"veredicto":"accepted"`) {
		t.Errorf("no se reportó accepted: %s", rec.Body.String())
	}
}

func TestEnviarProblemaNoExisteDevuelve404(t *testing.T) {
	router, token, fp, _ := withAuth(t)
	fp.get = func(context.Context, string) (judge.Problema, error) {
		return judge.Problema{}, store.ErrNotFound
	}
	body := `{"problema_ref":"nope","lenguaje":"python","fuente":"x"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/judge/runs", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token("estudiante"))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d; quería 404", rec.Code)
	}
}

func TestEnviarLenguajeNoPermitidoDevuelve422(t *testing.T) {
	router, token, _, _ := withAuth(t)
	body := `{"problema_ref":"p_sum","lenguaje":"cobol","fuente":"x"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/judge/runs", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token("estudiante"))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d; quería 422", rec.Code)
	}
}

// TestObtenerEjecucionAjenaDevuelve404 verifica la defensa BOLA: el store no
// encuentra la ejecucion para otro usuario.
func TestObtenerEjecucionAjenaDevuelve404(t *testing.T) {
	router, token, _, fc := withAuth(t)
	fc.get = func(context.Context, string, string) (judge.Ejecucion, error) {
		return judge.Ejecucion{}, store.ErrNotFound
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/judge/runs/otra", nil)
	req.Header.Set("Authorization", "Bearer "+token("estudiante"))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d; quería 404", rec.Code)
	}
}

func TestReadinessOK(t *testing.T) {
	router := NewRouter(Options{
		Service: "judge", Version: "test",
		Logger:    slog.New(slog.NewJSONHandler(io.Discard, nil)),
		Problemas: fakeProblemas{}, Ejecuciones: fakeEjecuciones{}, Runner: fakeRunner{},
	})
	req := httptest.NewRequest(http.MethodGet, "/v1/ready", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; quería 200", rec.Code)
	}
}
