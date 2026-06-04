// Package logging construye el logger estructurado raíz compartido por los
// servicios del monorepo, con configuración uniforme (JSON, nivel por entorno).
package logging

import (
	"log/slog"
	"os"
)

// New construye el logger estructurado raíz en formato JSON.
//
// Parameters
//
//	service : nombre lógico del servicio; se añade como atributo base.
//	env     : entorno de ejecución ("dev" | "staging" | "prod").
//
// Returns
//
//	*slog.Logger : logger con `service` y `env` como atributos base.
//
// El nivel sube a DEBUG fuera de producción para facilitar el desarrollo y se
// mantiene en INFO en prod para reducir volumen y costo de logs.
func New(service, env string) *slog.Logger {
	level := slog.LevelInfo
	if env != "prod" {
		level = slog.LevelDebug
	}
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	return slog.New(handler).With(
		slog.String("service", service),
		slog.String("env", env),
	)
}
