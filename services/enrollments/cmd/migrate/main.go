// Command migrate aplica las migraciones pendientes del servicio enrollments y sale.
//
// Nota: `migrate` no necesita ENROLLMENTS_CATALOG_URL; toca solo Postgres. Para
// no obligar al operador a definirla en este comando, se setea un placeholder
// si está ausente antes de cargar la configuración (el valor no se usa).
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/certready/certready/libs/platform/logging"
	"github.com/certready/certready/libs/platform/postgres"

	"github.com/certready/certready/services/enrollments/internal/config"
	"github.com/certready/certready/services/enrollments/internal/store"
	"github.com/certready/certready/services/enrollments/migrations"
)

func main() {
	if os.Getenv("ENROLLMENTS_CATALOG_URL") == "" {
		_ = os.Setenv("ENROLLMENTS_CATALOG_URL", "http://unused-for-migrate")
	}

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
