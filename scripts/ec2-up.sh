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
# IP/host público vía metadata IMDSv2 (token requerido). Cae a localhost si no hay.
_imds_token="$(curl -s --max-time 3 -X PUT 'http://169.254.169.254/latest/api/token' -H 'X-aws-ec2-metadata-token-ttl-seconds: 120' 2>/dev/null || true)"
PUBLIC_HOST="${PUBLIC_HOST:-$(curl -s --max-time 3 -H "X-aws-ec2-metadata-token: ${_imds_token}" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo localhost)}"
[ -z "$PUBLIC_HOST" ] && PUBLIC_HOST=localhost

# --- Modo de autenticación: Cognito (si existe .cognito.env) o emisor local -----
# Para ACTIVAR Cognito: crea "$ROOT/.cognito.env" con COGNITO_ISSUER,
# COGNITO_CLIENT_ID y COGNITO_CLIENT_SECRET. Sin ese archivo usa el emisor local
# (oidc-mock). Para REVERTIR: borra/renombra el archivo y vuelve a correr el script.
[ -f "$ROOT/.cognito.env" ] && . "$ROOT/.cognito.env"
PUBLIC_URL="https://certready.duckdns.org"
if [ -n "${COGNITO_ISSUER:-}" ]; then
  AUTH_ISSUER="$COGNITO_ISSUER"; AUTH_AUDIENCE="${COGNITO_CLIENT_ID:-}"
  WEB_OIDC_ISSUER="$COGNITO_ISSUER"; WEB_OIDC_CLIENT_ID="${COGNITO_CLIENT_ID:-}"
  WEB_OIDC_SECRET_LINE="OIDC_CLIENT_SECRET=${COGNITO_CLIENT_SECRET:-}"
  if [ -n "${COGNITO_DOMAIN:-}" ]; then WEB_LOGOUT_URL_LINE="OIDC_LOGOUT_URL=https://${COGNITO_DOMAIN}/logout"; else WEB_LOGOUT_URL_LINE=''; fi
  WEB_REDIRECT="$PUBLIC_URL/api/auth/callback"; WEB_LOGOUT="$PUBLIC_URL/"
  echo "==> Autenticación: COGNITO ($COGNITO_ISSUER)"
else
  AUTH_ISSUER='http://localhost:9099'; AUTH_AUDIENCE='certready-web'
  WEB_OIDC_ISSUER="$AUTH_ISSUER"; WEB_OIDC_CLIENT_ID='certready-web'
  WEB_OIDC_SECRET_LINE=''; WEB_LOGOUT_URL_LINE=''
  WEB_REDIRECT="http://${PUBLIC_HOST}:3000/api/auth/callback"; WEB_LOGOUT="http://${PUBLIC_HOST}:3000/"
  echo "==> Autenticación: emisor local (oidc-mock)"
fi

# --- Re-ejecución limpia: matar instancias previas para liberar los puertos -------
# Sin esto, al re-correr el script los procesos viejos siguen vivos y los nuevos
# fallan con "address already in use" (y siguen respondiendo los viejos, p. ej. con
# el emisor anterior → 401 con tokens de Cognito).
echo "==> Deteniendo instancias previas (si las hay)"
pkill -f "/oidc-mock/build/oidc-mock" 2>/dev/null || true
for s in catalog users enrollments content exams problems progress; do
  pkill -f "/services/$s/build/$s" 2>/dev/null || true
done
pkill -f "/judge/build/judge" 2>/dev/null || true
pkill -f 'uvicorn dss.api:app' 2>/dev/null || true
pkill -f 'next start' 2>/dev/null || true
pkill -f 'next dev' 2>/dev/null || true
sleep 2

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
export USERS_ADDR=':18091'        USERS_OIDC_ISSUER="$AUTH_ISSUER"        USERS_OIDC_AUDIENCE="$AUTH_AUDIENCE"
export ENROLLMENTS_ADDR=':18092'  ENROLLMENTS_OIDC_ISSUER="$AUTH_ISSUER"  ENROLLMENTS_OIDC_AUDIENCE="$AUTH_AUDIENCE"
export CONTENT_ADDR=':18094'      CONTENT_MONGO_URI="$MONGO" CONTENT_MONGO_DB='certready' CONTENT_OIDC_ISSUER="$AUTH_ISSUER" CONTENT_OIDC_AUDIENCE="$AUTH_AUDIENCE"
export EXAMS_ADDR=':18095'        EXAMS_MONGO_URI="$MONGO"   EXAMS_MONGO_DB='certready'   EXAMS_OIDC_ISSUER="$AUTH_ISSUER"   EXAMS_OIDC_AUDIENCE="$AUTH_AUDIENCE"
export PROBLEMS_ADDR=':18096'     PROBLEMS_MONGO_URI="$MONGO" PROBLEMS_MONGO_DB='certready' PROBLEMS_OIDC_ISSUER="$AUTH_ISSUER" PROBLEMS_OIDC_AUDIENCE="$AUTH_AUDIENCE"
export JUDGE_ADDR=':18097'        JUDGE_MONGO_URI="$MONGO"   JUDGE_MONGO_DB='certready'   JUDGE_OIDC_ISSUER="$AUTH_ISSUER"   JUDGE_OIDC_AUDIENCE="$AUTH_AUDIENCE"
export PROGRESS_ADDR=':18093'     PROGRESS_OIDC_ISSUER="$AUTH_ISSUER"     PROGRESS_OIDC_AUDIENCE="$AUTH_AUDIENCE"     PROGRESS_EXAMS_BASE_URL='http://localhost:18095' PROGRESS_JUDGE_BASE_URL='http://localhost:18097'
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
OIDC_ISSUER=$WEB_OIDC_ISSUER
OIDC_CLIENT_ID=$WEB_OIDC_CLIENT_ID
${WEB_OIDC_SECRET_LINE}
OIDC_REDIRECT_URI=$WEB_REDIRECT
OIDC_POST_LOGOUT_REDIRECT_URI=$WEB_LOGOUT
${WEB_LOGOUT_URL_LINE}
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
( cd "$ROOT/web" && npm install --no-audit --no-fund )
# Build de producción (NODE_ENV=production → la cookie de sesión es Secure; va
# detrás de Caddy/HTTPS). Más rápido y estable que `next dev` en el móvil.
echo "    compilando web (next build)..."
( cd "$ROOT/web" && rm -rf .next && npx next build >"$LOGS/web-build.log" 2>&1 ) \
  || echo "    [aviso] el build de la web falló (revisa .devlogs/web-build.log)"
( cd "$ROOT/web" && nohup npx next start -H 0.0.0.0 -p 3000 >"$LOGS/web.log" 2>&1 & )
wait_url 'http://localhost:3000/' 90 && ok=1 || ok=0

echo ""
if [ "$ok" = 1 ]; then
  echo "STACK ARRIBA en AWS. URL pública para el QR:"
  echo "    http://${PUBLIC_HOST}:3000"
else
  echo "La web no respondió a tiempo; revisa $LOGS/web.log"
fi
echo "Recuerda: el Security Group debe permitir 3000 (web) y 22 (SSH)."
