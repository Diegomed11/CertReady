package exams

import "testing"

func TestCalificar(t *testing.T) {
	refs := []string{"q1", "q2", "q3", "q4"}
	preguntas := map[string]Pregunta{
		"q1": {ID: "q1", RespuestaCorrecta: []string{"a"}, Explicacion: "porque a"},
		"q2": {ID: "q2", RespuestaCorrecta: []string{"b", "c"}},
		"q3": {ID: "q3", RespuestaCorrecta: []string{"a"}},
		"q4": {ID: "q4", RespuestaCorrecta: []string{"d"}},
	}
	respuestas := map[string][]string{
		"q1": {"a"},      // correcta
		"q2": {"c", "b"}, // correcta (orden distinto = mismo conjunto)
		"q3": {"b"},      // incorrecta
		// q4 sin responder -> incorrecta
	}

	res := Calificar("s1", refs, preguntas, respuestas)

	if res.Total != 4 {
		t.Fatalf("total = %d; quería 4", res.Total)
	}
	if res.Correctas != 2 {
		t.Fatalf("correctas = %d; quería 2", res.Correctas)
	}
	if res.Puntaje != 50 {
		t.Fatalf("puntaje = %v; quería 50", res.Puntaje)
	}
	if len(res.Resultados) != 4 {
		t.Fatalf("resultados = %d; quería 4", len(res.Resultados))
	}

	porRef := map[string]ResultadoPregunta{}
	for _, rp := range res.Resultados {
		porRef[rp.Ref] = rp
	}
	if !porRef["q1"].Correcto || porRef["q1"].Explicacion != "porque a" {
		t.Errorf("q1 inesperado: %+v", porRef["q1"])
	}
	if !porRef["q2"].Correcto {
		t.Error("q2 debía ser correcta (conjunto igual sin orden)")
	}
	if porRef["q3"].Correcto {
		t.Error("q3 debía ser incorrecta")
	}
	if porRef["q4"].Correcto || len(porRef["q4"].Seleccion) != 0 {
		t.Errorf("q4 sin responder debía ser incorrecta y sin selección: %+v", porRef["q4"])
	}
	// La respuesta correcta se incluye para el repaso.
	if len(porRef["q4"].RespuestaCorrecta) != 1 || porRef["q4"].RespuestaCorrecta[0] != "d" {
		t.Errorf("q4 debía exponer la respuesta correcta: %+v", porRef["q4"].RespuestaCorrecta)
	}
}

func TestCalificarPreguntaAusenteEsIncorrecta(t *testing.T) {
	refs := []string{"q1"}
	// El banco no tiene q1 (p. ej. fue borrada): debe contar como incorrecta.
	res := Calificar("s1", refs, map[string]Pregunta{}, map[string][]string{"q1": {"a"}})
	if res.Correctas != 0 || res.Puntaje != 0 {
		t.Fatalf("pregunta ausente debía dar 0 correctas: %+v", res)
	}
}

func TestCalificarSinPreguntasNoDivideEntreCero(t *testing.T) {
	res := Calificar("s1", nil, map[string]Pregunta{}, nil)
	if res.Total != 0 || res.Puntaje != 0 {
		t.Fatalf("sesión vacía: %+v", res)
	}
}
