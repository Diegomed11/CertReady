variable "env" {
  description = "Nombre del entorno (dev | staging | prod)."
  type        = string
}

variable "function_name" {
  description = "Nombre lógico de la función (se prefija con 'certready-<env>-')."
  type        = string
}

variable "package_path" {
  description = <<-EOT
    Ruta (relativa al directorio del entorno) al zip de despliegue que contiene
    el binario `bootstrap`. Lo produce `make package-lambda` en el servicio.
    En validate no se lee; en apply debe existir.
  EOT
  type        = string
  default     = ""
}

variable "source_code_hash" {
  description = "Hash base64 del paquete (filebase64sha256). Vacío salvo que se gestione el código desde Terraform; normalmente el código lo actualiza el pipeline de CI."
  type        = string
  default     = ""
}

variable "runtime" {
  description = "Runtime de Lambda. 'provided.al2023' = custom runtime para binarios Go."
  type        = string
  default     = "provided.al2023"
}

variable "architecture" {
  description = "Arquitectura de la función. arm64 (Graviton) da mejor rendimiento por GB-s en la capa gratuita."
  type        = string
  default     = "arm64"
}

variable "memory_mb" {
  description = "Memoria asignada en MiB. 128 es el mínimo y suficiente para el servicio health."
  type        = number
  default     = 128
}

variable "timeout_s" {
  description = "Timeout de la invocación en segundos."
  type        = number
  default     = 10
}

variable "env_vars" {
  description = "Variables de entorno no sensibles de la función."
  type        = map(string)
  default     = {}
}

variable "log_retention_days" {
  description = "Retención de logs en CloudWatch. En dev se reduce para controlar costos (el free tier de Logs es 5 GB/mes)."
  type        = number
  default     = 7
}
