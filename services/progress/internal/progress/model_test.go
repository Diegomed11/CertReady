package progress

import "testing"

func TestNuevaLeccionValidar(t *testing.T) {
	base := NuevaLeccion{Certificacion: "aws-saa", Tema: "iam", MaterialID: "m_iam_1"}
	tt := []struct {
		nombre   string
		mut      func(*NuevaLeccion)
		quiereOK bool
	}{
		{"válida", func(*NuevaLeccion) {}, true},
		{"sin certificacion", func(n *NuevaLeccion) { n.Certificacion = " " }, false},
		{"sin tema", func(n *NuevaLeccion) { n.Tema = "" }, false},
		{"sin material", func(n *NuevaLeccion) { n.MaterialID = "" }, false},
	}
	for _, tc := range tt {
		t.Run(tc.nombre, func(t *testing.T) {
			n := base
			tc.mut(&n)
			errs := n.Validar()
			if tc.quiereOK && len(errs) != 0 {
				t.Fatalf("esperaba válida; errores: %v", errs)
			}
			if !tc.quiereOK && len(errs) == 0 {
				t.Fatal("esperaba errores; no hubo")
			}
		})
	}
}

func TestNuevoQuizValidar(t *testing.T) {
	base := NuevoQuiz{Certificacion: "aws-saa", Tema: "iam", Puntaje: 80}
	tt := []struct {
		nombre   string
		mut      func(*NuevoQuiz)
		quiereOK bool
	}{
		{"válido", func(*NuevoQuiz) {}, true},
		{"puntaje 0", func(n *NuevoQuiz) { n.Puntaje = 0 }, true},
		{"puntaje 100", func(n *NuevoQuiz) { n.Puntaje = 100 }, true},
		{"puntaje negativo", func(n *NuevoQuiz) { n.Puntaje = -1 }, false},
		{"puntaje > 100", func(n *NuevoQuiz) { n.Puntaje = 101 }, false},
		{"sin tema", func(n *NuevoQuiz) { n.Tema = "" }, false},
	}
	for _, tc := range tt {
		t.Run(tc.nombre, func(t *testing.T) {
			n := base
			tc.mut(&n)
			errs := n.Validar()
			if tc.quiereOK && len(errs) != 0 {
				t.Fatalf("esperaba válido; errores: %v", errs)
			}
			if !tc.quiereOK && len(errs) == 0 {
				t.Fatal("esperaba errores; no hubo")
			}
		})
	}
}
