#!/usr/bin/env bash
# Detiene el stack levantado por ec2-up.sh (procesos + contenedores de datos).
# NO termina la instancia EC2 — eso se hace desde la consola de AWS para dejar de pagar.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Deteniendo procesos..."
pkill -f "$ROOT/tools/oidc-mock/build/oidc-mock" 2>/dev/null || true
for s in catalog users enrollments content exams problems progress; do
  pkill -f "$ROOT/services/$s/build/$s" 2>/dev/null || true
done
pkill -f "$ROOT/judge/build/judge" 2>/dev/null || true
pkill -f 'uvicorn dss.api:app' 2>/dev/null || true
pkill -f 'next dev' 2>/dev/null || true

echo "Deteniendo contenedores de datos..."
docker rm -f cr-pg cr-mongo >/dev/null 2>&1 || true
docker compose -f "$ROOT/data/docker-compose.yml" down >/dev/null 2>&1 || true

echo "Listo. Para dejar de pagar, TERMINA la instancia EC2 desde la consola de AWS."
