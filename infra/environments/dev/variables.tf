variable "aws_region" {
  description = "Región AWS donde se despliega el entorno dev."
  type        = string
  default     = "us-east-1"
}

variable "health_version" {
  description = "Versión/imagen del servicio health (sha del commit en CI). Aparece en las respuestas y logs."
  type        = string
  default     = "dev"
}

variable "health_package_path" {
  description = <<-EOT
    Ruta (relativa a este directorio) al zip de despliegue de la Lambda health,
    producido por `make package-lambda` en services/health.
    En `terraform validate` no se lee; en `apply` debe existir.
  EOT
  type        = string
  default     = "../../../services/health/build/health-lambda.zip"
}

variable "github_org" {
  description = "Organización o usuario GitHub dueño del repositorio."
  type        = string
}

variable "github_repo" {
  description = "Nombre del repositorio GitHub."
  type        = string
  default     = "certready"
}
