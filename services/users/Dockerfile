# syntax=docker/dockerfile:1
# Imagen del servicio users (ruta Fargate, PARQUEADA — ADR-07).
# El contexto de build debe ser la RAÍZ del repo (depende de libs/platform):
#   docker build -f services/users/Dockerfile -t certready/users .

FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY libs/platform/ ./libs/platform/
COPY services/users/ ./services/users/
WORKDIR /src/services/users
RUN go mod download
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/users ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
USER nonroot:nonroot
COPY --from=builder /out/users /users
EXPOSE 8080
ENTRYPOINT ["/users"]
