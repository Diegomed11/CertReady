# syntax=docker/dockerfile:1
# Imagen del servicio problems (ruta Fargate, PARQUEADA — ADR-07).
# El contexto de build debe ser la RAÍZ del repo (depende de libs/platform):
#   docker build -f services/problems/Dockerfile -t certready/problems .

FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY libs/platform/ ./libs/platform/
COPY services/problems/ ./services/problems/
WORKDIR /src/services/problems
RUN go mod download
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/problems ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
USER nonroot:nonroot
COPY --from=builder /out/problems /problems
EXPOSE 8080
ENTRYPOINT ["/problems"]
