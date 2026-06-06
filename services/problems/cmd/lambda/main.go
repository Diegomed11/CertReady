// Command lambda adapta el servicio problems para AWS Lambda (ruta de costo cero).
package main

import (
	"context"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/logging"
	pmongo "github.com/certready/certready/libs/platform/mongo"

	"github.com/certready/certready/services/problems/internal/config"
	"github.com/certready/certready/services/problems/internal/httpapi"
	"github.com/certready/certready/services/problems/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		logging.New("problems", "dev").Error("configuración inválida", "err", err.Error())
		panic(err)
	}

	logger := logging.New(cfg.ServiceName, cfg.Env)
	ctx := context.Background()

	client, err := pmongo.Connect(ctx, cfg.MongoURI)
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
		Service: cfg.ServiceName,
		Version: cfg.Version,
		Logger:  logger,
		Store:   store.New(client.Database(cfg.MongoDB)),
		Auth:    authn,
	})

	logger.Info("lambda problems inicializada", "version", cfg.Version, "env", cfg.Env)
	lambda.Start(httpadapter.NewV2(router).ProxyWithContext)
}
