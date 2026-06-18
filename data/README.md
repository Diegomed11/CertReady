# Capa de datos (`data/`)

Capa analítica de CertReady. Es el **único** lugar donde se usa Python (principio
del proyecto). Lleva los hechos operativos a un modelo dimensional en **ClickHouse**
y los expone con una capa semántica en **Cube**.

```
PostgreSQL (exams.intentos, judge.ejecuciones)  ─┐
                                              ├─►  ETL (Python)  ─►  ClickHouse (estrella)  ─►  Cube (API)
MongoDB (preguntas, problemas) [enriquece]   ─┘
```

El modelo es una **estrella plana** (los atributos de dimensión son columnas del
hecho), idiomática de ClickHouse. Hechos: `fact_intento` (intentos de examen) y
`fact_ejecucion` (ejecuciones del juez). Decisiones en **ADR-12**.

## Componentes

- `etl/` — ETL en Python (incremental por watermark, idempotente):
  - `config.py` — configuración por entorno.
  - `schema.sql` — DDL del esquema dimensional (idempotente).
  - `sources.py` — lectura parametrizada de Postgres y enriquecimiento desde Mongo.
  - `transform.py` — transformación **pura** (probada sin bases de datos).
  - `load.py` — carga a ClickHouse + watermark.
  - `run.py` — `python -m etl.run`.
- `cube/` — capa semántica (medidas, dimensiones, pre-agregaciones).
- `dss/` — servicio **FastAPI** de readiness (IRT Rasch 1PL) que lee ClickHouse:
  `modelo` (puro, numpy), `repo` (ClickHouse), `api` (endpoints), `config`.
- `docker-compose.yml` — stack OLAP local (ClickHouse + Cube).

## Configuración (variables de entorno)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATA_DATABASE_URL` / `DATABASE_URL` | — (**obligatoria**) | DSN de PostgreSQL operacional. |
| `DATA_MONGO_URI` / `MONGO_URI` | — (**obligatoria**) | Conexión a MongoDB. |
| `DATA_MONGO_DB` / `MONGO_DB` | `certready` | Base de datos en MongoDB. |
| `CLICKHOUSE_HOST` | `localhost` | Host de ClickHouse. |
| `CLICKHOUSE_PORT` | `8123` | Puerto HTTP de ClickHouse. |
| `CLICKHOUSE_USER` | `default` | Usuario. |
| `CLICKHOUSE_PASSWORD` | (vacío) | Contraseña. |
| `CLICKHOUSE_DB` | `analytics` | Base analítica destino. |
| `DSS_UMBRAL_APROBACION` | `0.7` | Nota mínima para aprobar (proporción) que usa el DSS. |
| `DSS_ITEMS_EXAMEN` | `20` | Nº de ítems del examen para la probabilidad de aprobar. |

## Desarrollo

```bash
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

# Stack OLAP local
docker compose up -d clickhouse

# Correr el ETL (incremental)
export DATABASE_URL='postgres://postgres:postgres@localhost:5432/certready_dev?sslmode=disable'
export MONGO_URI='mongodb://localhost:27017'
python -m etl.run

# Servir el DSS (readiness) y consultarlo
uvicorn dss.api:app --port 8000
# GET http://localhost:8000/v1/readiness/{usuario_id}?certificacion=aws-saa

# Calidad y pruebas
ruff check .
black --check .
pytest                       # unit (puro)
DATA_ETL_IT=1 pytest         # + integración contra ClickHouse
```

Requisitos: Python ≥ 3.11, Docker (para ClickHouse/Cube). El despliegue a la nube
está diferido (ADR-12).
