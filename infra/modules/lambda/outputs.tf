output "function_name" {
  description = "Nombre completo de la función Lambda (para el deploy de CI: aws lambda update-function-code)."
  value       = aws_lambda_function.this.function_name
}

output "function_arn" {
  description = "ARN de la función Lambda."
  value       = aws_lambda_function.this.arn
}

output "function_url" {
  description = "URL HTTPS pública de la función (Function URL)."
  value       = aws_lambda_function_url.this.function_url
}

output "exec_role_arn" {
  description = "ARN del rol de ejecución de la función."
  value       = aws_iam_role.exec.arn
}
