# Mapea los puertos del stack local de CertReady al emulador Android con
# `adb reverse`, para que la app use `localhost:<puerto>` dentro del AVD igual
# que en escritorio/web (evita usar 10.0.2.2 y el desajuste de `issuer` OIDC).
#
# Uso: con el stack local arriba (scripts/dev-up.ps1) y un emulador corriendo:
#   mobile\tool\adb-reverse.ps1

$ErrorActionPreference = 'Stop'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path $adb)) { throw "no encontré adb en $adb" }

# OIDC mock + los nueve servicios Go/data (mismos puertos que la web).
$ports = 9099, 18090, 18091, 18092, 18093, 18094, 18095, 18096, 18097, 18098
foreach ($p in $ports) {
  & $adb reverse "tcp:$p" "tcp:$p" | Out-Null
  Write-Host "reverse tcp:$p -> host tcp:$p"
}
Write-Host "`nMapeos activos:"
& $adb reverse --list
