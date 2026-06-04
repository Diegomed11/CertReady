# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Imagen del servicio "health" — build multi-stage.
#
# Etapa 1 (builder): compila un binario estático con CGO deshabilitado.
# Etapa 2 (runtime) : copia solo el binario sobre una base mínima distroless,
#                     sin shell ni gestor de paquetes → superficie de ataque
#                     y tamaño de imagen mínimos (alineado con ADR-01/Go).
# ---------------------------------------------------------------------------

FROM golang:1.23-alpine AS builder

WORKDIR /src

# Capa de dependencias cacheable: solo se invalida si cambian go.mod/go.sum.
COPY go.mod ./
# go.sum se copia si existe; el servicio health no tiene dependencias externas.
COPY go.su[m] ./
RUN go mod download

COPY . .

# Binario estático y reproducible: sin CGO, símbolos de depuración recortados.
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/health ./cmd/server

# ---------------------------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot

# Ejecuta como usuario sin privilegios (uid 65532) provisto por la base.
USER nonroot:nonroot

COPY --from=builder /out/health /health

EXPOSE 8080
ENTRYPOINT ["/health"]
