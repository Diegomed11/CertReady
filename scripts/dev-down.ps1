# ---------------------------------------------------------------------------
# dev-down.ps1 — Detiene el stack local de CertReady.
#
# Cierra los procesos que escuchan en los puertos del entorno de desarrollo
# (emisor OIDC, servicios y web).
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\dev-down.ps1
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'SilentlyContinue'

$puertos = 9099, 18090, 18091, 18092, 18093, 18094, 18095, 18096, 18097, 18098, 3000
foreach ($p in $puertos) {
  Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue |
    ForEach-Object {
      Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
      Write-Host "Detenido el proceso en el puerto $p"
    }
}
Write-Host 'Stack detenido.'
