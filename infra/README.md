# CertReady — Infraestructura (Terraform)

IaC para el despliegue de CertReady en AWS. Estructura de módulos reutilizables
compuestos por entorno (`dev`, `staging`, `prod`), con estado remoto en S3 +
DynamoDB para evitar conflictos concurrentes.

## Dos rutas de despliegue

Por la restricción de **costo cero** (solo Free Tier, sin créditos), conviven dos
rutas de cómputo (ver **ADR-07** en el doc de arquitectura):

- **Ruta ACTIVA — Lambda (costo cero).** `dev` instancia los módulos `lambda` y
  `cicd`. Lambda + Function URL caen en la capa gratuita permanente, sin VPC ni
  NAT Gateway. Es lo que se despliega hoy.
- **Ruta PARQUEADA — Fargate (ADR-05).** Los módulos `network`, `ecr`, `ecs`,
  `iam` y `secrets` quedan **validados pero NO instanciados** por ningún entorno.
  Se activan cuando exista presupuesto/créditos. No se borran para no perder el
  diseño realista de producción.
- **Módulo PARQUEADO — `cognito` (ADR-06).** Identidad gestionada (User Pool,
  App Client público con Authorization Code + PKCE, grupos `admin`/`estudiante`,
  Hosted UI). Validado en aislamiento; se instancia cuando se decida activar la
  autenticación real. Mientras tanto, los servicios se prueban con tokens RS256
  emitidos por `libs/platform/auth/authtest` (ver tests e2e).

## Layout

```
infra/
├── modules/
│   ├── lambda/    [ACTIVO]   Función Lambda + Function URL + rol de ejecución
│   ├── cicd/      [ACTIVO]   Proveedor OIDC + rol de deploy (GitHub Actions)
│   ├── cognito/   [PARQUEADO] User Pool + App Client (PKCE) + grupos + Hosted UI
│   ├── network/   [PARQUEADO] VPC, subnets, IGW, NAT GW, route tables
│   ├── ecr/       [PARQUEADO] Repositorios ECR por servicio
│   ├── iam/       [PARQUEADO] Roles ECS (execution + task) y OIDC
│   ├── ecs/       [PARQUEADO] Cluster Fargate, log group, task def, servicio
│   └── secrets/   [PARQUEADO] Placeholders de Secrets Manager
└── environments/
    ├── dev/       Entorno de desarrollo (ruta Lambda)
    ├── staging/   (stub)
    └── prod/      (stub)
```

> **Costo cero:** el `dev` actual no crea ningún recurso con cargo fijo. Validado
> con `terraform validate`. Para mantenerlo gratis al añadir datos (Fase 1+, RDS),
> ver los trade-offs de ADR-07.

## Pre-requisitos (una sola vez, manual)

Antes del primer `terraform apply` en cualquier entorno hay que crear el bucket
S3 + tabla DynamoDB para el estado remoto. Hacerlo desde la cuenta AWS:

```bash
# Sustituye <ACCOUNT_ID> y la región que uses.
aws s3api create-bucket \
  --bucket certready-tfstate-<ACCOUNT_ID> \
  --region us-east-1
aws s3api put-bucket-versioning \
  --bucket certready-tfstate-<ACCOUNT_ID> \
  --versioning-configuration Status=Enabled
aws dynamodb create-table \
  --table-name certready-tfstate-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Uso por entorno

```bash
cd environments/dev
cp terraform.tfvars.example terraform.tfvars   # ajustar valores
terraform init
terraform validate
terraform plan
terraform apply
```

## Convenciones

- Un módulo = una responsabilidad; los entornos solo componen.
- Nombres de recursos: `certready-<entorno>-<componente>` (p. ej. `certready-dev-vpc`).
- Variables sensibles (contraseñas, IDs de cuenta) → `terraform.tfvars`, nunca al repo.
- IaC del pipeline CI/CD: rol IAM con confianza OIDC (sin llaves estáticas en
  GitHub Secrets), siguiendo las guías de `aws-actions/configure-aws-credentials`.
