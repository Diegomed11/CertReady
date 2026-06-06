# ---------------------------------------------------------------------------
# dev-up.ps1 — Levanta el stack completo de CertReady en local (Windows).
#
# Arranca, en segundo plano: emisor OIDC de desarrollo, los servicios catalog,
# users y enrollments, y la web (Next.js). Compila los binarios, aplica las
# migraciones y siembra una certificación de ejemplo (todo idempotente).
#
# Requisitos: Go, Node y PostgreSQL instalados; bases certready_dev y
# certready_test creadas (ver docs/desarrollo-local.md).
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1
# Luego abre http://localhost:3000  y detén con scripts\dev-down.ps1
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dsn  = 'postgres://postgres@localhost:5432/certready_dev?sslmode=disable'
$logs = Join-Path $root '.devlogs'
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

Write-Host 'Compilando binarios...'
Build 'tools\oidc-mock'     'build\oidc-mock.exe'   '.'
Build 'services\catalog'     'build\catalog.exe'     './cmd/server'
Build 'services\users'       'build\users.exe'       './cmd/server'
Build 'services\enrollments' 'build\enrollments.exe' './cmd/server'

Write-Host 'Aplicando migraciones...'
foreach ($svc in @('catalog', 'users', 'enrollments')) {
  Push-Location (Join-Path $root "services\$svc")
  try {
    $env:CATALOG_DATABASE_URL = $dsn; $env:USERS_DATABASE_URL = $dsn; $env:ENROLLMENTS_DATABASE_URL = $dsn
    $env:ENROLLMENTS_CATALOG_URL = 'http://localhost:18090'
    go run ./cmd/migrate | Out-Null
  } finally { Pop-Location }
}

Write-Host 'Sembrando una certificacion de ejemplo...'
$env:PGPASSWORD = ''
& $psql -U postgres -h localhost -d certready_dev -c "insert into catalog.certificaciones (slug,nombre,proveedor,nivel,descripcion) values ('aws-saa','AWS Solutions Architect Associate','AWS','associate','Diseno en AWS') on conflict (slug) do nothing;" | Out-Null

# Variables de entorno de los servicios.
$env:OIDC_MOCK_ADDR = ':9099'
$env:CATALOG_ADDR = ':18090'
$env:USERS_ADDR = ':18091'; $env:USERS_OIDC_ISSUER = 'http://localhost:9099'; $env:USERS_OIDC_AUDIENCE = 'certready-web'
$env:ENROLLMENTS_ADDR = ':18092'; $env:ENROLLMENTS_OIDC_ISSUER = 'http://localhost:9099'; $env:ENROLLMENTS_OIDC_AUDIENCE = 'certready-web'

Write-Host 'Arrancando emisor OIDC...'
Start-Process -FilePath "$root\tools\oidc-mock\build\oidc-mock.exe" -RedirectStandardOutput "$logs\oidc.log" -RedirectStandardError "$logs\oidc.err"
if (-not (Wait-Url 'http://localhost:9099/healthz')) { throw 'el emisor OIDC no respondio' }

Write-Host 'Arrancando servicios...'
Start-Process -FilePath "$root\services\catalog\build\catalog.exe" -RedirectStandardOutput "$logs\catalog.log" -RedirectStandardError "$logs\catalog.err"
Start-Process -FilePath "$root\services\users\build\users.exe" -RedirectStandardOutput "$logs\users.log" -RedirectStandardError "$logs\users.err"
Start-Process -FilePath "$root\services\enrollments\build\enrollments.exe" -RedirectStandardOutput "$logs\enrollments.log" -RedirectStandardError "$logs\enrollments.err"

Write-Host 'Arrancando la web (Next.js dev)...'
Start-Process -FilePath 'node' -ArgumentList 'node_modules/next/dist/bin/next', 'dev' -WorkingDirectory "$root\web" -RedirectStandardOutput "$logs\web.log" -RedirectStandardError "$logs\web.err"

if (Wait-Url 'http://localhost:3000/' 80) {
  Write-Host ''
  Write-Host 'Stack arriba. Abre:  http://localhost:3000' -ForegroundColor Green
  Write-Host 'Logs en .devlogs\   |  Detener:  powershell -ExecutionPolicy Bypass -File scripts\dev-down.ps1'
} else {
  Write-Host 'La web no respondio a tiempo; revisa .devlogs\web.err' -ForegroundColor Yellow
}
