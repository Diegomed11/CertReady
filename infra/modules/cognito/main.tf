# ---------------------------------------------------------------------------
# Módulo cognito — Identidad gestionada (ADR-06).
#
# Provisiona un User Pool de Amazon Cognito con su Hosted UI, un App Client
# público (SPA / móvil) configurado para OAuth Authorization Code + PKCE, y los
# grupos RBAC del proyecto (admin / estudiante), que viajan en los JWT como
# `cognito:groups` (claim que `libs/platform/auth` ya extrae a Identity.Roles).
#
# El módulo está PARQUEADO (ver infra/README.md): se conserva validado pero no
# se instancia desde ningún entorno. Se activa cuando exista cuenta AWS.
#
# El `aud` del ID token de Cognito es el client id, así que la variable
# `OIDC_AUDIENCE` de los servicios debe fijarse al output `client_id`.
# ---------------------------------------------------------------------------

locals {
  name = "certready-${var.env}-${var.pool_name}"
}

# ---------------------------------------------------------------------------
# User Pool
# ---------------------------------------------------------------------------

resource "aws_cognito_user_pool" "this" {
  name = local.name

  # Email como identificador de login. Verificación automática por enlace
  # (más simple en SPA que el flujo por código).
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  mfa_configuration = var.mfa_configuration

  # Atributo `name` estándar OIDC, para que el claim `name` viaje en el token
  # y `libs/platform/auth` lo lea como Identity.Nombre (Inc.2b).
  schema {
    name                     = "name"
    attribute_data_type      = "String"
    mutable                  = true
    required                 = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 120
    }
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_LINK"
  }

  tags = { Env = var.env, Component = "auth" }
}

# ---------------------------------------------------------------------------
# Grupos RBAC
#
# `admin` precedence 1 (menor número = mayor prioridad), `estudiante` 10.
# Estos nombres son los que valida auth.RequireRole("admin").
# ---------------------------------------------------------------------------

resource "aws_cognito_user_group" "admin" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Administradores del catálogo y de la plataforma."
  precedence   = 1
}

resource "aws_cognito_user_group" "estudiante" {
  name         = "estudiante"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Usuarios estudiantes (rol por defecto)."
  precedence   = 10
}

# ---------------------------------------------------------------------------
# Dominio Hosted UI (gratuito, sufijo amazoncognito.com)
# ---------------------------------------------------------------------------

resource "aws_cognito_user_pool_domain" "this" {
  domain       = var.domain_prefix
  user_pool_id = aws_cognito_user_pool.this.id
}

# ---------------------------------------------------------------------------
# App Client (público — SPA / móvil)
#
# Sin secret: las apps públicas usan PKCE en vez de un secret embebido.
# Flujo OAuth: Authorization Code (recomendado por OAuth 2.1 frente a Implicit).
# ---------------------------------------------------------------------------

resource "aws_cognito_user_pool_client" "spa" {
  name                                          = "${local.name}-spa"
  user_pool_id                                  = aws_cognito_user_pool.this.id
  generate_secret                               = false
  prevent_user_existence_errors                 = "ENABLED"
  enable_token_revocation                       = true
  enable_propagate_additional_user_context_data = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  supported_identity_providers = ["COGNITO"]

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  access_token_validity  = var.access_token_validity_hours
  id_token_validity      = var.id_token_validity_hours
  refresh_token_validity = var.refresh_token_validity_days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Devuelve solo lo necesario al cliente; el resto se obtiene vía /oauth2/userInfo.
  read_attributes  = ["email", "email_verified", "name"]
  write_attributes = ["email", "name"]
}
