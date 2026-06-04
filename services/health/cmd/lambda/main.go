// Command lambda adapta el servicio "health" para ejecutarse en AWS Lambda.
//
// Reutiliza exactamente el mismo http.Handler que el servidor HTTP
// (httpapi.NewRouter): la lógica de negocio no sabe que corre en Lambda. El
// adapter traduce los eventos de la Function URL (payload v2) a peticiones
// http.Request estándar y las respuestas de vuelta a la respuesta de Lambda.
//
// Esta es la ruta de despliegue de costo cero (ADR-07): Lambda + Function URL
// caen en la capa "always free" de AWS, sin NAT Gateway ni cómputo persistente.
package main

import (
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"

	"github.com/certready/certready/services/health/internal/config"
	"github.com/certready/certready/services/health/internal/httpapi"
	"github.com/certready/certready/services/health/internal/logging"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		// Sin logger todavía: se construye uno mínimo solo para reportar el fallo
		// fatal de configuración antes de abortar el arranque de la Lambda.
		logging.New(config.Config{ServiceName: "health", Env: "dev"}).
			Error("configuración inválida", "err", err.Error())
		panic(err)
	}

	logger := logging.New(cfg)

	router := httpapi.NewRouter(httpapi.Options{
		Service: cfg.ServiceName,
		Version: cfg.Version,
		Logger:  logger,
		Checks:  nil, // health no tiene dependencias externas que comprobar.
	})

	// La Function URL entrega eventos en formato de payload v2; NewV2 los traduce.
	// lambda.Start bloquea sirviendo invocaciones hasta que el runtime termina.
	logger.Info("lambda health inicializada", "version", cfg.Version, "env", cfg.Env)
	lambda.Start(httpadapter.NewV2(router).ProxyWithContext)
}
