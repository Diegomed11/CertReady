output "vpc_id" {
  description = "ID de la VPC creada."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs de las subredes públicas (orden: una por AZ, mismo orden que var.azs)."
  value       = aws_subnet.public[*].id
}

output "private_app_subnet_ids" {
  description = "IDs de las subredes privadas de aplicación (Fargate)."
  value       = aws_subnet.private_app[*].id
}

output "private_data_subnet_ids" {
  description = "IDs de las subredes privadas de datos (RDS)."
  value       = aws_subnet.private_data[*].id
}

output "nat_gateway_ids" {
  description = "IDs de los NAT Gateways creados."
  value       = aws_nat_gateway.main[*].id
}
