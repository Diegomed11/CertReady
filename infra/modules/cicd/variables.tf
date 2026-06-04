variable "env" {
  description = "Nombre del entorno."
  type        = string
}

variable "github_org" {
  description = "Organización o usuario de GitHub dueño del repositorio."
  type        = string
}

variable "github_repo" {
  description = "Nombre del repositorio GitHub. El rol OIDC solo acepta tokens de este repo."
  type        = string
}

variable "lambda_function_arns" {
  description = "ARNs de las funciones Lambda que el pipeline puede actualizar. Si está vacío, se permite cualquier función de la cuenta (menos seguro; usar solo en dev inicial)."
  type        = list(string)
  default     = []
}
