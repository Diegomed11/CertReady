# ---------------------------------------------------------------------------
# Módulo lambda — Función de cómputo de costo cero (ADR-07).
#
# Ruta de despliegue "always free": Lambda + Function URL no tienen costo fijo y
# caen en la capa gratuita permanente de AWS (1M req + 400k GB-s/mes). Sin VPC,
# por tanto sin NAT Gateway. Adecuado para el servicio health de Fase 0.
#
# El código (binario `bootstrap` empaquetado en zip) lo actualiza el pipeline de
# CI vía `aws lambda update-function-code`; por eso el lifecycle ignora cambios
# de `filename`/`source_code_hash` y Terraform no entra en conflicto con CI.
# ---------------------------------------------------------------------------

locals {
  name = "certready-${var.env}-${var.function_name}"
}

# ---------------------------------------------------------------------------
# Rol de ejecución (mínimo privilegio: solo escribir logs)
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "exec" {
  name               = "${local.name}-exec"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = { Env = var.env, Function = var.function_name }
}

# Política gestionada por AWS: permite a la función crear y escribir en su
# log group de CloudWatch. No concede ningún otro permiso.
resource "aws_iam_role_policy_attachment" "basic_logs" {
  role       = aws_iam_role.exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ---------------------------------------------------------------------------
# Log group (creado explícitamente para controlar la retención)
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = var.log_retention_days
  tags              = { Env = var.env, Function = var.function_name }
}

# ---------------------------------------------------------------------------
# Función
# ---------------------------------------------------------------------------

resource "aws_lambda_function" "this" {
  function_name = local.name
  role          = aws_iam_role.exec.arn
  handler       = "bootstrap" # Convención del custom runtime: el ejecutable se llama bootstrap.
  runtime       = var.runtime
  architectures = [var.architecture]
  memory_size   = var.memory_mb
  timeout       = var.timeout_s

  filename         = var.package_path
  source_code_hash = var.source_code_hash

  environment {
    variables = var.env_vars
  }

  # Asegura que el log group exista (con su retención) antes que la función.
  depends_on = [
    aws_iam_role_policy_attachment.basic_logs,
    aws_cloudwatch_log_group.lambda,
  ]

  # El pipeline de CI gestiona el código; Terraform solo gestiona la infra.
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  tags = { Env = var.env, Function = var.function_name }
}

# ---------------------------------------------------------------------------
# Function URL — endpoint HTTPS público, gratuito (sin API Gateway)
#
# authorization_type = "NONE": el servicio health es público a propósito. Los
# servicios de negocio de Fase 1+ usarán autorización (IAM o validación de JWT
# en el handler) en lugar de exponer la URL sin control.
# ---------------------------------------------------------------------------

resource "aws_lambda_function_url" "this" {
  function_name      = aws_lambda_function.this.function_name
  authorization_type = "NONE"
}
