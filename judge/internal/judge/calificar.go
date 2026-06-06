package judge

import (
	"context"
	"strings"

	"github.com/certready/certready/judge/internal/runner"
)

// Calificar ejecuta el código del envío contra todos los casos del problema y
// produce el resultado.
//
// Parameters
//
//	ctx   : context de la operación (acota el tiempo total).
//	run   : runner aislado que ejecuta cada caso.
//	p     : problema con sus casos (incluidos los ocultos) y límites.
//	envio : código enviado por el estudiante.
//
// Returns
//
//	Resultado : veredicto global y por caso. Los casos ocultos no exponen su
//	            entrada ni sus salidas (defensa anti-fuga).
//	error     : solo si el sandbox falla (no si el código del usuario falla).
//
// El veredicto global es Accepted si todos los casos pasan; en otro caso, la
// categoría del primer caso que falla.
func Calificar(ctx context.Context, run runner.Runner, p Problema, envio EnvioCodigo) (Resultado, error) {
	res := Resultado{CasosTotal: len(p.Casos), Veredicto: Accepted}

	for i, c := range p.Casos {
		rr, err := run.Run(ctx, runner.RunRequest{
			Lenguaje:  envio.Lenguaje,
			Fuente:    envio.Fuente,
			Stdin:     c.Entrada,
			TiempoMs:  p.TiempoMs(),
			MemoriaMB: p.MemoriaMB(),
		})
		if err != nil {
			return Resultado{}, err
		}
		res.DuracionMs += rr.DuracionMs

		estado, vered := evaluar(rr, c)
		rc := ResultadoCaso{Indice: i, Oculto: c.Oculto, Estado: estado}
		if estado == "passed" {
			res.CasosPasados++
		} else if res.Veredicto == Accepted {
			res.Veredicto = vered // primera categoría de fallo
		}
		// Solo los casos visibles exponen su detalle.
		if !c.Oculto {
			rc.Entrada = c.Entrada
			rc.SalidaEsperada = c.SalidaEsperada
			rc.SalidaObtenida = rr.Stdout
		}
		res.Casos = append(res.Casos, rc)
	}

	return res, nil
}

// evaluar clasifica el resultado de un caso y, si falla, el veredicto global que
// le correspondería.
func evaluar(rr runner.RunResult, c Caso) (estado string, vered Veredicto) {
	switch rr.Estado {
	case runner.EstadoTLE:
		return "tle", TimeLimit
	case runner.EstadoMLE:
		return "mle", MemLimit
	case runner.EstadoRE:
		return "re", RuntimeError
	case runner.EstadoCE:
		return "ce", CompileError
	}
	if normalizar(rr.Stdout) == normalizar(c.SalidaEsperada) {
		return "passed", Accepted
	}
	return "wrong", WrongAnswer
}

// normalizar prepara una salida para comparación robusta: unifica saltos de
// línea, recorta espacios al final de cada línea y descarta líneas en blanco
// finales. No altera el contenido significativo.
func normalizar(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	lineas := strings.Split(s, "\n")
	for i := range lineas {
		lineas[i] = strings.TrimRight(lineas[i], " \t")
	}
	return strings.TrimRight(strings.Join(lineas, "\n"), "\n")
}
