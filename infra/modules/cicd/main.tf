# ---------------------------------------------------------------------------
# Módulo cicd — Acceso de despliegue para GitHub Actions vía OIDC.
#
# GitHub Actions obtiene un token OIDC firmado por GitHub; AWS lo valida contra
# el proveedor registrado aquí y entrega credenciales STS temporales. Sin llaves
# estáticas → sin rotación manual ni riesgo de fuga en GitHub Secrets.
#
# El rol de deploy solo puede actualizar el código de las funciones Lambda
# indicadas (mínimo privilegio). La condición `sub` lo limita al repositorio y la
# rama main.
# ---------------------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  # Thumbprint de la CA raíz de token.actions.githubusercontent.com.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "assume" {
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
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "certready-${var.env}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = { Env = var.env }
}

# Permisos de deploy: actualizar el código y leer la configuración de las
# funciones Lambda del proyecto. Nada más.
data "aws_iam_policy_document" "deploy" {
  statement {
    sid    = "LambdaDeploy"
    effect = "Allow"
    actions = [
      "lambda:UpdateFunctionCode",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
    ]
    resources = length(var.lambda_function_arns) > 0 ? var.lambda_function_arns : ["*"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
