# Despliegue a AWS — plan / runbook (Fase 7)

Guía para llevar CertReady de local ($0) a producción en AWS. **Es la fase que rompe
el costo cero** (RDS, ALB, NAT GW, etc. tienen cargo). No es "un `terraform apply`":
parte de la infra está escrita, pero **falta IaC y hay decisiones que tomar antes**.

> Estado del repo: la arquitectura y ADRs están en `arquitectura-y-fases-certready.md`;
> el endurecimiento de seguridad (hecho) en `seguridad-y-produccion.md`; el IaC en
> `infra/` (ver `infra/README.md`).

## 1) Qué ya está hecho (infra/)

- **Módulos Terraform validados** (`infra/modules/`): `network` (VPC/subnets/NAT),
  `ecr`, `iam` (roles ECS), `secrets` (placeholders Secrets Manager), `ecs` (cluster
  Fargate + task def + service por cada entrada de `var.services`), `cognito` (User Pool +
  App Client PKCE + grupos + Hosted UI), `lambda` y `cicd` (OIDC GitHub Actions).
- **Estado remoto**: backend S3 + DynamoDB (lock).
- **Entorno `dev`**: solo instancia `lambda` (health) + `cicd` (ruta costo cero). 
- **App lista para contenedor**: cada servicio Go tiene Dockerfile multi-stage; el código
  es agnóstico del emisor OIDC (Cognito en prod) y de la config (12-factor); RLS con
  kill-switch listo para activar.

## 2) Qué FALTA escribir en IaC (no existe todavía)

- **`environments/prod`** real (hoy es un stub `.gitkeep`): componer network + ecr + iam +
  secrets + ecs (con TODOS los servicios en `var.services`) + cognito.
- **ALB + listener rules + target groups** (el módulo `ecs` aún no enlaza ALB; lo dice su
  propio comentario). Necesario para enrutar `/api`, servicios y web.
- **RDS (PostgreSQL)** — no hay módulo. Para users/enrollments/exams/progress/judge.
- **CloudFront + WAF + ACM (TLS) + Route53** — no hay módulo. CDN, reglas OWASP, HTTPS,
  dominio.
- **Hosting de la capa de datos**: ClickHouse, Cube y el DSS (FastAPI). MongoDB → Atlas.
- **Web (Next.js BFF)**: contenedor en Fargate detrás de ALB/CloudFront, o AWS Amplify.

## 3) Decisiones a tomar ANTES (bloqueantes)

1. **El juez (lo más delicado).** Ejecuta código no confiable en **contenedores Docker**.
   **Fargate NO permite Docker-in-Docker** (sin daemon, sin `--privileged`). Opciones:
   - **ECS sobre EC2** (no Fargate) con acceso al daemon Docker — mantiene el sandbox
     actual; hay que endurecer el host. *(camino más directo)*
   - **microVM** (Firecracker / gVisor) o un runner aislado dedicado.
   - EC2 dedicada solo para el juez.
   Hay que elegir esto antes de desplegar el juez.
2. **Región** (p. ej. `us-east-1`) y **dominio** (Route53 + ACM).
3. **Datos gestionados vs autogestionados**: RDS (sí, gestionado), **Mongo Atlas** (free
   M0 para empezar), **ClickHouse** (ClickHouse Cloud vs EC2 autogestionado), **Cube**
   (contenedor).
4. **Presupuesto**: ver §7. Define un **AWS Budget + alerta** antes de nada.

## 4) Pre-requisitos (una sola vez, manual)

- Cuenta AWS + usuario/rol con permisos de admin para el bootstrap.
- **Backend de estado**: bucket S3 + tabla DynamoDB (comandos en `infra/README.md` §Pre-requisitos).
- **Dominio** en Route53 + **certificado ACM** (en `us-east-1` si se usa CloudFront).
- **AWS Budget** con alerta de gasto.
- Rol OIDC para GitHub Actions (módulo `cicd`) — sin llaves estáticas.

## 5) Orden de despliegue (alto nivel)

1. **Backend remoto** (S3 + DynamoDB) y `terraform init` del entorno `prod`.
2. **Secrets Manager**: `SESSION_PASSWORD`, credenciales RDS, claves de Mongo/ClickHouse,
   IDs de Cognito. Nada de `.env` en prod.
3. **Red**: `network` (VPC, subnets, NAT GW).
4. **Cognito**: instanciar el módulo → User Pool + App Client (PKCE) + grupos. Apuntar la
   app a este emisor (reemplaza `oidc-mock`).
5. **Datos**: RDS (Postgres) + correr migraciones (incluye las de RLS); Mongo Atlas;
   ClickHouse + Cube; sembrar catálogo/contenido.
6. **ECR** + **build/push de imágenes** (los Dockerfiles ya existen) — vía CI/CD.
7. **ECS/Fargate**: servicios Go + DSS + web, con `var.services` (imagen, puerto, CPU/mem,
   env, secrets). **Juez** según la decisión de §3.1.
8. **ALB + target groups + listener rules** (HTTPS) → enrutar web y `/api` (el web BFF es
   el único expuesto al navegador; los servicios Go quedan internos).
9. **CloudFront + WAF** delante (rate-limit distribuido, reglas OWASP) + Route53.
10. **CI/CD**: activar GitHub Actions → ECR → ECS (deploy por push a `main`).
11. **Post-deploy**: smoke tests, activar **RLS** (rol `certready_app` + `*_RLS_ENABLED`),
    promover **CSP a enforce**, verificar headers/WAF.

## 6) Config de la app para prod (env, no código)

- `OIDC_ISSUER` → el User Pool de Cognito; `OIDC_CLIENT_ID` → el App Client.
- `SESSION_PASSWORD` y credenciales → desde Secrets Manager (la cookie ya es `Secure` en
  prod por `NODE_ENV=production`).
- `*_BASE_URL` → URLs internas de los servicios tras el ALB.
- `*_RLS_ENABLED=true` + DSN con el rol `certready_app` (no superusuario) para activar RLS.
- `CLICKHOUSE_*`, `MONGO_URI`, `DATABASE_URL` → endpoints gestionados.

## 7) Costo (aprox., rompe el $0)

Costos fijos típicos al mes (varía por región/uso):
- **NAT Gateway** ~$32 (+ tráfico) — el más molesto; mitigable con NAT instance o VPC
  endpoints.
- **ALB** ~$16 (+ LCU).
- **RDS** db.t4g.micro ~$12–15 (gratis 12 meses en Free Tier).
- **Fargate**: por tarea (vCPU/mem × horas) — varios servicios pequeños.
- **ClickHouse**: EC2 pequeño (~$15+) o ClickHouse Cloud.
- **Cognito**: 50k MAU gratis; **CloudFront/WAF/Route53**: bajo al inicio.
- **Mongo Atlas**: M0 gratis para empezar.

Mínimo realista: **~$60–120/mes** aun en lo más austero. Define el Budget primero.

## 8) Checklist
- [ ] AWS Budget + alerta.
- [ ] Backend S3 + DynamoDB.
- [ ] Decidir hosting del **juez** (EC2/microVM, no Fargate puro).
- [ ] Escribir `environments/prod` + módulos faltantes (ALB, RDS, CloudFront/WAF, ACM).
- [ ] Secrets Manager poblado.
- [ ] Cognito + swap del emisor.
- [ ] Datos (RDS/Atlas/ClickHouse) + migraciones + seed.
- [ ] Imágenes en ECR (CI/CD).
- [ ] ECS + ALB + CloudFront/WAF + DNS.
- [ ] Activar RLS + CSP enforce; smoke tests.

> Notas legales antes de lanzar (en `contenido-y-marcas.md`): disclaimer de marcas,
> política de contenido, atribuciones, Términos y Privacidad.
