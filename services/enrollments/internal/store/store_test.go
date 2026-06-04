package store_test

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/libs/platform/postgres"

	"github.com/certready/certready/services/enrollments/internal/enrollments"
	"github.com/certready/certready/services/enrollments/internal/store"
	"github.com/certready/certready/services/enrollments/migrations"
)

const (
	subA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	subB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
	objX = "11111111-1111-1111-1111-111111111111"
	objY = "22222222-2222-2222-2222-222222222222"
)

func testStore(t *testing.T) *store.Store {
	t.Helper()
	dsn := os.Getenv("ENROLLMENTS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("define ENROLLMENTS_TEST_DATABASE_URL para los tests de integración del store")
	}
	ctx := context.Background()
	pool, err := postgres.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("conectar: %v", err)
	}
	t.Cleanup(pool.Close)
	if err := store.Migrate(ctx, pool, migrations.FS); err != nil {
		t.Fatalf("migrar: %v", err)
	}
	truncar(t, ctx, pool)
	return store.New(pool)
}

func truncar(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	if _, err := pool.Exec(ctx, `truncate enrollments.inscripciones restart identity cascade`); err != nil {
		t.Fatalf("truncar: %v", err)
	}
}

func nueva(obj string) enrollments.NuevaInscripcion {
	return enrollments.NuevaInscripcion{
		TipoObjetivo: enrollments.TipoCertificacion,
		ObjetivoID:   obj,
	}
}

func TestCrearYListar(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	ins, err := st.Crear(ctx, subA, nueva(objX))
	if err != nil {
		t.Fatalf("crear: %v", err)
	}
	if ins.UsuarioID != subA || ins.ObjetivoID != objX || ins.Estado != enrollments.EstadoActiva {
		t.Fatalf("inscripción inesperada: %+v", ins)
	}

	items, err := st.ListarDeUsuario(ctx, subA, store.FiltroDeUsuario{Limit: 10})
	if err != nil {
		t.Fatalf("listar: %v", err)
	}
	if len(items) != 1 {
		t.Errorf("esperaba 1 inscripción, hay %d", len(items))
	}
}

func TestCrearDuplicadaDevuelveConflict(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	if _, err := st.Crear(ctx, subA, nueva(objX)); err != nil {
		t.Fatal(err)
	}
	_, err := st.Crear(ctx, subA, nueva(objX))
	if !errors.Is(err, store.ErrConflict) {
		t.Fatalf("err = %v; quería ErrConflict", err)
	}
}

func TestListarSoloDeUsuario(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	if _, err := st.Crear(ctx, subA, nueva(objX)); err != nil {
		t.Fatal(err)
	}
	if _, err := st.Crear(ctx, subB, nueva(objY)); err != nil {
		t.Fatal(err)
	}

	items, err := st.ListarDeUsuario(ctx, subA, store.FiltroDeUsuario{Limit: 10})
	if err != nil {
		t.Fatalf("listar: %v", err)
	}
	if len(items) != 1 || items[0].UsuarioID != subA {
		t.Errorf("ListarDeUsuario filtró mal por usuario_id: %+v", items)
	}
}

func TestCambiarEstadoSoloDelPropietario(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	ins, err := st.Crear(ctx, subA, nueva(objX))
	if err != nil {
		t.Fatal(err)
	}

	// subB intenta modificar una inscripción de subA → ErrNotFound (BOLA).
	if _, err := st.CambiarEstadoDeUsuario(ctx, subB, ins.ID, enrollments.EstadoPausada); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("subB modificando ajeno: err = %v; quería ErrNotFound", err)
	}

	actualizada, err := st.CambiarEstadoDeUsuario(ctx, subA, ins.ID, enrollments.EstadoPausada)
	if err != nil {
		t.Fatalf("subA modificando lo propio: %v", err)
	}
	if actualizada.Estado != enrollments.EstadoPausada {
		t.Errorf("estado = %s; quería pausada", actualizada.Estado)
	}
}

func TestEliminarSoloDelPropietario(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	ins, err := st.Crear(ctx, subA, nueva(objX))
	if err != nil {
		t.Fatal(err)
	}

	if err := st.EliminarDeUsuario(ctx, subB, ins.ID); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("subB borrando ajeno: err = %v; quería ErrNotFound", err)
	}
	if err := st.EliminarDeUsuario(ctx, subA, ins.ID); err != nil {
		t.Fatalf("subA borrando lo propio: %v", err)
	}
	// Segundo borrado: ya no existe.
	if err := st.EliminarDeUsuario(ctx, subA, ins.ID); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("borrar 2x: err = %v; quería ErrNotFound", err)
	}
}
