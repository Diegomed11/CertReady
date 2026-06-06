package runner

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// holguraArranque es el margen sobre el límite de tiempo del problema para
// absorber el arranque del contenedor; el corte fino lo hace `timeout` adentro.
const holguraArranque = 8 * time.Second

// DockerRunner ejecuta cada solicitud en un contenedor Docker efímero y
// endurecido. Es la implementación de producción del aislamiento.
//
// Endurecimiento aplicado en cada `docker run` (ver §10 del documento de
// arquitectura y .claude/rules/judge.md):
//   - sin red (--network none);
//   - sistema de archivos raíz de solo lectura (--read-only) con un /tmp acotado
//     en tmpfs (noexec,nosuid);
//   - el código del usuario se monta de solo lectura en /sandbox;
//   - límites de memoria (sin swap), CPU y número de procesos (anti fork-bomb);
//   - usuario sin privilegios, todas las capabilities descartadas y
//     no-new-privileges;
//   - corte de tiempo por `timeout` dentro del contenedor, con un backstop por
//     context que mata el contenedor si quedara colgado.
type DockerRunner struct {
	imagenPython string
	dockerBin    string
}

// NewDockerRunner construye el runner con la imagen y el binario de Docker
// tomados del entorno (JUDGE_PYTHON_IMAGE, JUDGE_DOCKER_BIN) o sus defaults.
func NewDockerRunner() *DockerRunner {
	return &DockerRunner{
		imagenPython: getenv("JUDGE_PYTHON_IMAGE", "certready/judge-python:latest"),
		dockerBin:    getenv("JUDGE_DOCKER_BIN", "docker"),
	}
}

// plan resuelve, para un lenguaje, el nombre del archivo fuente, el programa a
// ejecutar dentro del contenedor y la imagen a usar.
func (d *DockerRunner) plan(lenguaje string) (archivo string, programa []string, imagen string, err error) {
	switch lenguaje {
	case "python":
		return "solucion.py", []string{"python3", "/sandbox/solucion.py"}, d.imagenPython, nil
	default:
		return "", nil, "", fmt.Errorf("lenguaje no soportado por el runner: %s", lenguaje)
	}
}

// Run ejecuta el código del request en un contenedor aislado y clasifica el
// desenlace. Returns error solo ante un fallo del sandbox (no del código).
func (d *DockerRunner) Run(ctx context.Context, req RunRequest) (RunResult, error) {
	archivo, programa, imagen, err := d.plan(req.Lenguaje)
	if err != nil {
		return RunResult{}, err
	}

	dir, err := os.MkdirTemp("", "judge-*")
	if err != nil {
		return RunResult{}, fmt.Errorf("crear directorio temporal: %w", err)
	}
	defer func() { _ = os.RemoveAll(dir) }()

	if err := os.WriteFile(filepath.Join(dir, archivo), []byte(req.Fuente), 0o600); err != nil {
		return RunResult{}, fmt.Errorf("escribir fuente: %w", err)
	}

	tiempo := time.Duration(req.TiempoMs) * time.Millisecond
	ctxRun, cancel := context.WithTimeout(ctx, tiempo+holguraArranque)
	defer cancel()

	// `timeout` corta la ejecución en el límite fino: envía SIGTERM al expirar
	// (salida 124) y, si el proceso lo ignora, SIGKILL tras una gracia (-k).
	segs := fmt.Sprintf("%.3f", tiempo.Seconds())
	interno := append([]string{"timeout", "-k", "3", segs}, programa...)

	args := []string{
		"run", "--rm", "-i",
		"--network", "none",
		"--read-only",
		"--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
		"-v", dir + ":/sandbox:ro",
		"--workdir", "/sandbox",
		"--memory", strconv.Itoa(req.MemoriaMB) + "m",
		"--memory-swap", strconv.Itoa(req.MemoriaMB) + "m",
		"--cpus", "1.0",
		"--pids-limit", "64",
		"--user", "65534:65534",
		"--cap-drop", "ALL",
		"--security-opt", "no-new-privileges",
		"-e", "HOME=/tmp",
		"-e", "PYTHONDONTWRITEBYTECODE=1",
		"-e", "PYTHONUNBUFFERED=1",
		imagen,
	}
	args = append(args, interno...)

	cmd := exec.CommandContext(ctxRun, d.dockerBin, args...)
	cmd.Stdin = strings.NewReader(req.Stdin)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	inicio := time.Now()
	runErr := cmd.Run()
	dur := time.Since(inicio)

	res := RunResult{
		Stdout:     stdout.String(),
		Stderr:     stderr.String(),
		DuracionMs: int(dur.Milliseconds()),
	}

	if runErr == nil {
		res.Estado = EstadoOK
		return res, nil
	}

	// Backstop del context: el contenedor quedó colgado más allá del margen.
	if ctxRun.Err() == context.DeadlineExceeded {
		res.Estado = EstadoTLE
		return res, nil
	}

	var exitErr *exec.ExitError
	if errors.As(runErr, &exitErr) {
		switch exitErr.ExitCode() {
		case 124:
			// `timeout` envió SIGTERM al expirar: límite de tiempo excedido.
			res.Estado = EstadoTLE
		case 137:
			// Terminado por SIGKILL: o el OOM-killer (memoria), o el `timeout`
			// (kill-after) ante un proceso que ignoró SIGTERM. Se distinguen por
			// el tiempo: un OOM ocurre mucho antes del límite; un timeout, al
			// alcanzarlo.
			if dur >= tiempo {
				res.Estado = EstadoTLE
			} else {
				res.Estado = EstadoMLE
			}
		default:
			res.Estado = EstadoRE
		}
		return res, nil
	}

	// No es un fallo del código sino de la invocación del sandbox (p. ej. Docker
	// no instalado o daemon caído): se reporta como error para el llamador.
	return res, fmt.Errorf("ejecutar sandbox docker: %w", runErr)
}

func getenv(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}
