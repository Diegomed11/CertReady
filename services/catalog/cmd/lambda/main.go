// Command lambda adapta el servicio catalog para AWS Lambda (ruta de costo cero,
// ADR-07). Reutiliza el mismo router que cmd/server tras un adapter de Function URL.
//
// El pool de Postgres se crea una vez en el arranque (init) y se reutiliza entre
// invocaciones. Las migraciones NO se aplican aquí por defecto: se ejecutan como
// paso de despliegue con cmd/migrate, no en cada cold start.
package main

import (
	"context"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/logging"
	"github.com/certready/certready/libs/platform/postgres"

	"github.com/certready/certready/services/catalog/internal/config"
	"github.com/certready/certready/services/catalog/internal/httpapi"
	"github.com/certready/certready/services/catalog/internal/store"
	"github.com/certready/certready/services/catalog/migrations"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		logging.New("catalog", "dev").Error("configuración inválida", "err", err.Error())
		panic(err)
	}

	logger := logging.New(cfg.ServiceName, cfg.Env)
	ctx := context.Background()

	pool, err := postgres.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("no se pudo conectar a Postgres", "err", err.Error())
		panic(err)
	}

	if cfg.AutoMigrate {
		if err := store.Migrate(ctx, pool, migrations.FS); err != nil {
			logger.Error("fallaron las migraciones", "err", err.Error())
			panic(err)
		}
	}

	var authn *auth.Authenticator
	if cfg.OIDCIssuer != "" {
		authn, err = auth.New(ctx, auth.Config{Issuer: cfg.OIDCIssuer, Audience: cfg.OIDCAudience})
		if err != nil {
			logger.Error("no se pudo inicializar OIDC", "err", err.Error())
			panic(err)
		}
	}

	router := httpapi.NewRouter(httpapi.Options{
		Service: cfg.ServiceName,
		Version: cfg.Version,
		Logger:  logger,
		Store:   store.New(pool),
		Auth:    authn,
	})

	logger.Info("lambda catalog inicializada", "version", cfg.Version, "env", cfg.Env)
	lambda.Start(httpadapter.NewV2(router).ProxyWithContext)
}
