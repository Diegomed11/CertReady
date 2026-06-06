# Servicio `problems`

Banco de ejercicios para la preparación de entrevistas técnicas: **problemas de
código** (tipo LeetCode, evaluados por el juez de código) y **preguntas de Q&A**
por puesto/área (material de autoestudio). Go + MongoDB.

Los problemas guardan sus casos de prueba, incluidos los **ocultos** con su salida
esperada. La API pública **nunca** expone los casos ocultos: el juez de código los
lee del lado del servidor para calificar (ver servicio `judge` y ADR-11).

## Endpoints (`/v1`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET`  | `/v1/health` | — | Liveness. |
| `GET`  | `/v1/ready` | — | Readiness (ping a MongoDB). |
| `GET`  | `/v1/problems` | público | Lista. Filtros: `area`, `dificultad`, `etiqueta`, `limit`, `offset`. Sin casos ocultos. |
| `GET`  | `/v1/problems/{id}` | público | Detalle. Solo casos visibles (de ejemplo). |
| `POST` | `/v1/problems` | **admin** | Crear problema (con casos ocultos). |
| `GET`  | `/v1/qa` | público | Lista. Filtros: `puesto`, `area`, `categoria`, `limit`, `offset`. |
| `GET`  | `/v1/qa/{id}` | público | Detalle de pregunta de Q&A. |
| `POST` | `/v1/qa` | **admin** | Crear pregunta de Q&A. |

## Configuración (variables de entorno)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PROBLEMS_MONGO_URI` / `MONGO_URI` | — (**obligatoria**) | Cadena de conexión a MongoDB. |
| `PROBLEMS_MONGO_DB` | `certready` | Base de datos en MongoDB. |
| `PROBLEMS_OIDC_ISSUER` / `OIDC_ISSUER` | — | Emisor OIDC. Vacío ⇒ admin responde 501. |
| `PROBLEMS_OIDC_AUDIENCE` / `OIDC_AUDIENCE` | — | Audiencia esperada del token. |
| `PROBLEMS_ADDR` / `PORT` | `:8080` | Dirección de escucha. |
| `PROBLEMS_ENV` | `dev` | `dev` \| `staging` \| `prod`. |

## Desarrollo

```bash
export MONGO_URI='mongodb://localhost:27017'
go run ./cmd/server

# Tests (integración del store si hay Mongo de prueba):
export PROBLEMS_TEST_MONGO_URI='mongodb://localhost:27017'
make test
```

Requisitos: Go ≥ 1.25, MongoDB ≥ 6. Las consultas se construyen con documentos
BSON parametrizados (sin concatenar entrada del usuario): defensa contra inyección
NoSQL. La proyección a "vista pública" garantiza que los casos ocultos no salgan
por la API.
