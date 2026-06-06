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

func testCorridas(t *testing.T) *store.CorridasStore {
	t.Helper()
	dsn := os.Getenv("JUDGE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("define JUDGE_TEST_DATABASE_URL para los tests de corridas")
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
	if _, err := pool.Exec(ctx, `truncate judge.corridas`); err != nil {
		t.Fatalf("truncar: %v", err)
	}
	return store.NewCorridas(pool)
}

func envioYResultado() (judge.EnvioCodigo, judge.Resultado) {
	return judge.EnvioCodigo{ProblemaRef: "p_sum", Lenguaje: "python", Fuente: "print(1)"},
		judge.Resultado{Veredicto: judge.Accepted, CasosTotal: 2, CasosPasados: 2, DuracionMs: 42}
}

func TestCorridaCrearObtenerListar(t *testing.T) {
	st := testCorridas(t)
	ctx := context.Background()
	envio, res := envioYResultado()

	c, err := st.CrearCorrida(ctx, usuarioA, envio, res)
	if err != nil {
		t.Fatalf("crear: %v", err)
	}
	if c.Veredicto != "accepted" || c.CasosPasados != 2 || c.DuracionMs != 42 {
		t.Fatalf("corrida creada inesperada: %+v", c)
	}

	got, err := st.ObtenerCorrida(ctx, usuarioA, c.ID)
	if err != nil {
		t.Fatalf("obtener: %v", err)
	}
	if got.ID != c.ID || got.ProblemaRef != "p_sum" {
		t.Fatalf("corrida obtenida inesperada: %+v", got)
	}

	lista, err := st.ListarCorridas(ctx, usuarioA, 10, 0)
	if err != nil {
		t.Fatalf("listar: %v", err)
	}
	if len(lista) != 1 {
		t.Fatalf("listadas = %d; quería 1", len(lista))
	}
}

func TestCorridaPertenencia(t *testing.T) {
	st := testCorridas(t)
	ctx := context.Background()
	envio, res := envioYResultado()

	c, err := st.CrearCorrida(ctx, usuarioA, envio, res)
	if err != nil {
		t.Fatal(err)
	}

	// usuarioB no puede ver la corrida de usuarioA (BOLA -> ErrNotFound).
	if _, err := st.ObtenerCorrida(ctx, usuarioB, c.ID); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("obtener ajena: err = %v; quería ErrNotFound", err)
	}
	// Y su historial está vacío.
	lista, err := st.ListarCorridas(ctx, usuarioB, 10, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(lista) != 0 {
		t.Fatalf("historial de B = %d; quería 0", len(lista))
	}
}
