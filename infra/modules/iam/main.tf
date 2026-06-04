# ---------------------------------------------------------------------------
# Módulo iam — Roles de IAM para ECS y CI/CD.
#
# Tres roles:
#   1. Execution role: lo asume el agente de ECS (no la tarea) para
#      hacer pull de ECR y leer secretos antes de arrancar el contenedor.
#   2. Task role: lo asume el proceso dentro del contenedor. Vacío aquí
#      (el servicio health no accede a AWS); cada servicio que sí lo necesite
#      adjuntará políticas adicionales.
#   3. GitHub OIDC deploy role: lo asume GitHub Actions para hacer push a ECR
#      y actualizar el servicio ECS sin llaves estáticas almacenadas en Secrets.
#
# Principio de mínimo privilegio: cada rol tiene exactamente los permisos que
# necesita y no más.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ---------------------------------------------------------------------------
# 1. Execution role
# ---------------------------------------------------------------------------

resource "aws_iam_role" "ecs_execution" {
  name               = "certready-${var.env}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = { Env = var.env }
}

# AWS gestiona la política base de ejecución de ECS (logs, ECR auth básica).
resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Acceso a repositorios ECR específicos del proyecto (mínimo privilegio frente
# a la política gestionada, que da acceso a todos los repos de la cuenta).
data "aws_iam_policy_document" "ecr_pull" {
  count = length(var.ecr_repository_arns) > 0 ? 1 : 0

  statement {
    sid    = "ECRPull"
    effect = "Allow"
    actions = [
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:BatchCheckLayerAvailability",
    ]
    resources = var.ecr_repository_arns
  }

  statement {
    sid       = "ECRAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"] # GetAuthorizationToken no admite restricción por recurso.
  }
}

resource "aws_iam_role_policy" "ecr_pull" {
  count  = length(var.ecr_repository_arns) > 0 ? 1 : 0
  name   = "ecr-pull"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.ecr_pull[0].json
}

# Lectura de secretos desde Secrets Manager (contraseñas de BD, tokens, etc.)
data "aws_iam_policy_document" "secrets_read" {
  count = length(var.secret_arns) > 0 ? 1 : 0

  statement {
    sid       = "SecretsRead"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = var.secret_arns
  }
}

resource "aws_iam_role_policy" "secrets_read" {
  count  = length(var.secret_arns) > 0 ? 1 : 0
  name   = "secrets-read"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.secrets_read[0].json
}

# ---------------------------------------------------------------------------
# 2. Task role (vacío en el servicio health; se extiende por servicio)
# ---------------------------------------------------------------------------

resource "aws_iam_role" "ecs_task" {
  name               = "certready-${var.env}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = { Env = var.env }
}

# ---------------------------------------------------------------------------
# 3. GitHub OIDC deploy role
#
# GitHub Actions obtiene un token OIDC firmado por GitHub; AWS lo valida contra
# el proveedor registrado aquí y entrega credenciales temporales STS. Sin llaves
# estáticas → sin rotación manual ni riesgo de fuga en Secrets.
#
# La condición `sub` limita el rol al repositorio y a la rama main; se puede
# ampliar a un entorno concreto de GitHub Environments (aud = environment).
# ---------------------------------------------------------------------------

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  # Thumbprint de la CA raíz de token.actions.githubusercontent.com.
  # AWS verifica automáticamente los proveedores conocidos a partir de 2023,
  # pero se incluye para cumplir con el esquema de aws_iam_openid_connect_provider.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_oidc_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Restringe a pushes y PRs del repo y la rama main.
    # Para ambientes de GitHub Environments: usar "repo:<org>/<repo>:environment:<env>".
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "certready-${var.env}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_assume.json
  tags               = { Env = var.env }
}

# Permisos del rol de deploy: push a ECR + actualizar el servicio ECS.
data "aws_iam_policy_document" "github_deploy_policy" {
  statement {
    sid    = "ECRPush"
    effect = "Allow"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
    ]
    resources = length(var.ecr_repository_arns) > 0 ? concat(
      ["arn:aws:ecr:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"],
      var.ecr_repository_arns
    ) : ["arn:aws:ecr:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    sid       = "ECRAuthToken"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "ECSUpdateService"
    effect = "Allow"
    actions = [
      "ecs:UpdateService",
      "ecs:DescribeServices",
      "ecs:RegisterTaskDefinition",
      "ecs:DescribeTaskDefinition",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "IAMPassRole"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.ecs_execution.arn, aws_iam_role.ecs_task.arn]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy_policy.json
}
