# ---------------------------------------------------------------------------
# Entorno dev — Composición de módulos (ruta de costo cero, ADR-07).
#
# Solo se instancian los módulos que caen en la capa gratuita permanente de AWS:
#   - lambda : el servicio health como función + Function URL (sin VPC, sin NAT).
#   - cicd   : proveedor OIDC + rol de deploy para GitHub Actions.
#
# Los módulos de la ruta Fargate (network, ecr, ecs, iam, secrets) quedan
# PARQUEADOS (ver infra/README.md): validados pero no instanciados, hasta que
# exista presupuesto/créditos para el diseño de ADR-05.
# ---------------------------------------------------------------------------

locals {
  env = "dev"
}

# ---------------------------------------------------------------------------
# Servicio health (Lambda)
# ---------------------------------------------------------------------------

module "health" {
  source = "../../modules/lambda"

  env           = local.env
  function_name = "health"
  package_path  = var.health_package_path
  memory_mb     = 128
  timeout_s     = 10

  env_vars = {
    HEALTH_ENV     = local.env
    HEALTH_VERSION = var.health_version
  }

  log_retention_days = 7
}

# ---------------------------------------------------------------------------
# CI/CD (OIDC + rol de deploy, limitado a la función health)
# ---------------------------------------------------------------------------

module "cicd" {
  source = "../../modules/cicd"

  env                  = local.env
  github_org           = var.github_org
  github_repo          = var.github_repo
  lambda_function_arns = [module.health.function_arn]
}
