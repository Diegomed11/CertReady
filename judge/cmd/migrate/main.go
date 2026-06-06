// Command migrate aplica las migraciones de Postgres del servicio judge y sale.
//
// Solo toca Postgres; no requiere MongoDB. Se setea un MONGO_URI placeholder si
// falta, para no obligar a definirlo en esta tarea (no se usa).
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/certready/certready/libs/platform/logging"
	"github.com/certready/certready/libs/platform/postgres"

	"github.com/certready/certready/judge/internal/config"
	"github.com/certready/certready/judge/internal/store"
	"github.com/certready/certready/judge/migrations"
)

func main() {
	if os.Getenv("JUDGE_MONGO_URI") == "" && os.Getenv("MONGO_URI") == "" {
		_ = os.Setenv("JUDGE_MONGO_URI", "mongodb://unused-for-migrate")
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
