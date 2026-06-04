# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Imagen del servicio catalog (ruta Fargate, PARQUEADA — ADR-07).
#
# IMPORTANTE: el contexto de build debe ser la RAÍZ del repositorio, porque el
# servicio depende del módulo compartido libs/platform (replace local). Construir:
#
#   docker build -f services/catalog/Dockerfile -t certready/catalog .
#
# La ruta de despliegue activa es Lambda (make package-lambda), que no usa Docker.
# ---------------------------------------------------------------------------

FROM golang:1.25-alpine AS builder
WORKDIR /src

# Copiar el módulo compartido y el del servicio (ambos necesarios por el replace).
COPY libs/platform/ ./libs/platform/
COPY services/catalog/ ./services/catalog/

WORKDIR /src/services/catalog
RUN go mod download
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/catalog ./cmd/server

# ---------------------------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot
USER nonroot:nonroot
COPY --from=builder /out/catalog /catalog
EXPOSE 8080
ENTRYPOINT ["/catalog"]
