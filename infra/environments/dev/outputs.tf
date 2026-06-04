output "health_function_url" {
  description = "URL pública del servicio health. Probar: GET <url>v1/health."
  value       = module.health.function_url
}

output "health_function_name" {
  description = "Nombre de la función Lambda (para el deploy de CI)."
  value       = module.health.function_name
}

output "github_deploy_role_arn" {
  description = "ARN del rol OIDC que asume GitHub Actions. Copiar en secrets.AWS_DEPLOY_ROLE_ARN del repo."
  value       = module.cicd.deploy_role_arn
}
