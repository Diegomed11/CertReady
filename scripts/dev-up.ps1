# ---------------------------------------------------------------------------
# dev-up.ps1 — Levanta el stack completo de CertReady en local (Windows).
#
# Arranca, en segundo plano: emisor OIDC de desarrollo; los servicios catalog,
# users, enrollments, content, exams, problems y judge; y la web (Next.js).
# Compila los binarios, aplica las migraciones (Postgres), siembra una
# certificación de ejemplo y datos demo en MongoDB (todo idempotente).
#
# Requisitos: Go, Node, PostgreSQL y MongoDB en local (bases certready_dev y
# certready_test creadas; Mongo escuchando en :27017). Ver docs/desarrollo-local.md.
#
# Notas:
#   - El botón "Ejecutar" del juez de código necesita Docker Desktop ENCENDIDO
#     y la imagen del sandbox: docker build -t certready/judge-python:latest judge/runners/python
#   - La página /progreso (readiness) necesita el DSS (ClickHouse + ETL); ver el
#     bloque opcional al final de este archivo. Sin él, /progreso muestra "sin datos".
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1
# Luego abre http://localhost:3000  y detén con scripts\dev-down.ps1
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'
$root  = Split-Path -Parent $PSScriptRoot
$dsn   = 'postgres://postgres@localhost:5432/certready_dev?sslmode=disable'
$mongo = 'mongodb://localhost:27017'
$logs  = Join-Path $root '.devlogs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

# Asegura que go y psql estén disponibles (rutas típicas de instalación).
if (-not (Get-Command go -ErrorAction SilentlyContinue)) { $env:Path = "C:\Program Files\Go\bin;$env:Path" }
$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) { $psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe' }

function Build($dir, $out, $pkg) {
  Push-Location (Join-Path $root $dir)
  try { go build -o $out $pkg } finally { Pop-Location }
}

function Wait-Url($url, $tries = 60) {
  for ($i = 0; $i -lt $tries; $i++) {
    try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 $url | Out-Null; return $true } catch { Start-Sleep -Milliseconds 750 }
  }
  return $false
}

# Arranca un binario en segundo plano y espera a que su /v1/health responda.
function Start-Svc($name, $exe, $healthUrl) {
  Start-Process -FilePath $exe -RedirectStandardOutput "$logs\$name.log" -RedirectStandardError "$logs\$name.err"
  if (-not (Wait-Url $healthUrl 40)) {
    Write-Host "  [aviso] $name no respondió en $healthUrl; revisa .devlogs\$name.err" -ForegroundColor Yellow
  } else {
    Write-Host "  $name OK" -ForegroundColor DarkGreen
  }
}

Write-Host 'Compilando binarios...'
Build 'tools\oidc-mock'      'build\oidc-mock.exe'   '.'
Build 'services\catalog'     'build\catalog.exe'     './cmd/server'
Build 'services\users'       'build\users.exe'       './cmd/server'
Build 'services\enrollments' 'build\enrollments.exe' './cmd/server'
Build 'services\content'     'build\content.exe'     './cmd/server'
Build 'services\exams'       'build\exams.exe'       './cmd/server'
Build 'services\problems'    'build\problems.exe'    './cmd/server'
Build 'services\progress'    'build\progress.exe'    './cmd/server'
Build 'judge'                'build\judge.exe'       './cmd/server'

Write-Host 'Aplicando migraciones (Postgres)...'
foreach ($svc in @('catalog', 'users', 'enrollments')) {
  Push-Location (Join-Path $root "services\$svc")
  try {
    $env:CATALOG_DATABASE_URL = $dsn; $env:USERS_DATABASE_URL = $dsn; $env:ENROLLMENTS_DATABASE_URL = $dsn
    $env:ENROLLMENTS_CATALOG_URL = 'http://localhost:18090'
    go run ./cmd/migrate | Out-Null
  } finally { Pop-Location }
}
# exams y judge guardan sesiones/corridas en Postgres (problems y content son solo Mongo).
$env:EXAMS_DATABASE_URL = $dsn; $env:JUDGE_DATABASE_URL = $dsn
foreach ($svc in @('exams', 'judge')) {
  Push-Location (Join-Path $root (@{ exams = 'services\exams'; judge = 'judge' }[$svc]))
  try { go run ./cmd/migrate | Out-Null } finally { Pop-Location }
}
# progress guarda el avance de estudio por tema en Postgres (esquema progress).
$env:PROGRESS_DATABASE_URL = $dsn
Push-Location (Join-Path $root 'services\progress')
try { go run ./cmd/migrate | Out-Null } finally { Pop-Location }

Write-Host 'Sembrando una certificacion de ejemplo (catalog)...'
$env:PGPASSWORD = ''
& $psql -U postgres -h localhost -d certready_dev -c "insert into catalog.certificaciones (slug,nombre,proveedor,nivel,descripcion) values ('aws-saa','AWS Solutions Architect Associate','AWS','associate','Diseno en AWS') on conflict (slug) do nothing;" | Out-Null

Write-Host 'Sembrando el temario real (temas de aws-saa en catalog)...'
$env:PGCLIENTENCODING = 'UTF8'
& $psql -U postgres -h localhost -d certready_dev -f (Join-Path $root 'scripts\seed-temas.sql') | Out-Null

Write-Host 'Sembrando datos demo en MongoDB (material, preguntas, problemas, Q&A)...'
$py = Join-Path $root 'data\.venv\Scripts\python.exe'
if (Test-Path $py) {
  & $py (Join-Path $root 'scripts\seed-mongo.py')
} else {
  Write-Host '  [aviso] no encontré data\.venv; omito el seed de Mongo (crea el venv de data o siembra a mano)' -ForegroundColor Yellow
}

# Catálogo extendido (~50 certificaciones: camino + estudio + quiz) y dataset del
# recomendador, generados desde scripts/catalog/*.json. Idempotente.
if (Test-Path $py) {
  Write-Host 'Sembrando el catálogo extendido (certificaciones, temas, contenido y recomendador)...'
  $env:DATABASE_URL = $dsn; $env:MONGO_URI = $mongo
  & $py (Join-Path $root 'scripts\build-reco-dataset.py')
  & $py (Join-Path $root 'scripts\seed-catalog.py')
}

# Variables de entorno de los servicios.
$env:OIDC_MOCK_ADDR = ':9099'
$env:CATALOG_ADDR = ':18090'
$env:USERS_ADDR = ':18091'; $env:USERS_OIDC_ISSUER = 'http://localhost:9099'; $env:USERS_OIDC_AUDIENCE = 'certready-web'
$env:ENROLLMENTS_ADDR = ':18092'; $env:ENROLLMENTS_OIDC_ISSUER = 'http://localhost:9099'; $env:ENROLLMENTS_OIDC_AUDIENCE = 'certready-web'

$env:CONTENT_ADDR = ':18094'; $env:CONTENT_MONGO_URI = $mongo; $env:CONTENT_MONGO_DB = 'certready'
$env:CONTENT_OIDC_ISSUER = 'http://localhost:9099'; $env:CONTENT_OIDC_AUDIENCE = 'certready-web'
$env:EXAMS_ADDR = ':18095'; $env:EXAMS_MONGO_URI = $mongo; $env:EXAMS_MONGO_DB = 'certready'
$env:EXAMS_OIDC_ISSUER = 'http://localhost:9099'; $env:EXAMS_OIDC_AUDIENCE = 'certready-web'
$env:PROBLEMS_ADDR = ':18096'; $env:PROBLEMS_MONGO_URI = $mongo; $env:PROBLEMS_MONGO_DB = 'certready'
$env:PROBLEMS_OIDC_ISSUER = 'http://localhost:9099'; $env:PROBLEMS_OIDC_AUDIENCE = 'certready-web'
$env:JUDGE_ADDR = ':18097'; $env:JUDGE_MONGO_URI = $mongo; $env:JUDGE_MONGO_DB = 'certready'
$env:JUDGE_OIDC_ISSUER = 'http://localhost:9099'; $env:JUDGE_OIDC_AUDIENCE = 'certready-web'
$env:PROGRESS_ADDR = ':18093'; $env:PROGRESS_DATABASE_URL = $dsn
$env:PROGRESS_OIDC_ISSUER = 'http://localhost:9099'; $env:PROGRESS_OIDC_AUDIENCE = 'certready-web'

Write-Host 'Arrancando emisor OIDC...'
Start-Process -FilePath "$root\tools\oidc-mock\build\oidc-mock.exe" -RedirectStandardOutput "$logs\oidc.log" -RedirectStandardError "$logs\oidc.err"
if (-not (Wait-Url 'http://localhost:9099/healthz')) { throw 'el emisor OIDC no respondio' }

Write-Host 'Arrancando servicios...'
Start-Svc 'catalog'     "$root\services\catalog\build\catalog.exe"         'http://localhost:18090/v1/health'
Start-Svc 'users'       "$root\services\users\build\users.exe"             'http://localhost:18091/v1/health'
Start-Svc 'enrollments' "$root\services\enrollments\build\enrollments.exe" 'http://localhost:18092/v1/health'
Start-Svc 'content'     "$root\services\content\build\content.exe"         'http://localhost:18094/v1/health'
Start-Svc 'exams'       "$root\services\exams\build\exams.exe"             'http://localhost:18095/v1/health'
Start-Svc 'problems'    "$root\services\problems\build\problems.exe"       'http://localhost:18096/v1/health'
Start-Svc 'progress'    "$root\services\progress\build\progress.exe"       'http://localhost:18093/v1/health'
Start-Svc 'judge'       "$root\judge\build\judge.exe"                      'http://localhost:18097/v1/health'

# --- DSS (capa de datos): recomendador de certificaciones por CV + readiness/analitica ---
# El recomendador NO necesita ClickHouse, así que el DSS arranca siempre. La
# analítica/readiness sí (ClickHouse + ETL), que se levanta best-effort más abajo.
$env:CLICKHOUSE_HOST = 'localhost'; $env:CLICKHOUSE_PORT = '8123'
$env:CLICKHOUSE_USER = 'certready'; $env:CLICKHOUSE_PASSWORD = 'certready'; $env:CLICKHOUSE_DB = 'analytics'
if (Test-Path $py) {
  Write-Host 'Arrancando el DSS (recomendador + readiness) en :18098...'
  Start-Process -FilePath $py -ArgumentList '-m', 'uvicorn', 'dss.api:app', '--host', '127.0.0.1', '--port', '18098' -WorkingDirectory "$root\data" -RedirectStandardOutput "$logs\dss.log" -RedirectStandardError "$logs\dss.err"
  if (Wait-Url 'http://localhost:18098/v1/health' 30) { Write-Host '  DSS arriba.' -ForegroundColor Green }
  else { Write-Host '  [aviso] el DSS no respondio (revisa .devlogs\dss.err).' -ForegroundColor Yellow }
} else {
  Write-Host '  [aviso] no encontre data\.venv; omito el DSS (Mi camino y la analitica no funcionaran)' -ForegroundColor Yellow
}

Write-Host 'Compilando la web (build de producción, para que responda rápido)...'
Push-Location "$root\web"
& node 'node_modules/next/dist/bin/next' build
$webBuildOk = $?
Pop-Location
if (-not $webBuildOk) { throw 'falló el build de la web; revisa la salida de arriba' }

Write-Host 'Arrancando la web (Next.js start)...'
Start-Process -FilePath 'node' -ArgumentList 'node_modules/next/dist/bin/next', 'start' -WorkingDirectory "$root\web" -RedirectStandardOutput "$logs\web.log" -RedirectStandardError "$logs\web.err"

if (Wait-Url 'http://localhost:3000/' 80) {
  Write-Host ''
  Write-Host 'Stack arriba. Abre:  http://localhost:3000' -ForegroundColor Green
  Write-Host 'Pasos: inicia sesión, ve a Catálogo e inscríbete en "AWS Solutions Architect Associate".'
  Write-Host 'Luego ya verás Estudiar, Exámenes, Entrevistas y Progreso con datos.'
  Write-Host ''
  Write-Host 'Juez de código: enciende Docker Desktop y construye la imagen del sandbox:' -ForegroundColor DarkGray
  Write-Host '  docker build -t certready/judge-python:latest judge/runners/python' -ForegroundColor DarkGray
  Write-Host 'Logs en .devlogs\   |  Detener:  powershell -ExecutionPolicy Bypass -File scripts\dev-down.ps1'
} else {
  Write-Host 'La web no respondio a tiempo; revisa .devlogs\web.err' -ForegroundColor Yellow
}

# --- Analitica (dashboards) — OPCIONAL y al final, para no bloquear el arranque ---
# Requiere Docker. Si está apagado se omite en silencio: el recomendador (Mi camino),
# los simulacros y el resto del stack ya están arriba; los dashboards mostrarán
# "sin datos" hasta que enciendas Docker y reejecutes dev-up.
$prev = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
$dockerOk = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker info 2>$null 1>$null
  $dockerOk = ($LASTEXITCODE -eq 0)
}
if ($dockerOk -and (Test-Path $py)) {
  Write-Host ''
  Write-Host 'Analitica (opcional): levantando ClickHouse + ETL...'
  Push-Location "$root\data"; docker compose up -d clickhouse | Out-Null; Pop-Location
  if (Wait-Url 'http://localhost:8123/ping' 30) {
    $env:DATABASE_URL = $dsn; $env:MONGO_URI = $mongo
    Push-Location "$root\data"; & $py -m etl.run *> "$logs\etl.log"; Pop-Location
    Write-Host '  Analitica lista (acierto por dominio en Progreso).' -ForegroundColor Green
  } else {
    Write-Host '  [aviso] ClickHouse no respondio; los dashboards mostraran "sin datos".' -ForegroundColor DarkGray
  }
} else {
  Write-Host ''
  Write-Host 'Analitica: Docker apagado; se omite. Mi camino y el resto del stack funcionan; los dashboards mostraran "sin datos".' -ForegroundColor DarkGray
}
$ErrorActionPreference = $prev
