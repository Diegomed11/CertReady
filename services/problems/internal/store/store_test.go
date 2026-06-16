package store_test

import (
	"context"
	"errors"
	"os"
	"testing"

	pmongo "github.com/certready/certready/libs/platform/mongo"

	"github.com/certready/certready/services/problems/internal/problems"
	"github.com/certready/certready/services/problems/internal/store"
)

func testStore(t *testing.T) *store.Store {
	t.Helper()
	uri := os.Getenv("PROBLEMS_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("define PROBLEMS_TEST_MONGO_URI para los tests de integración del store")
	}
	ctx := context.Background()
	client, err := pmongo.Connect(ctx, uri)
	if err != nil {
		t.Fatalf("conectar a MongoDB: %v", err)
	}
	t.Cleanup(func() { _ = client.Disconnect(context.Background()) })

	db := client.Database("certready_test")
	for _, c := range []string{"problemas", "qa"} {
		if err := db.Collection(c).Drop(ctx); err != nil {
			t.Fatalf("limpiar colección %s: %v", c, err)
		}
	}
	return store.New(db)
}

func nuevoProblema(id string) problems.NuevoProblema {
	return problems.NuevoProblema{
		ID: id, Titulo: "Two Sum", Enunciado: "Suma dos números.",
		Dificultad: "facil", Area: "algoritmos",
		Etiquetas: []string{"arreglos"}, LenguajesPermitidos: []string{"python"},
		Casos: []problems.Caso{
			{Entrada: "1 2", SalidaEsperada: "3", Oculto: false},
			{Entrada: "10 20", SalidaEsperada: "30", Oculto: true},
		},
	}
}

func TestCrearYObtenerProblema(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	creado, err := st.CrearProblema(ctx, nuevoProblema("p_two_sum"))
	if err != nil {
		t.Fatalf("crear: %v", err)
	}
	if creado.LimiteTiempoMs != 2000 || creado.LimiteMemoriaMB != 256 {
		t.Errorf("límites por defecto no aplicados: %+v", creado)
	}

	// ObtenerProblema (uso interno) sí trae los casos ocultos para el juez.
	obtenido, err := st.ObtenerProblema(ctx, "p_two_sum")
	if err != nil {
		t.Fatalf("obtener: %v", err)
	}
	if len(obtenido.Casos) != 2 {
		t.Fatalf("se esperaban 2 casos (incl. oculto); hubo %d", len(obtenido.Casos))
	}
}

func TestObtenerProblemaNoExiste(t *testing.T) {
	st := testStore(t)
	_, err := st.ObtenerProblema(context.Background(), "no-existe")
	if !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("err = %v; quería ErrNotFound", err)
	}
}

func TestCrearProblemaDuplicado(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	if _, err := st.CrearProblema(ctx, nuevoProblema("dup")); err != nil {
		t.Fatal(err)
	}
	_, err := st.CrearProblema(ctx, nuevoProblema("dup"))
	if !errors.Is(err, store.ErrConflict) {
		t.Fatalf("err = %v; quería ErrConflict", err)
	}
}

func TestListarProblemasPorArea(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	if _, err := st.CrearProblema(ctx, nuevoProblema("p1")); err != nil {
		t.Fatal(err)
	}
	otro := nuevoProblema("p2")
	otro.Area = "concurrencia"
	if _, err := st.CrearProblema(ctx, otro); err != nil {
		t.Fatal(err)
	}

	items, err := st.ListarProblemas(ctx, store.FiltroProblemas{Area: "algoritmos", Limit: 10})
	if err != nil {
		t.Fatalf("listar: %v", err)
	}
	if len(items) != 1 || items[0].Area != "algoritmos" {
		t.Errorf("filtro por área falló: %+v", items)
	}
}

func TestQACrearObtenerListar(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	n := problems.NuevaPreguntaQA{
		ID: "qa_sql_indices", Puesto: "backend", Area: "bases-de-datos",
		Categoria: "sql", Enunciado: "¿Qué es un índice?",
		RespuestaModelo: "Estructura que acelera búsquedas.",
		PuntosClave:     []string{"B-tree", "trade-off de escritura"},
	}
	if _, err := st.CrearQA(ctx, n); err != nil {
		t.Fatalf("crear qa: %v", err)
	}

	q, err := st.ObtenerQA(ctx, "qa_sql_indices")
	if err != nil {
		t.Fatalf("obtener qa: %v", err)
	}
	if q.Tipo != "abierta" {
		t.Errorf("tipo por defecto = %q; quería abierta", q.Tipo)
	}

	lista, err := st.ListarQA(ctx, store.FiltroQA{Area: "bases-de-datos", Limit: 10})
	if err != nil {
		t.Fatalf("listar qa: %v", err)
	}
	if len(lista) != 1 {
		t.Errorf("listar qa por área = %d; quería 1", len(lista))
	}
}

// TestListarQAPorVariasAreas verifica el filtro multi-área (`$in`): elegir una
// especialidad que agrupa varias áreas trae las preguntas de cualquiera de ellas.
func TestListarQAPorVariasAreas(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	mk := func(id, area string) problems.NuevaPreguntaQA {
		return problems.NuevaPreguntaQA{
			ID: id, Puesto: "x", Area: area, Categoria: "c",
			Enunciado: "e", RespuestaModelo: "r",
		}
	}
	for _, p := range []problems.NuevaPreguntaQA{
		mk("q_sis", "sistemas"), mk("q_bd", "bases-de-datos"), mk("q_fe", "frontend"),
	} {
		if _, err := st.CrearQA(ctx, p); err != nil {
			t.Fatal(err)
		}
	}

	lista, err := st.ListarQA(ctx, store.FiltroQA{
		Areas: []string{"sistemas", "bases-de-datos"}, Limit: 10,
	})
	if err != nil {
		t.Fatalf("listar qa: %v", err)
	}
	if len(lista) != 2 {
		t.Errorf("filtro multi-área = %d; quería 2", len(lista))
	}
}
