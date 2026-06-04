output "deploy_role_arn" {
  description = "ARN del rol que asume GitHub Actions para desplegar. Copiar en secrets.AWS_DEPLOY_ROLE_ARN del repo."
  value       = aws_iam_role.deploy.arn
}

output "oidc_provider_arn" {
  description = "ARN del proveedor OIDC de GitHub registrado en la cuenta."
  value       = aws_iam_openid_connect_provider.github.arn
}
