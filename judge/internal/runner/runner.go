// Package runner abstrae la ejecución de código no confiable en un entorno
// aislado. La interfaz Runner permite intercambiar el backend de aislamiento
// (contenedores Docker en local/Fargate) sin tocar la lógica de calificación.
package runner

import "context"

// Estado es el desenlace de ejecutar una pieza de código en el sandbox.
type Estado string

const (
	EstadoOK  Estado = "ok"  // terminó con código 0 dentro de los límites
	EstadoTLE Estado = "tle" // excedió el límite de tiempo
	EstadoMLE Estado = "mle" // excedió el límite de memoria (OOM)
	EstadoRE  Estado = "re"  // error en ejecución (código de salida != 0)
	EstadoCE  Estado = "ce"  // error de compilación (lenguajes compilados)
)

// RunRequest es una solicitud de ejecución aislada.
//
// El runner no confía en estos datos: Fuente y Stdin provienen del usuario. Los
// límites los fija el juez a partir del problema, nunca el cliente.
type RunRequest struct {
	Lenguaje  string
	Fuente    string
	Stdin     string
	TiempoMs  int
	MemoriaMB int
}

// RunResult es el desenlace de una ejecución.
type RunResult struct {
	Estado     Estado
	Stdout     string
	Stderr     string
	DuracionMs int
}

// Runner ejecuta código no confiable en un entorno aislado y efímero.
//
// La implementación debe garantizar el aislamiento (sin red, sistema de archivos
// de solo lectura, límites de CPU/memoria/tiempo, sin privilegios). Run no debe
// devolver error por que el código del usuario falle (eso se refleja en Estado);
// solo devuelve error ante un fallo del propio sandbox (p. ej. Docker ausente).
type Runner interface {
	Run(ctx context.Context, req RunRequest) (RunResult, error)
}
