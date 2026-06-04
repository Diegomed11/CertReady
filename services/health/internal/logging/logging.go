// Package logging construye el logger estructurado raíz del servicio.
//
// Se aísla en su propio paquete para que los distintos entrypoints (servidor
// HTTP en cmd/server y función Lambda en cmd/lambda) compartan exactamente la
// misma configuración de logging sin duplicarla.
package logging

import (
	"log/slog"
	"os"

	"github.com/certready/certready/services/health/internal/config"
)

// New construye el logger estructurado raíz en formato JSON.
//
// Parameters
//
//	cfg : configuración del servicio; determina el nivel y los atributos base.
//
// Returns
//
//	*slog.Logger : logger con `service` y `env` como atributos base.
//
// El nivel sube a DEBUG fuera de producción para facilitar el desarrollo y se
// mantiene en INFO en prod para reducir volumen y costo de CloudWatch.
func New(cfg config.Config) *slog.Logger {
	level := slog.LevelInfo
	if cfg.Env != "prod" {
		level = slog.LevelDebug
	}
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	return slog.New(handler).With(
		slog.String("service", cfg.ServiceName),
		slog.String("env", cfg.Env),
	)
}
