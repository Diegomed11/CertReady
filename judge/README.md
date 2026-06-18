# Servicio `judge` (juez de código)

Subsistema de **mayor riesgo** del proyecto: ejecuta código de terceros contra
casos de prueba en un **sandbox aislado** y emite un veredicto. Go (orquestación)
+ contenedores Docker efímeros (ejecución) + MongoDB (problemas, solo lectura) +
PostgreSQL (ejecuciones).

Primera ronda: **Python**. La interfaz `Runner` permite añadir lenguajes sin
tocar la calificación.

## Modelo de ejecución y aislamiento

Cada caso se ejecuta en un contenedor efímero endurecido (ver
`internal/runner/docker.go` y `.claude/rules/judge.md`):

- sin red (`--network none`);
- raíz de solo lectura (`--read-only`) y `/tmp` en tmpfs (`noexec,nosuid,size=64m`);
- el código del usuario se monta **solo lectura** en `/sandbox`;
- límites de memoria (sin swap), CPU y PIDs (`--pids-limit`, anti fork-bomb);
- usuario sin privilegios, `--cap-drop ALL`, `--security-opt no-new-privileges`;
- corte de tiempo con `timeout` dentro del contenedor + backstop por context.

La ejecución es **síncrona** en esta fase; la cola y los resultados por evento se
difieren a escala (ADR-11). El despliegue del juez va a **Fargate**, no a Lambda
(necesita un daemon de Docker).

## Anti-fuga

Los problemas guardan casos **ocultos** con su salida esperada en MongoDB. El juez
los lee del lado del servidor para calificar; la respuesta de una ejecucion reporta
de cada caso oculto solo su estado (passed/wrong/tle/mle/re), nunca su entrada ni
sus salidas. Los casos visibles sí muestran el diff.

## Endpoints (`/v1`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET`  | `/v1/health` | — | Liveness. |
| `GET`  | `/v1/ready` | — | Readiness (ping a MongoDB y Postgres). |
| `POST` | `/v1/judge/runs` | estudiante | Enviar código y calificar. Cuerpo: `{problema_ref, lenguaje, fuente}`. |
| `GET`  | `/v1/judge/runs/{id}` | estudiante | Consultar una ejecucion propia (ajena ⇒ 404). |
| `GET`  | `/v1/me/judge/runs` | estudiante | Historial de ejecuciones propio. |

## Configuración (variables de entorno)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `JUDGE_DATABASE_URL` / `DATABASE_URL` | — (**obligatoria**) | Postgres (ejecuciones). |
| `JUDGE_MONGO_URI` / `MONGO_URI` | — (**obligatoria**) | MongoDB (problemas, lectura). |
| `JUDGE_MONGO_DB` | `certready` | Base de datos en MongoDB. |
| `JUDGE_OIDC_ISSUER` / `OIDC_ISSUER` | — | Emisor OIDC. Vacío ⇒ rutas protegidas 501. |
| `JUDGE_OIDC_AUDIENCE` / `OIDC_AUDIENCE` | — | Audiencia esperada del token. |
| `JUDGE_AUTO_MIGRATE` | `false` | Aplicar migraciones al arrancar. |
| `JUDGE_ADDR` / `PORT` | `:8080` | Dirección de escucha. |
| `JUDGE_PYTHON_IMAGE` | `certready/judge-python:latest` | Imagen del runner de Python. |
| `JUDGE_DOCKER_BIN` | `docker` | Binario de Docker a invocar. |

## Desarrollo

Requisitos: Go ≥ 1.25, PostgreSQL, MongoDB y **Docker** (Docker Desktop en local).

```bash
# 1) Construir la imagen del sandbox
make runner-image

# 2) Migrar y arrancar
export DATABASE_URL='postgres://postgres:postgres@localhost:5432/certready_dev?sslmode=disable'
export MONGO_URI='mongodb://localhost:27017'
make migrate
make run

# Tests
export JUDGE_TEST_DATABASE_URL='postgres://postgres:postgres@localhost:5432/certready_test?sslmode=disable'
export JUDGE_DOCKER_TESTS=1   # habilita la suite de escape del sandbox (requiere Docker + imagen)
make test
```
