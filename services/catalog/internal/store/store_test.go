package store_test

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/libs/platform/postgres"

	"github.com/certready/certready/services/catalog/internal/catalog"
	"github.com/certready/certready/services/catalog/internal/store"
	"github.com/certready/certready/services/catalog/migrations"
)

// testStore conecta a la base de pruebas, aplica migraciones y deja las tablas
// vacías. Se salta el test si no hay CATALOG_TEST_DATABASE_URL definido, para no
// fallar en entornos sin Postgres (p. ej. CI sin servicio de base de datos).
func testStore(t *testing.T) *store.Store {
	t.Helper()
	dsn := os.Getenv("CATALOG_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("define CATALOG_TEST_DATABASE_URL para los tests de integración del store")
	}

	ctx := context.Background()
	pool, err := postgres.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("conectar a la base de prueba: %v", err)
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
	_, err := pool.Exec(ctx,
		`truncate catalog.certificaciones, catalog.temas, catalog.pistas_entrevista restart identity cascade`)
	if err != nil {
		t.Fatalf("truncar tablas: %v", err)
	}
}

func nueva(slug string) catalog.NuevaCertificacion {
	return catalog.NuevaCertificacion{
		Slug: slug, Nombre: "Cert " + slug, Proveedor: "AWS", Nivel: "associate",
	}
}

func TestMigrateEsIdempotente(t *testing.T) {
	st := testStore(t) // testStore ya migró una vez.
	_ = st
	// La segunda migración no debe fallar ni reaplicar nada.
	ctx := context.Background()
	dsn := os.Getenv("CATALOG_TEST_DATABASE_URL")
	pool, err := postgres.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("conectar: %v", err)
	}
	defer pool.Close()
	if err := store.Migrate(ctx, pool, migrations.FS); err != nil {
		t.Fatalf("segunda migración falló: %v", err)
	}
}

func TestCrearYObtenerCertificacion(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	creada, err := st.CrearCertificacion(ctx, nueva("aws-saa"))
	if err != nil {
		t.Fatalf("crear: %v", err)
	}
	if creada.ID == "" || creada.Slug != "aws-saa" || !creada.Activo {
		t.Fatalf("certificación creada inesperada: %+v", creada)
	}

	// Por id.
	porID, err := st.ObtenerCertificacion(ctx, creada.ID)
	if err != nil {
		t.Fatalf("obtener por id: %v", err)
	}
	if porID.ID != creada.ID {
		t.Errorf("id = %s; quería %s", porID.ID, creada.ID)
	}

	// Por slug.
	porSlug, err := st.ObtenerCertificacion(ctx, "aws-saa")
	if err != nil {
		t.Fatalf("obtener por slug: %v", err)
	}
	if porSlug.ID != creada.ID {
		t.Errorf("id = %s; quería %s", porSlug.ID, creada.ID)
	}
}

func TestObtenerCertificacionNoExiste(t *testing.T) {
	st := testStore(t)
	_, err := st.ObtenerCertificacion(context.Background(), "no-existe")
	if !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("err = %v; quería ErrNotFound", err)
	}
}

func TestCrearCertificacionSlugDuplicado(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	if _, err := st.CrearCertificacion(ctx, nueva("dup")); err != nil {
		t.Fatalf("primer create: %v", err)
	}
	_, err := st.CrearCertificacion(ctx, nueva("dup"))
	if !errors.Is(err, store.ErrConflict) {
		t.Fatalf("err = %v; quería ErrConflict", err)
	}
}

func TestListarCertificacionesPorProveedor(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	aws := nueva("aws-1")
	azure := nueva("azure-1")
	azure.Proveedor = "Azure"
	if _, err := st.CrearCertificacion(ctx, aws); err != nil {
		t.Fatal(err)
	}
	if _, err := st.CrearCertificacion(ctx, azure); err != nil {
		t.Fatal(err)
	}

	items, err := st.ListarCertificaciones(ctx, store.FiltroCertificaciones{Proveedor: "AWS", Limit: 10})
	if err != nil {
		t.Fatalf("listar: %v", err)
	}
	if len(items) != 1 || items[0].Proveedor != "AWS" {
		t.Errorf("esperaba 1 certificación AWS, obtuve: %+v", items)
	}
}
