# Versiones requeridas para validar el módulo en aislamiento. Cuando se instancia
# desde un entorno (parqueado por ahora), el entorno provee su propio provider y
# este archivo no entra en conflicto: declarar versiones a nivel de módulo es la
# práctica recomendada por HashiCorp para módulos reutilizables.

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
