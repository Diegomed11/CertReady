# syntax=docker/dockerfile:1
# Imagen del servicio judge (orquestador). Ruta de producción: Fargate (ADR-11);
# el juez NO usa Lambda porque necesita un daemon de Docker para el sandbox.
# El contexto de build debe ser la RAÍZ del repo (depende de libs/platform):
#   docker build -f judge/Dockerfile -t certready/judge .
#
# Nota: en ejecución, este contenedor necesita acceso a un daemon de Docker para
# lanzar los runners efímeros (en Fargate, vía la configuración de la tarea). El
# binario `docker` (cliente) debe estar disponible en la imagen de despliegue.

FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY libs/platform/ ./libs/platform/
COPY judge/ ./judge/
WORKDIR /src/judge
RUN go mod download
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/judge ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache docker-cli
COPY --from=builder /out/judge /usr/local/bin/judge
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/judge"]
