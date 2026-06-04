# Fase 0 — Fundaciones · Checklist (Definition of Done)

Lista viva del DoD de la Fase 0 (ver el roadmap en
[`arquitectura-y-fases-certready.md`](arquitectura-y-fases-certready.md), §14).
Marcar `[x]` solo cuando esté **hecho y verificado**. No se avanza a Fase 1
hasta cerrar todo lo marcado como bloqueante (🚩).

## Estructura y convenciones
- [x] Layout del monorepo (`services/`, `judge/`, `data/`, `web/`, `mobile/`, `infra/`, `docs/`).
- [x] `.gitignore`, `README.md` raíz, bitácora de avance.
- [x] Convenciones de servicios Go (`CONTRIBUTING.md`).
- [x] Repo git inicializado (`main`) con primer commit convencional + `.gitattributes` (LF).

## Servicio "hello world" desplegable
- [x] Servicio Go mínimo (`services/health`) con endpoints `/v1/health` y `/v1/ready`.
- [x] Config 12-factor, logging estructurado, graceful shutdown.
- [x] Tests de handlers (`go test ./...`).
- [x] `Dockerfile` multi-stage hacia imagen mínima.
- [x] **Verificado** localmente con Go 1.26.4: `gofmt` ✓, `go vet` ✓, `go test ./...` ✓
      (cobertura config 87.5% / httpapi 89.3%), prueba de humo de `/v1/health` y `/v1/ready` ✓.
- [ ] `docker build` verificado. _(Pendiente: Docker no instalado — ver BITACORA 2026-06-03.)_
- [ ] `go test -race`. _(Pendiente: requiere cgo/compilador C — ver BITACORA 2026-06-03.)_

## Infraestructura (Terraform) — ruta de costo cero (ADR-07)
- [x] Módulos ACTIVOS: `lambda` (función + Function URL + rol exec) y `cicd` (OIDC + deploy).
- [x] Módulos PARQUEADOS (validados, no instanciados): `network`, `ecr`, `ecs`, `iam`, `secrets`.
- [x] `environments/dev/` reescrito: solo `lambda` + `cicd` → **costo $0** (sin VPC/NAT/Fargate).
- [x] Rol OIDC para GitHub Actions con permiso mínimo (`lambda:UpdateFunctionCode`).
- [x] `terraform fmt` ✓ y **`terraform validate` ✓** (Terraform v1.15.5, provider aws v5.100.0).
- [ ] ⏸️ `terraform apply` en dev — diferido (sin cuenta AWS activa). Código validado y $0.
- [ ] ⏸️ Infra recreable desde cero con `terraform apply` — diferido (mismo motivo).

## CI/CD (GitHub Actions)
- [x] Pipeline: `lint-test` (gofmt + vet + golangci-lint + `go test -race -cover`)
      y `build-lambda` (compila bootstrap + zip + artefacto), matriz por servicio.
- [x] `.golangci.yml` (config conservadora y determinista).
- [ ] ⏸️ Deploy automático a `dev` (OIDC → `aws lambda update-function-code`) — stub listo, requiere AWS.
- [ ] ⏸️ **Salida de fase:** servicio Go desplegado en `dev` por el pipeline — diferido.

## Observabilidad
- [ ] ⏸️ CloudWatch Logs del Lambda (free tier) — se crea con el `apply`.

---

## Estado de la fase

**Construcción local: COMPLETA y verificada.** Todo el código (servicio Go,
pipeline CI, IaC) está escrito, formateado, testeado y validado en esta máquina.

**Despliegue: DIFERIDO por decisión (2026-06-03).** Los ítems ⏸️ dependen de una
cuenta AWS y/o un remoto GitHub; se ejecutarán cuando se decida desplegar. No
bloquean el avance a Fase 1 del trabajo de aplicación.

**Para retomar el despliegue** (cuando haya cuenta AWS):
1. `git remote add origin <url>` && `git push -u origin main` → CI corre solo.
2. Crear bucket S3 + tabla DynamoDB de estado (ver `infra/README.md`).
3. `cd infra/environments/dev && terraform apply` (con credenciales AWS).
4. Copiar el output `github_deploy_role_arn` a los secrets del repo y activar el
   job `deploy-dev` (descomentar el stub en `.github/workflows/ci.yml`).

**Criterio de salida original:** un servicio Go "hello world" desplegado en `dev`
por el pipeline, e infraestructura recreable desde cero con Terraform. → El
artefacto y la IaC están listos y validados; la ejecución del despliegue queda
parqueada a petición del responsable.
