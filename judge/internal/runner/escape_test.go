package runner_test

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/certready/certready/judge/internal/runner"
)

// Esta es la "prueba estrella" de seguridad: somete al sandbox a código hostil y
// exige contención. Requiere Docker y la imagen del runner; se habilita con
// JUDGE_DOCKER_TESTS=1 (ver judge/README.md y .claude/rules/judge.md).
//
//	make runner-image
//	JUDGE_DOCKER_TESTS=1 go test ./internal/runner/...

func nuevoRunner(t *testing.T) *runner.DockerRunner {
	t.Helper()
	if os.Getenv("JUDGE_DOCKER_TESTS") == "" {
		t.Skip("define JUDGE_DOCKER_TESTS=1 para la suite de sandbox (requiere Docker e imagen certready/judge-python)")
	}
	return runner.NewDockerRunner()
}

func correr(t *testing.T, fuente, stdin string, tiempoMs int) runner.RunResult {
	t.Helper()
	r := nuevoRunner(t)
	res, err := r.Run(context.Background(), runner.RunRequest{
		Lenguaje: "python", Fuente: fuente, Stdin: stdin, TiempoMs: tiempoMs, MemoriaMB: 64,
	})
	if err != nil {
		t.Fatalf("el sandbox no está disponible (¿Docker e imagen?): %v", err)
	}
	return res
}

// TestSandboxEjecutaCorrecto: código legítimo produce su salida (control positivo).
func TestSandboxEjecutaCorrecto(t *testing.T) {
	res := correr(t, "print(sum(map(int, input().split())))", "2 3", 2000)
	if res.Estado != runner.EstadoOK {
		t.Fatalf("estado = %s; quería ok (stderr: %s)", res.Estado, res.Stderr)
	}
	if strings.TrimSpace(res.Stdout) != "5" {
		t.Fatalf("stdout = %q; quería 5", res.Stdout)
	}
}

// TestSandboxSinRed: no debe poder abrir conexiones de red (--network none).
func TestSandboxSinRed(t *testing.T) {
	fuente := `
import socket
try:
    socket.create_connection(("1.1.1.1", 53), timeout=3)
    print("RED_OK")
except Exception as e:
    print("RED_BLOQUEADA", type(e).__name__)
`
	res := correr(t, fuente, "", 5000)
	if strings.Contains(res.Stdout, "RED_OK") {
		t.Fatalf("FUGA: el sandbox alcanzó la red:\n%s", res.Stdout)
	}
}

// TestSandboxFSReadOnly: no debe poder escribir fuera de /tmp (raíz solo lectura).
func TestSandboxFSReadOnly(t *testing.T) {
	fuente := `
try:
    open("/etc/escape", "w").write("x")
    print("ESCRITURA_OK")
except Exception as e:
    print("ESCRITURA_BLOQUEADA", type(e).__name__)
`
	res := correr(t, fuente, "", 3000)
	if strings.Contains(res.Stdout, "ESCRITURA_OK") {
		t.Fatalf("FUGA: el sandbox escribió en el sistema de archivos:\n%s", res.Stdout)
	}
}

// TestSandboxFSSandboxReadOnly: el propio /sandbox (código) es de solo lectura.
func TestSandboxFSSandboxReadOnly(t *testing.T) {
	fuente := `
try:
    open("/sandbox/escape", "w").write("x")
    print("SANDBOX_ESCRIBIBLE")
except Exception as e:
    print("SANDBOX_RO", type(e).__name__)
`
	res := correr(t, fuente, "", 3000)
	if strings.Contains(res.Stdout, "SANDBOX_ESCRIBIBLE") {
		t.Fatalf("FUGA: /sandbox no era de solo lectura:\n%s", res.Stdout)
	}
}

// TestSandboxForkBomb: una fork-bomb debe quedar contenida (--pids-limit) sin
// tumbar el host; la ejecución termina con un estado de fallo.
func TestSandboxForkBomb(t *testing.T) {
	fuente := `
import os
while True:
    os.fork()
`
	res := correr(t, fuente, "", 3000)
	if res.Estado == runner.EstadoOK {
		t.Fatalf("la fork-bomb terminó en estado ok; se esperaba contención")
	}
}

// TestSandboxMemoria: superar el límite de memoria debe abortar (OOM ⇒ mle), sin
// afectar al host. Se acepta también re por si el runtime aborta antes del OOM.
func TestSandboxMemoria(t *testing.T) {
	fuente := `
x = bytearray(512 * 1024 * 1024)  # 512 MiB > límite de 64 MiB
print("MEM_OK", len(x))
`
	res := correr(t, fuente, "", 5000)
	if strings.Contains(res.Stdout, "MEM_OK") {
		t.Fatalf("FUGA: el sandbox asignó memoria por encima del límite:\n%s", res.Stdout)
	}
	if res.Estado != runner.EstadoMLE && res.Estado != runner.EstadoRE {
		t.Fatalf("estado = %s; quería mle (o re) por exceso de memoria", res.Estado)
	}
}

// TestSandboxTiempo: un bucle infinito debe cortarse por límite de tiempo (tle).
func TestSandboxTiempo(t *testing.T) {
	res := correr(t, "while True:\n    pass", "", 1000)
	if res.Estado != runner.EstadoTLE {
		t.Fatalf("estado = %s; quería tle", res.Estado)
	}
}
