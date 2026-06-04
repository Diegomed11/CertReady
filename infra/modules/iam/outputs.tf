output "execution_role_arn" {
  description = "ARN del rol de ejecución ECS (lo usa el agente de ECS para hacer pull de ECR y leer secretos)."
  value       = aws_iam_role.ecs_execution.arn
}

output "task_role_arn" {
  description = "ARN del rol de tarea ECS (lo asume el proceso dentro del contenedor)."
  value       = aws_iam_role.ecs_task.arn
}

output "github_deploy_role_arn" {
  description = "ARN del rol que asume GitHub Actions para hacer push a ECR y actualizar ECS."
  value       = aws_iam_role.github_deploy.arn
}
