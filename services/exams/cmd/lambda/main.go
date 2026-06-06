// Command lambda adapta el servicio exams para AWS Lambda (ruta de costo cero).
package main

import (
	"context"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/logging"
	pmongo "github.com/certready/certready/libs/platform/mongo"
	"github.com/certready/certready/libs/platform/postgres"

	"github.com/certready/certready/services/exams/internal/config"
	"github.com/certready/certready/services/exams/internal/httpapi"
	"github.com/certready/certready/services/exams/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		logging.New("exams", "dev").Error("configuración inválida", "err", err.Error())
		panic(err)
	}

	logger := logging.New(cfg.ServiceName, cfg.Env)
	ctx := context.Background()

	pool, err := postgres.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("no se pudo conectar a Postgres", "err", err.Error())
		panic(err)
	}
	mclient, err := pmongo.Connect(ctx, cfg.MongoURI)
	if err != nil {
		logger.Error("no se pudo conectar a MongoDB", "err", err.Error())
		panic(err)
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
		Service:       cfg.ServiceName,
		Version:       cfg.Version,
		Logger:        logger,
		Preguntas:     store.NewPreguntas(mclient.Database(cfg.MongoDB)),
		Sesiones:      store.NewSesiones(pool),
		Auth:          authn,
		NumPorDefecto: cfg.DefaultPregntas,
	})

	logger.Info("lambda exams inicializada", "version", cfg.Version, "env", cfg.Env)
	lambda.Start(httpadapter.NewV2(router).ProxyWithContext)
}
