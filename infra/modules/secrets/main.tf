# ---------------------------------------------------------------------------
# Módulo secrets — Placeholders de Secrets Manager.
#
# Terraform crea la "cáscara" del secreto (nombre, descripción, rotación).
# El valor real lo introduce un operador manualmente una sola vez:
#
#   aws secretsmanager put-secret-value \
#     --secret-id <arn> \
#     --secret-string '{"password":"<valor>"}'
#
# Principio de "cero secretos en código": el valor NUNCA está en el repo.
# La rotación automática se configurará en Fase 7 (endurecimiento).
# ---------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "app" {
  for_each = var.secrets

  name        = "certready/${var.env}/${each.key}"
  description = each.value

  # recovery_window_in_days = 0 → borrado inmediato (útil en dev para
  # recrear el secreto sin esperar; en prod usar el default de 30 días).
  recovery_window_in_days = var.env == "prod" ? 30 : 0

  tags = { Env = var.env, SecretKey = each.key }
}
