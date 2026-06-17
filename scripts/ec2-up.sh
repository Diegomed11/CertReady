#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# ec2-up.sh — Levanta el stack COMPLETO de CertReady en una sola VM Linux
# (p. ej. una EC2 Ubuntu 22.04). Port de dev-up.ps1: TODO funcional, nada
# diferido — juez (Docker), ClickHouse/analítica, DSS, los 8 servicios y la web.
#
# Bases por Docker en la misma caja (Postgres, Mongo, ClickHouse). El juez corre
# como proceso del host y usa el Docker del host (no Docker-in-Docker).
#
# Requisitos en la VM: docker, go, node+npm, python3+venv, git. (Ver el runbook
# docs/demo-aws-ec2.md para instalarlos y para lanzar la instancia.)
#
# Uso (desde la raíz del repo):  bash scripts/ec2-up.sh
# Detener:  bash scripts/ec2-down.sh   (o: pkill -f certready; docker rm -f cr-pg cr-mongo)
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
LOGS="$ROOT/.devlogs"; mkdir -p "$LOGS"

DSN='postgres://postgres@localhost:5432/certready_dev?sslmode=disable'
MONGO='mongodb://localhost:27017'
PUBLIC_HOST="${PUBLIC_HOST:-$(curl -s --max-time 3 http://169.254.169.254/latest/meta-data/public-hostname || echo localhost)}"

wait_url() { for _ in $(seq 1 "${2:-60}"); do curl -fsS --max-time 4 "$1" >/dev/null 2>&1 && return 0; sleep 1; done; return 1; }

# --- 1) Infra por Docker: Postgres, Mongo, ClickHouse + Cube --------------------
echo "==> Bases (Docker): Postgres, Mongo, ClickHouse"
docker rm -f cr-pg cr-mongo >/dev/null 2>&1 || true
docker run -d --name cr-pg    -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=certready_dev \
  -p 5432:5432 postgres:16 >/dev/null
docker run -d --name cr-mongo -p 27017:27017 mongo:7 >/dev/null
# ClickHouse + Cube (compose de la capa de datos: usuario certready/certready, db analytics).
docker compose -f "$ROOT/data/docker-compose.yml" up -d clickhouse >/dev/null
echo "    esperando Postgres y ClickHouse..."
until docker exec cr-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
wait_url 'http://localhost:8123/ping' 60 || echo "    [aviso] ClickHouse tardó; la analítica puede quedar vacía"

# --- 2) Imagen del sandbox del juez -------------------------------------------
echo "==> Imagen del juez (sandbox Python)"
docker build -q -t certready/judge-python:latest "$ROOT/judge/runners/python" >/dev/null

# --- 3) Entorno virtual de la capa de datos (DSS, ETL, seeders) ----------------
echo "==> venv de data (DSS/ETL/seeders)"
if [ ! -d "$ROOT/data/.venv" ]; then python3 -m venv "$ROOT/data/.venv"; fi
PY="$ROOT/data/.venv/bin/python"
"$PY" -m pip install -q --upgrade pip
"$PY" -m pip install -q -e "$ROOT/data"

# --- 4) Compilar binarios Go ---------------------------------------------------
echo "==> Compilando binarios Go"
( cd "$ROOT/tools/oidc-mock" && go build -o build/oidc-mock . )
for s in catalog users enrollments content exams problems progress; do
  ( cd "$ROOT/services/$s" && go build -o build/"$s" ./cmd/server )
done
( cd "$ROOT/judge" && go build -o build/judge ./cmd/server )

# --- 5) Migraciones (Postgres) -------------------------------------------------
echo "==> Migraciones"
export DATABASE_URL="$DSN" ENROLLMENTS_CATALOG_URL='http://localhost:18090'
for s in catalog users enrollments exams progress; do
  ( cd "$ROOT/services/$s" && go run ./cmd/migrate >/dev/null )
done
( cd "$ROOT/judge" && go run ./cmd/migrate >/dev/null )

# --- 6) Semillas (catálogo + contenido + recomendador) -------------------------
echo "==> Sembrando catálogo y contenido"
docker exec -i cr-pg psql -U postgres -d certready_dev -c \
  "insert into catalog.certificaciones (slug,nombre,proveedor,nivel,descripcion) values ('aws-saa','AWS Solutions Architect Associate','AWS','associate','Diseno en AWS') on conflict (slug) do nothing;" >/dev/null
docker exec -i cr-pg psql -U postgres -d certready_dev < "$ROOT/scripts/seed-temas.sql" >/dev/null
export MONGO_URI="$MONGO"
"$PY" "$ROOT/scripts/seed-mongo.py"
"$PY" "$ROOT/scripts/build-reco-dataset.py"
"$PY" "$ROOT/scripts/seed-catalog.py"

# --- 7) Variables de los servicios + emisor OIDC -------------------------------
export OIDC_MOCK_ADDR=':9099' OIDC_MOCK_DB_DSN="$DSN" OIDC_MOCK_ADMIN_EMAILS='admin@certready.local'
export CATALOG_ADDR=':18090'
export USERS_ADDR=':18091'        USERS_OIDC_ISSUER='http://localhost:9099'        USERS_OIDC_AUDIENCE='certready-web'
export ENROLLMENTS_ADDR=':18092'  ENROLLMENTS_OIDC_ISSUER='http://localhost:9099'  ENROLLMENTS_OIDC_AUDIENCE='certready-web'
export CONTENT_ADDR=':18094'      CONTENT_MONGO_URI="$MONGO" CONTENT_MONGO_DB='certready' CONTENT_OIDC_ISSUER='http://localhost:9099' CONTENT_OIDC_AUDIENCE='certready-web'
export EXAMS_ADDR=':18095'        EXAMS_MONGO_URI="$MONGO"   EXAMS_MONGO_DB='certready'   EXAMS_OIDC_ISSUER='http://localhost:9099'   EXAMS_OIDC_AUDIENCE='certready-web'
export PROBLEMS_ADDR=':18096'     PROBLEMS_MONGO_URI="$MONGO" PROBLEMS_MONGO_DB='certready' PROBLEMS_OIDC_ISSUER='http://localhost:9099' PROBLEMS_OIDC_AUDIENCE='certready-web'
export JUDGE_ADDR=':18097'        JUDGE_MONGO_URI="$MONGO"   JUDGE_MONGO_DB='certready'   JUDGE_OIDC_ISSUER='http://localhost:9099'   JUDGE_OIDC_AUDIENCE='certready-web'
export PROGRESS_ADDR=':18093'     PROGRESS_OIDC_ISSUER='http://localhost:9099'     PROGRESS_OIDC_AUDIENCE='certready-web'
export CLICKHOUSE_HOST='localhost' CLICKHOUSE_PORT='8123' CLICKHOUSE_USER='certready' CLICKHOUSE_PASSWORD='certready' CLICKHOUSE_DB='analytics'

run() { nohup "$1" >"$LOGS/$2.log" 2>&1 & echo "    $2 (pid $!)"; }

echo "==> Arrancando emisor OIDC + servicios + juez"
run "$ROOT/tools/oidc-mock/build/oidc-mock" oidc
wait_url 'http://localhost:9099/healthz' 40 || { echo "OIDC no respondió"; exit 1; }
for s in catalog users enrollments content exams problems progress; do run "$ROOT/services/$s/build/$s" "$s"; done
run "$ROOT/judge/build/judge" judge

# --- 8) DSS (recomendador + readiness/analítica) -------------------------------
echo "==> DSS (:18098)"
( cd "$ROOT/data" && nohup "$PY" -m uvicorn dss.api:app --host 127.0.0.1 --port 18098 >"$LOGS/dss.log" 2>&1 & )
wait_url 'http://localhost:18098/v1/health' 40 || echo "    [aviso] DSS no respondió (revisa .devlogs/dss.err)"

# --- 9) ETL + datos demo (para que la analítica muestre números) ---------------
echo "==> ETL + datos demo"
( cd "$ROOT/data" && "$PY" -m etl.run >"$LOGS/etl.log" 2>&1 ) || echo "    [aviso] ETL falló (revisa .devlogs/etl.log)"
SEED_USER_EMAIL="${SEED_USER_EMAIL:-demo@certready.app}" "$PY" "$ROOT/scripts/seed-demo-user.py" || true
( cd "$ROOT/data" && "$PY" -m etl.run >>"$LOGS/etl.log" 2>&1 ) || true

# --- 10) Web (Next.js) ---------------------------------------------------------
echo "==> Web (Next.js en :3000)"
cat > "$ROOT/web/.env.local" <<EOF
OIDC_ISSUER=http://localhost:9099
OIDC_CLIENT_ID=certready-web
OIDC_REDIRECT_URI=http://${PUBLIC_HOST}:3000/api/auth/callback
OIDC_POST_LOGOUT_REDIRECT_URI=http://${PUBLIC_HOST}:3000/
SESSION_PASSWORD=$(openssl rand -hex 32)
SESSION_COOKIE_NAME=certready_session
CATALOG_BASE_URL=http://localhost:18090
USERS_BASE_URL=http://localhost:18091
ENROLLMENTS_BASE_URL=http://localhost:18092
CONTENT_BASE_URL=http://localhost:18094
EXAMS_BASE_URL=http://localhost:18095
PROBLEMS_BASE_URL=http://localhost:18096
JUDGE_BASE_URL=http://localhost:18097
DSS_BASE_URL=http://localhost:18098
PROGRESS_BASE_URL=http://localhost:18093
EOF
( cd "$ROOT/web" && npm ci --no-audit --no-fund )
# Modo dev: NODE_ENV=development → la cookie de sesión NO exige HTTPS (funciona sobre http
# en la demo). Para HTTPS de verdad: dominio + Caddy delante y `next start` (ver runbook).
( cd "$ROOT/web" && nohup npx next dev -H 0.0.0.0 -p 3000 >"$LOGS/web.log" 2>&1 & )
wait_url 'http://localhost:3000/' 90 && ok=1 || ok=0

echo ""
if [ "$ok" = 1 ]; then
  echo "STACK ARRIBA en AWS. URL pública para el QR:"
  echo "    http://${PUBLIC_HOST}:3000"
else
  echo "La web no respondió a tiempo; revisa $LOGS/web.log"
fi
echo "Recuerda: el Security Group debe permitir 3000 (web) y 22 (SSH)."
