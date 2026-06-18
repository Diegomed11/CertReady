package store_test

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/certready/certready/libs/platform/postgres"

	"github.com/certready/certready/judge/internal/judge"
	"github.com/certready/certready/judge/internal/store"
	"github.com/certready/certready/judge/migrations"
)

const (
	usuarioA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	usuarioB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
)

func testEjecuciones(t *testing.T) *store.EjecucionesStore {
	t.Helper()
	dsn := os.Getenv("JUDGE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("define JUDGE_TEST_DATABASE_URL para los tests de ejecuciones")
	}
	ctx := context.Background()
	pool, err := postgres.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("postgres: %v", err)
	}
	t.Cleanup(pool.Close)
	if err := store.Migrate(ctx, pool, migrations.FS); err != nil {
		t.Fatalf("migrar: %v", err)
	}
	if _, err := pool.Exec(ctx, `truncate judge.ejecuciones`); err != nil {
		t.Fatalf("truncar: %v", err)
	}
	return store.NewEjecuciones(pool)
}

func envioYResultado() (judge.EnvioCodigo, judge.Resultado) {
	return judge.EnvioCodigo{ProblemaRef: "p_sum", Lenguaje: "python", Fuente: "print(1)"},
		judge.Resultado{Veredicto: judge.Accepted, CasosTotal: 2, CasosPasados: 2, DuracionMs: 42}
}

func TestEjecucionCrearObtenerListar(t *testing.T) {
	st := testEjecuciones(t)
	ctx := context.Background()
	envio, res := envioYResultado()

	c, err := st.CrearEjecucion(ctx, usuarioA, envio, res, "arrays")
	if err != nil {
		t.Fatalf("crear: %v", err)
	}
	if c.Veredicto != "accepted" || c.CasosPasados != 2 || c.DuracionMs != 42 {
		t.Fatalf("ejecucion creada inesperada: %+v", c)
	}

	got, err := st.ObtenerEjecucion(ctx, usuarioA, c.ID)
	if err != nil {
		t.Fatalf("obtener: %v", err)
	}
	if got.ID != c.ID || got.ProblemaRef != "p_sum" {
		t.Fatalf("ejecucion obtenida inesperada: %+v", got)
	}

	lista, err := st.ListarEjecuciones(ctx, usuarioA, 10, 0)
	if err != nil {
		t.Fatalf("listar: %v", err)
	}
	if len(lista) != 1 {
		t.Fatalf("listadas = %d; quería 1", len(lista))
	}
}

func TestEjecucionPertenencia(t *testing.T) {
	st := testEjecuciones(t)
	ctx := context.Background()
	envio, res := envioYResultado()

	c, err := st.CrearEjecucion(ctx, usuarioA, envio, res, "arrays")
	if err != nil {
		t.Fatal(err)
	}

	// usuarioB no puede ver la ejecucion de usuarioA (BOLA -> ErrNotFound).
	if _, err := st.ObtenerEjecucion(ctx, usuarioB, c.ID); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("obtener ajena: err = %v; quería ErrNotFound", err)
	}
	// Y su historial está vacío.
	lista, err := st.ListarEjecuciones(ctx, usuarioB, 10, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(lista) != 0 {
		t.Fatalf("historial de B = %d; quería 0", len(lista))
	}
}
