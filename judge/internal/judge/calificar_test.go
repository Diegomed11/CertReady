package judge_test

import (
	"context"
	"testing"

	"github.com/certready/certready/judge/internal/judge"
	"github.com/certready/certready/judge/internal/runner"
)

// runnerFalso devuelve un resultado por caso según el stdin recibido, sin Docker.
type runnerFalso struct {
	por func(stdin string) runner.RunResult
}

func (r runnerFalso) Run(_ context.Context, req runner.RunRequest) (runner.RunResult, error) {
	return r.por(req.Stdin), nil
}

func problemaDemo() judge.Problema {
	return judge.Problema{
		ID:                  "p_sum",
		LenguajesPermitidos: []string{"python"},
		LimiteTiempoMs:      1000,
		LimiteMemoriaMB:     128,
		Casos: []judge.Caso{
			{Entrada: "1 2", SalidaEsperada: "3", Oculto: false},
			{Entrada: "10 20", SalidaEsperada: "OCULTO_30", Oculto: true},
		},
	}
}

func TestCalificarAccepted(t *testing.T) {
	// Un runner que "resuelve" sumando: responde la salida esperada de cada caso.
	salidas := map[string]string{"1 2": "3", "10 20": "OCULTO_30"}
	run := runnerFalso{por: func(stdin string) runner.RunResult {
		return runner.RunResult{Estado: runner.EstadoOK, Stdout: salidas[stdin] + "\n", DuracionMs: 5}
	}}

	res, err := judge.Calificar(context.Background(), run, problemaDemo(), judge.EnvioCodigo{Lenguaje: "python", Fuente: "..."})
	if err != nil {
		t.Fatalf("calificar: %v", err)
	}
	if res.Veredicto != judge.Accepted {
		t.Fatalf("veredicto = %s; quería accepted", res.Veredicto)
	}
	if res.CasosPasados != 2 || res.CasosTotal != 2 {
		t.Fatalf("casos = %d/%d; quería 2/2", res.CasosPasados, res.CasosTotal)
	}
}

// TestCalificarNoFiltraOcultos es la prueba anti-fuga a nivel de calificación: el
// resultado de un caso oculto no debe llevar entrada ni salidas, aun cuando falle.
func TestCalificarNoFiltraOcultos(t *testing.T) {
	// El "código" siempre imprime 3: acierta el visible, falla el oculto.
	run := runnerFalso{por: func(string) runner.RunResult {
		return runner.RunResult{Estado: runner.EstadoOK, Stdout: "3\n", DuracionMs: 5}
	}}

	res, err := judge.Calificar(context.Background(), run, problemaDemo(), judge.EnvioCodigo{Lenguaje: "python", Fuente: "..."})
	if err != nil {
		t.Fatalf("calificar: %v", err)
	}
	if res.Veredicto != judge.WrongAnswer {
		t.Fatalf("veredicto = %s; quería wrong_answer", res.Veredicto)
	}
	if res.CasosPasados != 1 {
		t.Fatalf("casos pasados = %d; quería 1", res.CasosPasados)
	}
	for _, c := range res.Casos {
		if c.Oculto && (c.Entrada != "" || c.SalidaEsperada != "" || c.SalidaObtenida != "") {
			t.Errorf("el caso oculto filtró datos: %+v", c)
		}
		if !c.Oculto && c.SalidaEsperada == "" {
			t.Errorf("el caso visible debería incluir su salida esperada: %+v", c)
		}
	}
}

func TestCalificarClasificaFallos(t *testing.T) {
	tt := []struct {
		nombre string
		estado runner.Estado
		quiere judge.Veredicto
	}{
		{"tiempo", runner.EstadoTLE, judge.TimeLimit},
		{"memoria", runner.EstadoMLE, judge.MemLimit},
		{"runtime", runner.EstadoRE, judge.RuntimeError},
	}
	for _, tc := range tt {
		t.Run(tc.nombre, func(t *testing.T) {
			run := runnerFalso{por: func(string) runner.RunResult {
				return runner.RunResult{Estado: tc.estado}
			}}
			res, err := judge.Calificar(context.Background(), run, problemaDemo(), judge.EnvioCodigo{Lenguaje: "python", Fuente: "x"})
			if err != nil {
				t.Fatal(err)
			}
			if res.Veredicto != tc.quiere {
				t.Errorf("veredicto = %s; quería %s", res.Veredicto, tc.quiere)
			}
		})
	}
}

func TestEnvioCodigoValidar(t *testing.T) {
	ok := judge.EnvioCodigo{ProblemaRef: "p_sum", Lenguaje: "python", Fuente: "print(1)"}
	if errs := ok.Validar(); len(errs) != 0 {
		t.Errorf("envío válido marcó errores: %v", errs)
	}
	vacio := judge.EnvioCodigo{}
	if errs := vacio.Validar(); len(errs) == 0 {
		t.Errorf("envío vacío debería ser inválido")
	}
}
