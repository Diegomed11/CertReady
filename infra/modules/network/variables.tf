variable "env" {
  description = "Nombre del entorno (dev | staging | prod). Se usa como etiqueta y en los nombres de recurso."
  type        = string
}

variable "vpc_cidr" {
  description = "Bloque CIDR de la VPC (p. ej. '10.0.0.0/16')."
  type        = string
  default     = "10.0.0.0/16"
}

variable "azs" {
  description = "Lista de zonas de disponibilidad en las que crear las subredes."
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "CIDRs de las subredes públicas (ALB, NAT GW). Un CIDR por AZ."
  type        = list(string)
}

variable "private_app_subnet_cidrs" {
  description = "CIDRs de las subredes privadas de aplicación (tareas Fargate). Un CIDR por AZ."
  type        = list(string)
}

variable "private_data_subnet_cidrs" {
  description = "CIDRs de las subredes privadas de datos (RDS). Un CIDR por AZ."
  type        = list(string)
}

variable "single_nat_gw" {
  description = <<-EOT
    Si true, crea un único NAT GW en la primera AZ (reduce costo en dev).
    Si false, crea un NAT GW por AZ (alta disponibilidad para staging/prod).
  EOT
  type        = bool
  default     = false
}
