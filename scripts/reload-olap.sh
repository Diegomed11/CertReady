#!/usr/bin/env bash
# Recarga LIMPIA del OLAP para la demo/analítica.
#
# Re-siembra la población sintética en Postgres y reconstruye ClickHouse DESDE CERO:
# trunca las tablas de hechos (si no, se acumulan generaciones viejas con ids nuevos
# y el churn/volumen sale inflado) y re-corre el ETL. Postgres es la fuente de verdad;
# ClickHouse se re-deriva.
#
# Uso (en la EC2):
#   bash scripts/reload-olap.sh
#   SEED_POP_N=60 bash scripts/reload-olap.sh   # más usuarios sintéticos
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$ROOT/data/.venv/bin/python"
export DATABASE_URL="${DATABASE_URL:-postgres://postgres@localhost:5432/certready_dev?sslmode=disable}"
export MONGO_URI="${MONGO_URI:-mongodb://localhost:27017}"
CH="${CLICKHOUSE_URL:-http://localhost:8123/?user=certready&password=certready}"

echo "==> Sembrando población sintética (Postgres)"
SEED_POP_N="${SEED_POP_N:-40}" "$PY" "$ROOT/scripts/seed-population.py"

echo "==> Limpiando hechos de ClickHouse (evita acumular generaciones)"
for t in fact_intento fact_ejecucion fact_qa etl_estado; do
  curl -s "$CH" --data-binary "TRUNCATE TABLE analytics.$t" >/dev/null
done

echo "==> Corriendo ETL (re-deriva ClickHouse desde Postgres+Mongo)"
cd "$ROOT/data"
CLICKHOUSE_USER=certready CLICKHOUSE_PASSWORD=certready "$PY" -m etl.run

echo "==> OLAP recargado. Revisa /admin (Ctrl+Shift+R)."
