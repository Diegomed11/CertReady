# ---------------------------------------------------------------------------
# Módulo ecr — Repositorios de imágenes de contenedor.
#
# Un repositorio por servicio. El pipeline de CI/CD (GitHub Actions) hace push
# aquí después de cada merge a main; ECS Fargate extrae la imagen en el deploy.
#
# Lifecycle policy: conserva las últimas N imágenes con tag y elimina las
# imágenes sin tag (capas intermedias de builds fallidos) pasadas 24 horas.
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "service" {
  for_each = toset(var.services)

  name                 = "certready/${each.key}"
  image_tag_mutability = "IMMUTABLE" # Inmutabilidad: el mismo tag no se sobreescribe; cada deploy usa el sha del commit.

  image_scanning_configuration {
    scan_on_push = true # Detectar CVEs en cada push sin coste adicional (ECR Basic Scanning).
  }

  tags = { Service = each.key, Env = var.env }
}

resource "aws_ecr_lifecycle_policy" "service" {
  for_each   = aws_ecr_repository.service
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Eliminar imágenes sin tag (builds intermedios) después de 1 día."
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Conservar solo las últimas ${var.image_count_keep} imágenes con tag."
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = [""]
          countType     = "imageCountMoreThan"
          countNumber   = var.image_count_keep
        }
        action = { type = "expire" }
      }
    ]
  })
}
