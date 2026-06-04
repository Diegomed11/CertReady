# ---------------------------------------------------------------------------
# Módulo network — VPC y segmentación de red.
#
# Topología (alineada con el diagrama de arquitectura del doc):
#   Subredes públicas   : ALB + NAT GW (egress controlado).
#   Subredes privadas-app : tareas ECS Fargate; sin acceso entrante directo.
#   Subredes privadas-data: RDS; sin ruta a internet.
#
# NAT GW: uno por AZ si single_nat_gw = false (HA de prod); uno compartido si
# single_nat_gw = true (ahorra ~$30/mes en dev).
# ---------------------------------------------------------------------------

locals {
  name      = "certready-${var.env}"
  nat_count = var.single_nat_gw ? 1 : length(var.azs)
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "${local.name}-vpc", Env = var.env }
}

# ---------------------------------------------------------------------------
# Subredes
# ---------------------------------------------------------------------------

resource "aws_subnet" "public" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = var.azs[count.index]

  # Las instancias del ALB no necesitan IP pública; el ALB la tiene propia.
  map_public_ip_on_launch = false

  tags = { Name = "${local.name}-public-${var.azs[count.index]}", Tier = "public", Env = var.env }
}

resource "aws_subnet" "private_app" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_app_subnet_cidrs[count.index]
  availability_zone = var.azs[count.index]

  tags = { Name = "${local.name}-private-app-${var.azs[count.index]}", Tier = "private-app", Env = var.env }
}

resource "aws_subnet" "private_data" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_data_subnet_cidrs[count.index]
  availability_zone = var.azs[count.index]

  tags = { Name = "${local.name}-private-data-${var.azs[count.index]}", Tier = "private-data", Env = var.env }
}

# ---------------------------------------------------------------------------
# Internet Gateway + rutas públicas
# ---------------------------------------------------------------------------

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-igw", Env = var.env }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${local.name}-rt-public", Env = var.env }
}

resource "aws_route_table_association" "public" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------------------
# NAT Gateway + rutas privadas de aplicación
#
# Las subredes de datos no tienen ruta a internet: el tráfico de RDS es interno.
# ---------------------------------------------------------------------------

resource "aws_eip" "nat" {
  count  = local.nat_count
  domain = "vpc"
  tags   = { Name = "${local.name}-eip-nat-${count.index}", Env = var.env }
}

resource "aws_nat_gateway" "main" {
  count         = local.nat_count
  allocation_id = aws_eip.nat[count.index].id
  # Los NAT GW se crean en subredes públicas; el egress sale por el IGW.
  subnet_id  = aws_subnet.public[count.index].id
  tags       = { Name = "${local.name}-natgw-${count.index}", Env = var.env }
  depends_on = [aws_internet_gateway.main]
}

resource "aws_route_table" "private_app" {
  count  = length(var.azs)
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    # Si hay un solo NAT GW (dev), todas las AZs lo comparten; si hay N, cada AZ usa el suyo.
    nat_gateway_id = aws_nat_gateway.main[min(count.index, local.nat_count - 1)].id
  }
  tags = { Name = "${local.name}-rt-private-app-${var.azs[count.index]}", Env = var.env }
}

resource "aws_route_table_association" "private_app" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private_app[count.index].id
}

# Subredes de datos: tabla de rutas sin salida a internet.
resource "aws_route_table" "private_data" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-rt-private-data", Env = var.env }
}

resource "aws_route_table_association" "private_data" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.private_data[count.index].id
  route_table_id = aws_route_table.private_data.id
}
