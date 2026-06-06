# syntax=docker/dockerfile:1
# Imagen del servicio content (ruta Fargate, PARQUEADA — ADR-07).
# El contexto de build debe ser la RAÍZ del repo (depende de libs/platform):
#   docker build -f services/content/Dockerfile -t certready/content .

FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY libs/platform/ ./libs/platform/
COPY services/content/ ./services/content/
WORKDIR /src/services/content
RUN go mod download
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/content ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
USER nonroot:nonroot
COPY --from=builder /out/content /content
EXPOSE 8080
ENTRYPOINT ["/content"]
