variable "env" {
  description = "Nombre del entorno."
  type        = string
}

variable "secrets" {
  description = <<-EOT
    Mapa de secretos a crear en Secrets Manager.
    Clave: nombre lógico (p. ej. "db_password").
    Valor: descripción del secreto.
    El valor real se establece manualmente en la consola o con AWS CLI después
    del terraform apply; nunca se almacena en este código.
  EOT
  type        = map(string)
  default     = {}
}
