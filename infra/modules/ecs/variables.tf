variable "env" {
  description = "Nombre del entorno."
  type        = string
}

variable "vpc_id" {
  description = "ID de la VPC donde viven las tareas."
  type        = string
}

variable "private_app_subnet_ids" {
  description = "Subredes privadas de aplicación donde se lanzan las tareas Fargate."
  type        = list(string)
}

variable "services" {
  description = <<-EOT
    Mapa de servicios a desplegar. Clave: nombre del servicio.
    Cada objeto define la configuración mínima de la task definition y el servicio.
  EOT
  type = map(object({
    image         = string      # URL de la imagen ECR, incluido el tag.
    cpu           = number      # CPU en unidades vCPU × 1024 (256, 512, 1024…).
    memory        = number      # Memoria en MiB.
    port          = number      # Puerto que expone el contenedor.
    desired_count = number      # Número de tareas deseadas.
    env_vars      = map(string) # Variables de entorno no sensibles.
  }))
  default = {}
}

variable "execution_role_arn" {
  description = "ARN del rol de ejecución ECS (para pull de ECR y lectura de secretos)."
  type        = string
}

variable "task_role_arn" {
  description = "ARN del rol de tarea ECS (para permisos del proceso dentro del contenedor)."
  type        = string
}

variable "log_retention_days" {
  description = "Días de retención de logs en CloudWatch. En dev se reduce para controlar costos."
  type        = number
  default     = 7
}
