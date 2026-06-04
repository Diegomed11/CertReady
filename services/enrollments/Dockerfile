# syntax=docker/dockerfile:1
# Imagen del servicio enrollments (ruta Fargate, PARQUEADA — ADR-07).
# El contexto de build debe ser la RAÍZ del repo (depende de libs/platform):
#   docker build -f services/enrollments/Dockerfile -t certready/enrollments .

FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY libs/platform/ ./libs/platform/
COPY services/enrollments/ ./services/enrollments/
WORKDIR /src/services/enrollments
RUN go mod download
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/enrollments ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
USER nonroot:nonroot
COPY --from=builder /out/enrollments /enrollments
EXPOSE 8080
ENTRYPOINT ["/enrollments"]
