package store_test

import (
	"context"
	"errors"
	"os"
	"testing"

	pmongo "github.com/certready/certready/libs/platform/mongo"

	"github.com/certready/certready/services/content/internal/content"
	"github.com/certready/certready/services/content/internal/store"
)

func testStore(t *testing.T) *store.Store {
	t.Helper()
	uri := os.Getenv("CONTENT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("define CONTENT_TEST_MONGO_URI para los tests de integración del store")
	}
	ctx := context.Background()
	client, err := pmongo.Connect(ctx, uri)
	if err != nil {
		t.Fatalf("conectar a MongoDB: %v", err)
	}
	t.Cleanup(func() { _ = client.Disconnect(context.Background()) })

	db := client.Database("certready_test")
	if err := db.Collection("materiales").Drop(ctx); err != nil {
		t.Fatalf("limpiar colección: %v", err)
	}
	return store.New(db)
}

func nuevo(id string) content.NuevoMaterial {
	return content.NuevoMaterial{
		ID: id, Certificacion: "aws-saa", Tema: "redes",
		Titulo: "Fundamentos de VPC", Contenido: "## VPC ...",
	}
}

func TestCrearYObtener(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	creado, err := st.Crear(ctx, nuevo("c_aws_vpc"))
	if err != nil {
		t.Fatalf("crear: %v", err)
	}
	if creado.ID != "c_aws_vpc" || creado.Formato != "markdown" {
		t.Fatalf("material creado inesperado: %+v", creado)
	}

	obtenido, err := st.Obtener(ctx, "c_aws_vpc")
	if err != nil {
		t.Fatalf("obtener: %v", err)
	}
	if obtenido.Titulo != "Fundamentos de VPC" {
		t.Errorf("titulo = %q", obtenido.Titulo)
	}
}

func TestObtenerNoExiste(t *testing.T) {
	st := testStore(t)
	_, err := st.Obtener(context.Background(), "no-existe")
	if !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("err = %v; quería ErrNotFound", err)
	}
}

func TestCrearDuplicado(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	if _, err := st.Crear(ctx, nuevo("dup")); err != nil {
		t.Fatal(err)
	}
	_, err := st.Crear(ctx, nuevo("dup"))
	if !errors.Is(err, store.ErrConflict) {
		t.Fatalf("err = %v; quería ErrConflict", err)
	}
}

func TestListarPorCertificacion(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	if _, err := st.Crear(ctx, nuevo("c1")); err != nil {
		t.Fatal(err)
	}
	azure := nuevo("c2")
	azure.Certificacion = "az-900"
	if _, err := st.Crear(ctx, azure); err != nil {
		t.Fatal(err)
	}

	items, err := st.Listar(ctx, store.Filtro{Certificacion: "aws-saa", Limit: 10})
	if err != nil {
		t.Fatalf("listar: %v", err)
	}
	if len(items) != 1 || items[0].Certificacion != "aws-saa" {
		t.Errorf("filtro por certificación falló: %+v", items)
	}
}
