// Command server arranca el servicio "health" de CertReady.
//
// Es el servicio mínimo desplegable de la Fase 0 (Fundaciones): expone las
// sondas de liveness y readiness versionadas y sirve para validar el camino
// completo build → imagen → despliegue antes de construir los servicios de
// negocio. No mantiene estado ni habla con bases de datos.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/certready/certready/services/health/internal/config"
	"github.com/certready/certready/services/health/internal/httpapi"
	"github.com/certready/certready/services/health/internal/logging"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		// Aún no hay logger configurado: se reporta a stderr y se aborta, porque
		// arrancar con configuración inválida es peor que no arrancar.
		slog.New(slog.NewJSONHandler(os.Stderr, nil)).
			Error("configuración inválida", slog.String("err", err.Error()))
		os.Exit(1)
	}

	logger := logging.New(cfg)

	if err := run(cfg, logger); err != nil {
		logger.Error("el servicio terminó con error", slog.String("err", err.Error()))
		os.Exit(1)
	}
	logger.Info("servicio detenido limpiamente")
}

// run arranca el servidor HTTP y bloquea hasta que se recibe una señal de
// terminación o el servidor falla.
//
// Parameters
//
//	cfg    : configuración resuelta del servicio.
//	logger : logger estructurado raíz.
//
// Returns
//
//	error : nil en un apagado ordenado; el error de arranque o de apagado en
//	        caso contrario.
//
// Flujo: ante SIGINT/SIGTERM se deja de aceptar conexiones nuevas y se concede a
// las en curso un margen (ShutdownGrace) para terminar antes de cerrar.
func run(cfg config.Config, logger *slog.Logger) error {
	router := httpapi.NewRouter(httpapi.Options{
		Service: cfg.ServiceName,
		Version: cfg.Version,
		Logger:  logger,
		Checks:  nil, // health no tiene dependencias externas que comprobar.
	})

	srv := &http.Server{
		Addr:         cfg.Addr,
		Handler:      router,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
	}

	// La señal de terminación cancela este context, que dispara el apagado.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// El servidor corre en su propia goroutine; su error de arranque viaja por
	// el canal para no quedar atrapado fuera del select.
	serverErr := make(chan error, 1)
	go func() {
		// env y service ya los aporta el logger base (newLogger); aquí solo se
		// añaden los atributos propios del arranque para no duplicar claves.
		logger.Info("servicio escuchando",
			slog.String("addr", cfg.Addr),
			slog.String("version", cfg.Version),
		)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
		logger.Info("señal de terminación recibida; iniciando apagado ordenado")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownGrace)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}
	return nil
}
