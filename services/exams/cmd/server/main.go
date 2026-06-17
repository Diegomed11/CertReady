// Command server arranca el servicio exams como servidor HTTP.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/httpx"
	"github.com/certready/certready/libs/platform/logging"
	pmongo "github.com/certready/certready/libs/platform/mongo"
	"github.com/certready/certready/libs/platform/postgres"

	"github.com/certready/certready/services/exams/internal/config"
	"github.com/certready/certready/services/exams/internal/httpapi"
	"github.com/certready/certready/services/exams/internal/store"
	"github.com/certready/certready/services/exams/migrations"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.New(slog.NewJSONHandler(os.Stderr, nil)).
			Error("configuración inválida", slog.String("err", err.Error()))
		os.Exit(1)
	}

	logger := logging.New(cfg.ServiceName, cfg.Env)
	if err := run(cfg, logger); err != nil {
		logger.Error("el servicio terminó con error", slog.String("err", err.Error()))
		os.Exit(1)
	}
	logger.Info("servicio detenido limpiamente")
}

func run(cfg config.Config, logger *slog.Logger) error {
	ctx := context.Background()

	pool, err := postgres.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	mclient, err := pmongo.Connect(ctx, cfg.MongoURI)
	if err != nil {
		return err
	}
	defer func() { _ = mclient.Disconnect(context.Background()) }()

	if cfg.AutoMigrate {
		if err := store.Migrate(ctx, pool, migrations.FS); err != nil {
			return fmt.Errorf("aplicar migraciones: %w", err)
		}
		logger.Info("migraciones aplicadas")
	}

	authn, err := buildAuth(ctx, cfg, logger)
	if err != nil {
		return err
	}

	router := httpapi.NewRouter(httpapi.Options{
		Service:       cfg.ServiceName,
		Version:       cfg.Version,
		Logger:        logger,
		Preguntas:     store.NewPreguntas(mclient.Database(cfg.MongoDB)),
		Sesiones:      store.NewSesiones(pool),
		Auth:          authn,
		NumPorDefecto: cfg.DefaultPregntas,
		Pool:          pool,
		RLSEnabled:    cfg.RLSEnabled,
	})

	srv := &http.Server{
		Addr:         cfg.Addr,
		Handler:      httpx.MaxBytes(httpx.DefaultMaxBodyBytes)(httpx.RateLimit(httpx.DefaultRPS, httpx.DefaultBurst)(router)),
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
	}

	signalCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("servicio escuchando", slog.String("addr", cfg.Addr), slog.String("version", cfg.Version))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case err := <-serverErr:
		return err
	case <-signalCtx.Done():
		logger.Info("señal de terminación recibida; iniciando apagado ordenado")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownGrace)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func buildAuth(ctx context.Context, cfg config.Config, logger *slog.Logger) (*auth.Authenticator, error) {
	if cfg.OIDCIssuer == "" {
		logger.Warn("OIDC no configurado: las rutas protegidas responderán 501")
		return nil, nil
	}
	authn, err := auth.New(ctx, auth.Config{Issuer: cfg.OIDCIssuer, Audience: cfg.OIDCAudience})
	if err != nil {
		return nil, fmt.Errorf("inicializar OIDC: %w", err)
	}
	logger.Info("auth OIDC habilitada", slog.String("issuer", cfg.OIDCIssuer))
	return authn, nil
}
