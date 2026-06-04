output "secret_arns" {
  description = "Mapa nombre_lógico → ARN del secreto. Pasar al módulo iam para que el execution role pueda leerlos."
  value       = { for k, v in aws_secretsmanager_secret.app : k => v.arn }
}
