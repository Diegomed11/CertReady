# Servicio `content`

Material de estudio de CertReady (lecciones, en markdown u otros formatos). Go +
MongoDB. Es el primer servicio que usa MongoDB en lugar de PostgreSQL, por la
naturaleza heterogénea del contenido (ver §8 del documento de arquitectura).

## Endpoints (`/v1`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET`  | `/v1/health` | — | Liveness. |
| `GET`  | `/v1/ready` | — | Readiness (ping a MongoDB). |
| `GET`  | `/v1/content` | público | Lista. Filtros: `certificacion`, `tema`, `limit`, `offset`. |
| `GET`  | `/v1/content/{id}` | público | Detalle por id. |
| `POST` | `/v1/content` | **admin** | Crear material. |

## Configuración (variables de entorno)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `CONTENT_MONGO_URI` / `MONGO_URI` | — (**obligatoria**) | Cadena de conexión a MongoDB. |
| `CONTENT_MONGO_DB` | `certready` | Base de datos en MongoDB. |
| `CONTENT_OIDC_ISSUER` / `OIDC_ISSUER` | — | Emisor OIDC. Vacío ⇒ admin responde 501. |
| `CONTENT_OIDC_AUDIENCE` / `OIDC_AUDIENCE` | — | Audiencia esperada del token. |
| `CONTENT_ADDR` / `PORT` | `:8080` | Dirección de escucha. |
| `CONTENT_ENV` | `dev` | `dev` \| `staging` \| `prod`. |

## Desarrollo

```bash
export MONGO_URI='mongodb://localhost:27017'
go run ./cmd/server

# Tests (integración del store si hay Mongo de prueba):
export CONTENT_TEST_MONGO_URI='mongodb://localhost:27017'
make test
```

Requisitos: Go ≥ 1.25, MongoDB ≥ 6. Las consultas se construyen con documentos
BSON parametrizados (sin concatenar entrada del usuario): defensa contra
inyección NoSQL.
