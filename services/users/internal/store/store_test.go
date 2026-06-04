package store_test

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/libs/platform/postgres"

	"github.com/certready/certready/services/users/internal/store"
	"github.com/certready/certready/services/users/internal/users"
	"github.com/certready/certready/services/users/migrations"
)

const sub = "22222222-2222-2222-2222-222222222222"

func testStore(t *testing.T) *store.Store {
	t.Helper()
	dsn := os.Getenv("USERS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("define USERS_TEST_DATABASE_URL para los tests de integración del store")
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
	if _, err := pool.Exec(ctx, `truncate users.usuarios restart identity cascade`); err != nil {
		t.Fatalf("truncar: %v", err)
	}
}

func ptr(s string) *string { return &s }

func TestProvisionarEsIdempotenteYSincroniza(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	// Primer login: provisiona como estudiante.
	u, err := st.ObtenerOProvisionar(ctx, sub, "a@b.co", nil, "estudiante")
	if err != nil {
		t.Fatalf("provisionar: %v", err)
	}
	if u.ID != sub || u.Email != "a@b.co" || u.Rol != "estudiante" {
		t.Fatalf("usuario inesperado: %+v", u)
	}
	// La fila de perfil debe existir tras provisionar.
	if _, err := st.ObtenerPerfil(ctx, sub); err != nil {
		t.Fatalf("perfil tras provisión: %v", err)
	}

	// Segundo login con email y rol actualizados: upsert sincroniza, no duplica.
	u2, err := st.ObtenerOProvisionar(ctx, sub, "nuevo@b.co", nil, "admin")
	if err != nil {
		t.Fatalf("re-provisionar: %v", err)
	}
	if u2.ID != sub || u2.Email != "nuevo@b.co" || u2.Rol != "admin" {
		t.Fatalf("sincronización inesperada: %+v", u2)
	}

	usuarios, err := st.ListarUsuarios(ctx, 10, 0)
	if err != nil {
		t.Fatalf("listar: %v", err)
	}
	if len(usuarios) != 1 {
		t.Errorf("esperaba 1 usuario (sin duplicar), hay %d", len(usuarios))
	}
}

func TestActualizarCuenta(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	if _, err := st.ObtenerOProvisionar(ctx, sub, "a@b.co", nil, "estudiante"); err != nil {
		t.Fatalf("provisionar: %v", err)
	}

	u, p, err := st.ActualizarCuenta(ctx, sub, users.ActualizarPerfil{
		Nombre: ptr("Diego"), Bio: ptr("Estudiante de AWS"), Pais: ptr("MX"),
	})
	if err != nil {
		t.Fatalf("actualizar: %v", err)
	}
	if u.Nombre == nil || *u.Nombre != "Diego" {
		t.Errorf("nombre = %v; quería Diego", u.Nombre)
	}
	if p.Bio == nil || *p.Bio != "Estudiante de AWS" {
		t.Errorf("bio = %v", p.Bio)
	}
	if p.Pais == nil || *p.Pais != "MX" {
		t.Errorf("pais = %v", p.Pais)
	}

	// Un campo nil no borra lo previo: actualizar solo bio conserva el nombre.
	u2, _, err := st.ActualizarCuenta(ctx, sub, users.ActualizarPerfil{Bio: ptr("Otra bio")})
	if err != nil {
		t.Fatalf("actualizar 2: %v", err)
	}
	if u2.Nombre == nil || *u2.Nombre != "Diego" {
		t.Errorf("el nombre no debía cambiar al actualizar solo bio: %v", u2.Nombre)
	}
}
