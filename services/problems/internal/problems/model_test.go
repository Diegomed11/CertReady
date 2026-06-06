package problems_test

import (
	"testing"

	"github.com/certready/certready/services/problems/internal/problems"
)

// TestVistaPublicaOcultaCasos verifica la defensa anti-fuga: la vista pública no
// debe contener ningún caso oculto ni su salida esperada.
func TestVistaPublicaOcultaCasos(t *testing.T) {
	p := problems.Problema{
		ID: "p_demo",
		Casos: []problems.Caso{
			{Entrada: "1 2", SalidaEsperada: "3", Oculto: false},
			{Entrada: "secreto", SalidaEsperada: "respuesta-secreta", Oculto: true},
			{Entrada: "9 9", SalidaEsperada: "18", Oculto: false},
		},
	}

	pub := p.VistaPublica()

	if len(pub.Casos) != 2 {
		t.Fatalf("vista pública con %d casos; querían 2 (solo visibles)", len(pub.Casos))
	}
	for _, c := range pub.Casos {
		if c.Oculto {
			t.Errorf("la vista pública filtró un caso oculto: %+v", c)
		}
		if c.SalidaEsperada == "respuesta-secreta" || c.Entrada == "secreto" {
			t.Errorf("la vista pública filtró datos de un caso oculto: %+v", c)
		}
	}

	// El problema original no debe mutarse.
	if len(p.Casos) != 3 {
		t.Errorf("VistaPublica mutó el problema original: %d casos", len(p.Casos))
	}
}

func TestNuevoProblemaValidar(t *testing.T) {
	base := func() problems.NuevoProblema {
		return problems.NuevoProblema{
			ID:                  "p_two_sum",
			Titulo:              "Two Sum",
			Enunciado:           "Suma dos números leídos de stdin.",
			Dificultad:          "facil",
			Area:                "algoritmos",
			LenguajesPermitidos: []string{"python"},
			Casos:               []problems.Caso{{Entrada: "1 2", SalidaEsperada: "3"}},
		}
	}

	tt := []struct {
		nombre   string
		mut      func(*problems.NuevoProblema)
		quiereOK bool
	}{
		{"válido", func(*problems.NuevoProblema) {}, true},
		{"id inválido", func(n *problems.NuevoProblema) { n.ID = "Mal ID" }, false},
		{"dificultad inválida", func(n *problems.NuevoProblema) { n.Dificultad = "imposible" }, false},
		{"lenguaje no soportado", func(n *problems.NuevoProblema) { n.LenguajesPermitidos = []string{"cobol"} }, false},
		{"sin casos", func(n *problems.NuevoProblema) { n.Casos = nil }, false},
		{"caso sin salida", func(n *problems.NuevoProblema) { n.Casos = []problems.Caso{{Entrada: "x"}} }, false},
		{"solo casos ocultos", func(n *problems.NuevoProblema) {
			n.Casos = []problems.Caso{{Entrada: "x", SalidaEsperada: "y", Oculto: true}}
		}, false},
	}

	for _, tc := range tt {
		t.Run(tc.nombre, func(t *testing.T) {
			n := base()
			tc.mut(&n)
			errs := n.Validar()
			if tc.quiereOK && len(errs) != 0 {
				t.Errorf("esperaba válido; errores = %v", errs)
			}
			if !tc.quiereOK && len(errs) == 0 {
				t.Errorf("esperaba inválido; no hubo errores")
			}
		})
	}
}
