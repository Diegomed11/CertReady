variable "env" {
  description = "Nombre del entorno."
  type        = string
}

variable "ecr_repository_arns" {
  description = "ARNs de los repositorios ECR a los que el rol de ejecución debe poder hacer pull."
  type        = list(string)
  default     = []
}

variable "secret_arns" {
  description = "ARNs de los secretos de Secrets Manager que las tareas ECS pueden leer."
  type        = list(string)
  default     = []
}

variable "github_org" {
  description = "Organización o usuario de GitHub dueño del repositorio (p. ej. 'certready')."
  type        = string
}

variable "github_repo" {
  description = "Nombre del repositorio GitHub (p. ej. 'certready'). El rol OIDC solo acepta tokens de este repo."
  type        = string
}
