output "repository_urls" {
  description = "Mapa nombre_de_servicio → URL del repositorio ECR (p. ej. 'health' → '<account>.dkr.ecr.<region>.amazonaws.com/certready/health')."
  value       = { for k, v in aws_ecr_repository.service : k => v.repository_url }
}

output "repository_arns" {
  description = "Mapa nombre_de_servicio → ARN del repositorio ECR."
  value       = { for k, v in aws_ecr_repository.service : k => v.arn }
}
