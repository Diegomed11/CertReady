output "user_pool_id" {
  description = "ID del User Pool de Cognito."
  value       = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  description = "ARN del User Pool (útil para autorizadores de API Gateway, si se usaran)."
  value       = aws_cognito_user_pool.this.arn
}

output "issuer_url" {
  description = <<-EOT
    URL del emisor OIDC. Se inyecta a los servicios como OIDC_ISSUER
    (CATALOG_OIDC_ISSUER / USERS_OIDC_ISSUER / ENROLLMENTS_OIDC_ISSUER).
    `auth.New` hace discovery a partir de esta URL.
  EOT
  value       = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.this.id}"
}

output "jwks_uri" {
  description = "URL del JWKS del emisor (se obtiene también vía discovery; útil para diagnósticos)."
  value       = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.this.id}/.well-known/jwks.json"
}

output "client_id" {
  description = <<-EOT
    ID del App Client público (SPA / móvil). En Cognito, el `aud` del ID token
    es el client id; se inyecta a los servicios como OIDC_AUDIENCE.
  EOT
  value       = aws_cognito_user_pool_client.spa.id
}

output "hosted_ui_domain" {
  description = "Dominio del Hosted UI de Cognito (sin esquema), p. ej. 'certready-dev-abc.auth.<region>.amazoncognito.com'."
  value       = "${aws_cognito_user_pool_domain.this.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

output "hosted_ui_login_url" {
  description = "URL de inicio de sesión del Hosted UI (Authorization Code + PKCE). Reemplazar {redirect_uri} y {state} en el cliente."
  value       = "https://${aws_cognito_user_pool_domain.this.domain}.auth.${data.aws_region.current.name}.amazoncognito.com/oauth2/authorize?client_id=${aws_cognito_user_pool_client.spa.id}&response_type=code&scope=openid+email+profile"
}

data "aws_region" "current" {}
