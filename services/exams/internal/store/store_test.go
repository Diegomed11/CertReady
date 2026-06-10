package store_test

import (
	"context"
	"errors"
	"os"
	"testing"

	pmongo "github.com/certready/certready/libs/platform/mongo"
	"github.com/certready/certready/libs/platform/postgres"

	"github.com/certready/certready/services/exams/internal/exams"
	"github.com/certready/certready/services/exams/internal/store"
	"github.com/certready/certready/services/exams/migrations"
)

const (
	usuarioA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	usuarioB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
)

// --- Banco de preguntas (MongoDB) ------------------------------------------

func testPreguntas(t *testing.T) *store.PreguntasStore {
	t.Helper()
	uri := os.Getenv("EXAMS_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("define EXAMS_TEST_MONGO_URI para los tests de preguntas")
	}
	ctx := context.Background()
	client, err := pmongo.Connect(ctx, uri)
	if err != nil {
		t.Fatalf("mongo: %v", err)
	}
	t.Cleanup(func() { _ = client.Disconnect(context.Background()) })
	db := client.Database("certready_test")
	if err := db.Collection("preguntas").Drop(ctx); err != nil {
		t.Fatalf("limpiar: %v", err)
	}
	return store.NewPreguntas(db)
}

func pregunta(id string) exams.NuevaPregunta {
	return exams.NuevaPregunta{
		ID: id, Certificacion: "aws-saa", Tema: "redes", Dificultad: "media",
		Tipo: "opcion_multiple", Enunciado: "¿...?",
		Opciones:          []exams.Opcion{{ID: "a", Texto: "A"}, {ID: "b", Texto: "B"}},
		RespuestaCorrecta: []string{"b"},
	}
}

func TestPreguntasCrearYPorRefs(t *testing.T) {
	st := testPreguntas(t)
	ctx := context.Background()
	if _, err := st.CrearPregunta(ctx, pregunta("q1")); err != nil {
		t.Fatalf("crear: %v", err)
	}
	if _, err := st.CrearPregunta(ctx, pregunta("q2")); err != nil {
		t.Fatalf("crear: %v", err)
	}

	m, err := st.PorRefs(ctx, []string{"q1", "q2", "no-existe"})
	if err != nil {
		t.Fatalf("porRefs: %v", err)
	}
	if len(m) != 2 || m["q1"].RespuestaCorrecta[0] != "b" {
		t.Errorf("porRefs inesperado: %+v", m)
	}
}

func TestPreguntasDuplicada(t *testing.T) {
	st := testPreguntas(t)
	ctx := context.Background()
	if _, err := st.CrearPregunta(ctx, pregunta("dup")); err != nil {
		t.Fatal(err)
	}
	_, err := st.CrearPregunta(ctx, pregunta("dup"))
	if !errors.Is(err, store.ErrConflict) {
		t.Fatalf("err = %v; quería ErrConflict", err)
	}
}

func TestPreguntasMuestrear(t *testing.T) {
	st := testPreguntas(t)
	ctx := context.Background()
	for _, id := range []string{"m1", "m2", "m3"} {
		if _, err := st.CrearPregunta(ctx, pregunta(id)); err != nil {
			t.Fatal(err)
		}
	}
	got, err := st.Muestrear(ctx, "aws-saa", "", 2)
	if err != nil {
		t.Fatalf("muestrear: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("muestreó %d; quería 2", len(got))
	}
	for _, p := range got {
		if p.Certificacion != "aws-saa" {
			t.Errorf("muestreó pregunta de otra certificación: %s", p.Certificacion)
		}
	}
}

// --- Sesiones e intentos (PostgreSQL) --------------------------------------

func testSesiones(t *testing.T) *store.SesionesStore {
	t.Helper()
	dsn := os.Getenv("EXAMS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("define EXAMS_TEST_DATABASE_URL para los tests de sesiones")
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
	if _, err := pool.Exec(ctx, `truncate exams.sesiones restart identity cascade`); err != nil {
		t.Fatalf("truncar: %v", err)
	}
	return store.NewSesiones(pool)
}

func TestSesionCrearObtenerYFinalizar(t *testing.T) {
	st := testSesiones(t)
	ctx := context.Background()

	refs := []string{"q1", "q2"}
	ses, err := st.CrearSesion(ctx, usuarioA, "aws-saa", "simulacro", refs)
	if err != nil {
		t.Fatalf("crear: %v", err)
	}
	if ses.Estado != "en_curso" || ses.Puntaje != nil {
		t.Fatalf("sesión nueva inesperada: %+v", ses)
	}

	// El roundtrip de las refs (jsonb) debe conservar el orden.
	got, gotRefs, err := st.ObtenerSesion(ctx, usuarioA, ses.ID)
	if err != nil {
		t.Fatalf("obtener: %v", err)
	}
	if len(gotRefs) != 2 || gotRefs[0] != "q1" || gotRefs[1] != "q2" {
		t.Fatalf("refs = %v", gotRefs)
	}
	_ = got

	intentos := []exams.Intento{
		{PreguntaRef: "q1", Correcto: true, Seleccion: []string{"b"}},
		{PreguntaRef: "q2", Correcto: false, Seleccion: []string{"a"}},
	}
	if err := st.Finalizar(ctx, usuarioA, ses.ID, 50, intentos); err != nil {
		t.Fatalf("finalizar: %v", err)
	}

	fin, _, err := st.ObtenerSesion(ctx, usuarioA, ses.ID)
	if err != nil {
		t.Fatal(err)
	}
	if fin.Estado != "finalizada" || fin.Puntaje == nil || *fin.Puntaje != 50 {
		t.Fatalf("sesión finalizada inesperada: %+v", fin)
	}

	guardados, err := st.ObtenerIntentos(ctx, ses.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(guardados) != 2 {
		t.Fatalf("intentos guardados = %d; quería 2", len(guardados))
	}

	// Finalizar de nuevo debe fallar.
	if err := st.Finalizar(ctx, usuarioA, ses.ID, 50, intentos); !errors.Is(err, store.ErrYaFinalizada) {
		t.Fatalf("re-finalizar: err = %v; quería ErrYaFinalizada", err)
	}
}

func TestSesionPertenencia(t *testing.T) {
	st := testSesiones(t)
	ctx := context.Background()
	ses, err := st.CrearSesion(ctx, usuarioA, "aws-saa", "simulacro", []string{"q1"})
	if err != nil {
		t.Fatal(err)
	}

	// usuarioB no puede ver ni finalizar la sesión de usuarioA (BOLA -> ErrNotFound).
	if _, _, err := st.ObtenerSesion(ctx, usuarioB, ses.ID); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("obtener ajena: err = %v; quería ErrNotFound", err)
	}
	if err := st.Finalizar(ctx, usuarioB, ses.ID, 100, nil); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("finalizar ajena: err = %v; quería ErrNotFound", err)
	}
}
