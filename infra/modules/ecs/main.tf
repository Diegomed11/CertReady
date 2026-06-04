# ---------------------------------------------------------------------------
# Módulo ecs — Cluster Fargate, log groups, task definitions y servicios.
#
# Cada servicio del mapa `var.services` obtiene:
#   - Un CloudWatch log group propio (retención configurable).
#   - Una task definition con un contenedor.
#   - Un ECS service con el desired_count indicado.
#   - Un security group que solo permite tráfico en el puerto del contenedor
#     (el ALB se añadirá en la Fase 1, cuando haya servicios de negocio reales).
#
# Nota sobre el ALB: el servicio health de Fase 0 solo se usa para validar el
# camino de despliegue. El ALB y los listener rules se construirán en Fase 1
# junto con los primeros servicios de negocio que necesiten enrutado externo.
# ---------------------------------------------------------------------------

resource "aws_ecs_cluster" "main" {
  name = "certready-${var.env}"

  setting {
    name  = "containerInsights"
    value = "enabled" # Métricas de contenedor en CloudWatch sin agente adicional.
  }

  tags = { Env = var.env }
}

# ---------------------------------------------------------------------------
# CloudWatch log groups (uno por servicio)
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "service" {
  for_each = var.services

  name              = "/certready/${var.env}/${each.key}"
  retention_in_days = var.log_retention_days

  tags = { Service = each.key, Env = var.env }
}

# ---------------------------------------------------------------------------
# Security groups de las tareas
# ---------------------------------------------------------------------------

resource "aws_security_group" "task" {
  for_each = var.services

  name        = "certready-${var.env}-${each.key}-task"
  description = "SG de las tareas Fargate del servicio ${each.key}. Solo permite trafico en el puerto de la app."
  vpc_id      = var.vpc_id

  # Entrada solo en el puerto del contenedor (desde la VPC, no desde internet).
  ingress {
    description = "Trafico de la app desde la VPC"
    from_port   = each.value.port
    to_port     = each.value.port
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  # Egress irrestricto: las tareas necesitan salir a ECR, Secrets Manager y
  # otros servicios AWS a través del NAT GW.
  egress {
    description = "Egress irrestricto hacia internet via NAT GW"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Service = each.key, Env = var.env }
}

# ---------------------------------------------------------------------------
# Task definitions
# ---------------------------------------------------------------------------

resource "aws_ecs_task_definition" "service" {
  for_each = var.services

  family                   = "certready-${var.env}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc" # Obligatorio en Fargate; cada tarea recibe su ENI propia.
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = each.value.image
      essential = true

      portMappings = [
        { containerPort = each.value.port, protocol = "tcp" }
      ]

      environment = [
        for k, v in each.value.env_vars : { name = k, value = v }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.service[each.key].name
          awslogs-region        = "us-east-1" # Sobrescribir en entornos de otra región si fuera necesario.
          awslogs-stream-prefix = each.key
        }
      }

      # Sondas de salud mapeadas a los endpoints del servicio Go.
      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:${each.value.port}/v1/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }
    }
  ])

  tags = { Service = each.key, Env = var.env }
}

# ---------------------------------------------------------------------------
# ECS Services
# ---------------------------------------------------------------------------

resource "aws_ecs_service" "service" {
  for_each = var.services

  name            = "certready-${var.env}-${each.key}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.service[each.key].arn
  desired_count   = each.value.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_app_subnet_ids
    security_groups  = [aws_security_group.task[each.key].id]
    assign_public_ip = false # Las tareas viven en subredes privadas; salen por NAT GW.
  }

  # El ALB se vinculará en la Fase 1; mientras tanto, el servicio es interno.
  # load_balancer { ... }

  # Evitar que Terraform revierta cambios de desired_count hechos por autoscaling.
  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = { Service = each.key, Env = var.env }
}
