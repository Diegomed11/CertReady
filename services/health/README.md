# Servicio `health`

Servicio mínimo de salud de CertReady. Es el "hello world" desplegable de la
**Fase 0** y la plantilla de referencia para los servicios Go: estructura,
configuración 12-factor, logging estructurado, *graceful shutdown* y sondas
versionadas. No tiene estado ni dependencias externas.

## Endpoints

| Método | Ruta         | Propósito                                             | Códigos     |
|--------|--------------|-------------------------------------------------------|-------------|
| `GET`  | `/v1/health` | Liveness — el proceso está vivo.                      | `200`       |
| `GET`  | `/v1/ready`  | Readiness — el servicio y sus dependencias están ok.  | `200`/`503` |

Respuesta (ejemplo de `/v1/health`):

```json
{ "status": "ok", "service": "health", "version": "dev", "time": "2026-06-03T12:00:00Z" }
```

## Configuración (variables de entorno)

| Variable                 | Default | Descripción                                  |
|--------------------------|---------|----------------------------------------------|
| `HEALTH_ADDR` / `PORT`   | `:8080` | Dirección de escucha (`HEALTH_ADDR` gana).   |
| `HEALTH_ENV`             | `dev`   | `dev` \| `staging` \| `prod` (ajusta el log).|
| `HEALTH_VERSION`         | `dev`   | Versión/imagen desplegada.                   |
| `HEALTH_READ_TIMEOUT`    | `5s`    | Timeout de lectura de la petición.           |
| `HEALTH_WRITE_TIMEOUT`   | `10s`   | Timeout de escritura de la respuesta.        |
| `HEALTH_IDLE_TIMEOUT`    | `60s`   | Timeout de conexiones keep-alive ociosas.    |
| `HEALTH_SHUTDOWN_GRACE`  | `15s`   | Margen de drenado en el apagado ordenado.    |

## Dos entrypoints, un mismo handler

El servicio expone un único `http.Handler` (`internal/httpapi.NewRouter`) servido
por dos entrypoints, según el destino de despliegue (ver **ADR-07**):

| Entrypoint    | Destino                          | Uso                                |
|---------------|----------------------------------|------------------------------------|
| `cmd/server`  | HTTP normal (local, contenedor)  | desarrollo y ruta Fargate (parqueada) |
| `cmd/lambda`  | AWS Lambda (Function URL)         | **despliegue de costo cero (activo)** |

La lógica de negocio no conoce el destino: migrar entre Lambda y Fargate es
cambiar el entrypoint y la IaC, no el dominio.

## Estructura

```
services/health/
├── cmd/server/main.go        # entrypoint HTTP: config, logger, ciclo de vida
├── cmd/lambda/main.go        # entrypoint Lambda: adapter sobre el mismo router
├── internal/config/          # carga de configuración desde el entorno
├── internal/logging/         # logger estructurado compartido
├── internal/httpapi/         # router, middleware y handlers de salud
├── Dockerfile                # build multi-stage → imagen distroless (ruta Fargate)
└── Makefile                  # fmt / vet / lint / test / build / lambda / docker
```

## Desarrollo

```bash
make run             # arranca el servidor HTTP en :8080
make check           # fmt + vet + test (previo a commit)
make package-lambda  # produce build/health-lambda.zip (artefacto de despliegue)
make docker          # imagen de contenedor (ruta Fargate, parqueada)
```

### Despliegue en Lambda (costo cero)

```bash
make package-lambda                       # compila bootstrap (arm64) y lo zipea
# El pipeline de CI sube el zip vía: aws lambda update-function-code
#   --function-name certready-dev-health --zip-file fileb://build/health-lambda.zip
```

Requisitos: Go ≥ 1.23. Dependencias: `aws-lambda-go` + `aws-lambda-go-api-proxy`
(justificadas por el destino Lambda; el resto del servicio es stdlib).
