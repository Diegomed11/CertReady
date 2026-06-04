// Command migrate aplica las migraciones pendientes del servicio catalog y sale.
//
// Se ejecuta como paso de despliegue (o en desarrollo local) separado del
// arranque del servicio, para no acoplar el ciclo de vida del servidor/Lambda a
// los cambios de esquema.
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/certready/certready/libs/platform/logging"
	"github.com/certready/certready/libs/platform/postgres"

	"github.com/certready/certready/services/catalog/internal/config"
	"github.com/certready/certready/services/catalog/internal/store"
	"github.com/certready/certready/services/catalog/migrations"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.New(slog.NewJSONHandler(os.Stderr, nil)).
			Error("configuración inválida", slog.String("err", err.Error()))
		os.Exit(1)
	}

	logger := logging.New(cfg.ServiceName, cfg.Env)
	ctx := context.Background()

	pool, err := postgres.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("no se pudo conectar a Postgres", slog.String("err", err.Error()))
		os.Exit(1)
	}
	defer pool.Close()

	if err := store.Migrate(ctx, pool, migrations.FS); err != nil {
		logger.Error("fallaron las migraciones", slog.String("err", err.Error()))
		os.Exit(1)
	}
	logger.Info("migraciones aplicadas correctamente")
}
