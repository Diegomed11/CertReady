# ---------------------------------------------------------------------------
# Estado remoto — S3 + DynamoDB (una sola vez, setup manual).
#
# Descomenta y rellena después de crear el bucket y la tabla DynamoDB
# siguiendo las instrucciones de infra/README.md.
#
# backend "s3" {
#   bucket         = "certready-tfstate-<ACCOUNT_ID>"
#   key            = "dev/terraform.tfstate"
#   region         = "us-east-1"
#   dynamodb_table = "certready-tfstate-lock"
#   encrypt        = true
# }
# ---------------------------------------------------------------------------
