variable "env" {
  description = "Nombre del entorno (dev | staging | prod). Se usa en nombres y etiquetas."
  type        = string
}

variable "pool_name" {
  description = "Nombre lógico del User Pool (se prefija con 'certready-<env>-')."
  type        = string
  default     = "users"
}

variable "domain_prefix" {
  description = <<-EOT
    Prefijo único global del dominio gratuito de Cognito Hosted UI (sufijo
    .auth.<region>.amazoncognito.com). Debe ser globalmente único; convención:
    'certready-<env>-<sufijo>'. Para producción, considerar un dominio propio
    con aws_cognito_user_pool_domain + ACM (no incluido aquí).
  EOT
  type        = string
}

variable "callback_urls" {
  description = "URLs de callback OAuth permitidas para el App Client (web y/o móvil)."
  type        = list(string)
  default     = ["http://localhost:3000/auth/callback"]
}

variable "logout_urls" {
  description = "URLs de logout permitidas para el App Client."
  type        = list(string)
  default     = ["http://localhost:3000/auth/logout"]
}

variable "access_token_validity_hours" {
  description = "Vida del access token (horas)."
  type        = number
  default     = 1
}

variable "id_token_validity_hours" {
  description = "Vida del id token (horas)."
  type        = number
  default     = 1
}

variable "refresh_token_validity_days" {
  description = "Vida del refresh token (días)."
  type        = number
  default     = 30
}

variable "mfa_configuration" {
  description = "Configuración de MFA: 'OFF' | 'OPTIONAL' | 'ON'. Por defecto OFF en dev para no atorar el flujo; subir en prod."
  type        = string
  default     = "OFF"

  validation {
    condition     = contains(["OFF", "OPTIONAL", "ON"], var.mfa_configuration)
    error_message = "mfa_configuration debe ser uno de: OFF, OPTIONAL, ON."
  }
}
