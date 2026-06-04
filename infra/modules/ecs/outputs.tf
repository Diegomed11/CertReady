output "cluster_name" {
  description = "Nombre del cluster ECS Fargate."
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "ARN del cluster ECS Fargate."
  value       = aws_ecs_cluster.main.arn
}

output "service_names" {
  description = "Mapa nombre_servicio → nombre del ECS Service creado."
  value       = { for k, v in aws_ecs_service.service : k => v.name }
}

output "task_definition_arns" {
  description = "Mapa nombre_servicio → ARN de la task definition activa."
  value       = { for k, v in aws_ecs_task_definition.service : k => v.arn }
}
