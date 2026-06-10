# syntax=docker/dockerfile:1
# Imagen del servicio progress (despliegue PARQUEADO — ADR-07).
# El contexto de build debe ser la RAÍZ del repo (depende de libs/platform):
#   docker build -f services/progress/Dockerfile -t certready/progress .

FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY libs/platform/ ./libs/platform/
COPY services/progress/ ./services/progress/
WORKDIR /src/services/progress
RUN go mod download
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/progress ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
USER nonroot:nonroot
COPY --from=builder /out/progress /progress
EXPOSE 8080
ENTRYPOINT ["/progress"]
