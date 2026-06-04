# Servicio `catalog`

Catálogo de estudio de CertReady: certificaciones, temas y pistas de entrevista.
Go + PostgreSQL. Es el primer servicio de datos (Fase 1, Incremento 1).

> Diseño completo: [`docs/fase-1-diseno.md`](../../docs/fase-1-diseno.md).
> Las **inscripciones** viven en el servicio `enrollments` (ADR-09), no aquí.

## Endpoints (`/v1`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/v1/health` | Liveness. |
| `GET`  | `/v1/ready` | Readiness (incluye ping a Postgres). |
| `GET`  | `/v1/certifications` | Lista. Filtros: `proveedor`, `nivel`, `activo`, `limit`, `offset`. |
| `GET`  | `/v1/certifications/{idOrSlug}` | Detalle por UUID o slug. |
| `GET`  | `/v1/certifications/{id}/topics` | Temas de una certificación. |
| `GET`  | `/v1/topics/{id}` | Detalle de tema. |
| `GET`  | `/v1/tracks` | Lista de pistas. Filtros: `puesto`, `area`. |
| `GET`  | `/v1/tracks/{idOrSlug}` | Detalle de pista. |
| `POST` | `/v1/certifications` | Crear (admin — **gated 501** hasta Inc. 2). |

Envoltura de lista: `{ "data": [...], "count": n, "next_offset": n|null }`.
Envoltura de error: `{ "error": { "code", "message", "details" } }`.

## Configuración (variables de entorno)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `CATALOG_DATABASE_URL` / `DATABASE_URL` | — (**obligatoria**) | DSN de Postgres. |
| `CATALOG_ADDR` / `PORT` | `:8080` | Dirección de escucha. |
| `CATALOG_ENV` | `dev` | `dev` \| `staging` \| `prod`. |
| `CATALOG_VERSION` | `dev` | Versión desplegada. |
| `CATALOG_AUTO_MIGRATE` | `false` | Si `true`, migra al arrancar (en deploy: usar `cmd/migrate`). |

## Estructura

```
services/catalog/
├── cmd/server/      # entrypoint HTTP (local / Fargate parqueado)
├── cmd/lambda/      # entrypoint Lambda (despliegue de costo cero)
├── cmd/migrate/     # aplica migraciones y sale
├── internal/
│   ├── catalog/     # dominio + validación
│   ├── store/       # repositorio Postgres (pgx) + runner de migraciones
│   ├── config/      # configuración 12-factor
│   └── httpapi/     # router, handlers, interfaz CatalogStore
├── migrations/      # 0001_init.up.sql / .down.sql (+ embed.go)
├── Dockerfile       # ruta Fargate (contexto = raíz del repo)
└── Makefile
```

Comparte logging, middleware, salud y pool de Postgres con la librería
[`libs/platform`](../../libs/platform) vía el workspace Go (`go.work`).

## Desarrollo

```bash
export DATABASE_URL='postgres://user:pass@localhost:5432/certready_dev?sslmode=disable&search_path=catalog'
make migrate     # crea el esquema catalog y sus tablas
make run         # arranca en :8080

# Tests (unitarios siempre; integración del store si hay base de prueba):
export CATALOG_TEST_DATABASE_URL='postgres://user:pass@localhost:5432/certready_test?sslmode=disable'
make test
```

Requisitos: Go ≥ 1.25, PostgreSQL ≥ 13 (para `gen_random_uuid()` nativo).
