variable "env" {
  description = "Nombre del entorno."
  type        = string
}

variable "services" {
  description = "Lista de nombres de servicio para los que crear un repositorio ECR (p. ej. ['health', 'users'])."
  type        = list(string)
}

variable "image_count_keep" {
  description = "Número de imágenes con tag a conservar por repositorio (las más recientes). Las más antiguas se eliminan automáticamente."
  type        = number
  default     = 10
}
