# Servicio `exams`

Banco de preguntas y exámenes de práctica de CertReady. Go + MongoDB (preguntas)
+ PostgreSQL (sesiones e intentos). Implementa el ciclo "simulacro → score →
repaso" para preguntas de opción múltiple.

> Las preguntas son contenido heterogéneo y viven en MongoDB (§8). Las sesiones
> y los intentos son transaccionales y viven en PostgreSQL (§7); son la fuente
> que alimentará la analítica de la Fase 4.

## Endpoints (`/v1`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET`  | `/v1/health` | — | Liveness. |
| `GET`  | `/v1/ready` | — | Readiness (ping a MongoDB y Postgres). |
| `POST` | `/v1/exams/sessions` | usuario | Inicia un simulacro: `{certificacion, num_preguntas?, modo?}`. Devuelve preguntas sin respuestas. |
| `POST` | `/v1/exams/sessions/{id}/submit` | usuario (propia) | Entrega `{respuestas:[{ref, seleccion}]}`, califica y cierra. |
| `GET`  | `/v1/exams/sessions/{id}` | usuario (propia) | Consulta/repaso. Finalizada ⇒ incluye respuestas correctas y explicaciones. |
| `GET`  | `/v1/me/exams` | usuario | Lista las sesiones propias. |
| `POST` | `/v1/questions` | **admin** | Crea una pregunta en el banco. |

Defensa anti-IDOR/BOLA: las sesiones e intentos se acotan siempre al `sub` del
token; una sesión ajena o inexistente responde `404` indistinto. Durante el
examen, las preguntas se entregan sin la respuesta correcta.

## Configuración (variables de entorno)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `EXAMS_DATABASE_URL` / `DATABASE_URL` | — (**obligatoria**) | Postgres (sesiones e intentos). |
| `EXAMS_MONGO_URI` / `MONGO_URI` | — (**obligatoria**) | MongoDB (banco de preguntas). |
| `EXAMS_MONGO_DB` | `certready` | Base de datos en MongoDB. |
| `EXAMS_OIDC_ISSUER` / `OIDC_ISSUER` | — | Emisor OIDC. Vacío ⇒ rutas protegidas 501. |
| `EXAMS_OIDC_AUDIENCE` / `OIDC_AUDIENCE` | — | Audiencia esperada del token. |
| `EXAMS_DEFAULT_PREGUNTAS` | `10` | Preguntas por simulacro si no se indica. |
| `EXAMS_AUTO_MIGRATE` | `false` | Migrar Postgres al arrancar (en deploy: usar `cmd/migrate`). |
| `EXAMS_ADDR` / `PORT` | `:8080` | Dirección de escucha. |

## Desarrollo

```bash
export DATABASE_URL='postgres://postgres@localhost:5432/certready_dev?sslmode=disable'
export MONGO_URI='mongodb://localhost:27017'
make migrate     # crea el esquema exams en Postgres
make run

# Tests de integración:
export EXAMS_TEST_DATABASE_URL='postgres://postgres@localhost:5432/certready_test?sslmode=disable'
export EXAMS_TEST_MONGO_URI='mongodb://localhost:27017'
make test
```

Requisitos: Go ≥ 1.25, PostgreSQL ≥ 13, MongoDB ≥ 6.
