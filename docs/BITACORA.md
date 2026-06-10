# Bitácora de avance — CertReady

Registro cronológico de lo construido, las decisiones tomadas y el siguiente
paso. Una entrada por sesión de trabajo. Las decisiones de **arquitectura** van
como ADR en [`arquitectura-y-fases-certready.md`](arquitectura-y-fases-certready.md);
aquí queda el **avance operativo** (qué se hizo, qué se verificó, qué falta).

Formato de entrada:

- **Fecha** · **Fase** · **Autor**
- **Hecho:** entregables concretos de la sesión.
- **Decisiones:** elecciones tomadas y su porqué (las de arquitectura → ADR).
- **Verificación:** qué se probó y con qué resultado (o por qué quedó pendiente).
- **Siguiente:** el próximo paso acordado.

---

## 2026-06-03 · Fase 0 — Fundaciones · arranque

**Hecho:**
- Estructura del monorepo (ver `README.md`): `services/`, `judge/`, `data/`,
  `web/`, `mobile/`, `infra/`, `docs/`.
- Documento de arquitectura movido a `docs/`.
- Control documental: esta bitácora y `docs/fase-0-checklist.md` (DoD de Fase 0).
- `.gitignore` raíz (Go, Python, Node, Flutter, Terraform, secretos).
- `README.md` raíz con layout y convenciones.
- Convenciones de servicios Go documentadas en `CONTRIBUTING.md`.
- Primer servicio Go desplegable: `services/health` (el "hello world" del DoD de
  Fase 0). Endpoints `GET /v1/health` y `GET /v1/ready`, config 12-factor,
  logging estructurado (`log/slog`), graceful shutdown, tests de handlers,
  `Dockerfile` multi-stage hacia imagen mínima. Sin dependencias externas
  (solo stdlib) para que compile sin red.

**Decisiones:**
- **Monorepo multi-módulo Go:** cada servicio en `services/<nombre>` es su propio
  módulo (`go.mod` propio). Permite versionar y desplegar servicios de forma
  independiente sin un `go.mod` raíz que los acople.
- **Solo stdlib en `health`:** un servicio de salud no justifica dependencias;
  `net/http` + `log/slog` bastan. Mantiene la imagen y la superficie mínimas.
- **API versionada desde el día uno:** rutas bajo `/v1/` (convención del proyecto).

**Verificación:**
- `go test ./...` y `docker build` **pendientes**: Go y Docker no están instalados
  en esta máquina (verificado: `go`/`docker` no están en PATH ni en bash ni en
  PowerShell). El código se escribió contra la API estándar y queda listo para
  validar en cuanto el toolchain esté disponible. → ver Siguiente.

**Siguiente:**
- Instalar Go (≥1.23) y correr `gofmt`, `go vet`, `go test ./...` en
  `services/health`; construir la imagen Docker.
- Bloques 3 y 4 de Fase 0: esqueleto CI/CD (GitHub Actions) y esqueleto Terraform
  (`infra/`), una vez verificado el servicio.

---

## 2026-06-03 · Fase 0 — Fundaciones · verificación del servicio health

**Hecho:**
- Instalado **Go 1.26.4** (winget, `GoLang.Go`). `go env GOPATH = C:\Users\legom\go`.

**Verificación:**
- `gofmt` ✓ (corrigió alineación de campos en `config.go`).
- `go vet ./...` ✓ sin hallazgos · `go build ./...` ✓.
- `go test ./...` ✓ — cobertura: `config` 87.5%, `httpapi` 89.3%
  (`cmd/server` sin tests, esperado).
- Prueba de humo: binario levantado en `:18080`; `GET /v1/health` → 200 `{"status":"ok"}`,
  `GET /v1/ready` → 200 `{"status":"ready"}`, header `X-Request-ID` propagado, logs JSON.
- **Bug encontrado y corregido por la prueba de humo:** el atributo `env` salía
  duplicado en el log de arranque (lo aportaban el logger base y el propio log
  `servicio escuchando`). Se eliminó la clave redundante en `cmd/server/main.go`.

**Pendiente (no bloqueante de la lógica, sí del DoD de despliegue):**
- `docker build`: Docker no está instalado en la máquina.
- `go test -race`: requiere cgo (compilador C, p. ej. gcc de MSYS2/TDM-GCC) no presente.

**Siguiente:**
- Bloque 3 (CI/CD, GitHub Actions) y bloque 4 (Terraform `infra/`). El `-race` y el
  `docker build` se cubrirán en CI (runners Linux con toolchain completo).

---

## 2026-06-03 · Fase 0 — Fundaciones · bloque 3 (CI/CD)

**Contexto:** se invocó la skill de Appwrite; se descartó por no encajar con los
ADRs de CertReady (Cognito, Go en ECS, RDS/Mongo, S3). No se introdujo nada de
Appwrite. Decisión del usuario: ignorar y seguir el plan.

**Hecho:**
- `.github/workflows/ci.yml`: pipeline esqueleto con matriz por servicio.
  - `lint-test`: gofmt (falla si hay archivos sin formatear), `go vet`,
    `golangci-lint` (v1.61), `go test -race -cover`. El `-race` corre aquí porque
    el runner Linux tiene cgo (lo que faltaba en Windows local).
  - `docker-build`: build de la imagen con Buildx + caché de GHA, sin push.
  - `concurrency` para cancelar runs solapados.
- `.golangci.yml`: conjunto conservador (errcheck, govet, ineffassign,
  staticcheck, unused, gofmt, misspell, revive).

**Decisiones:**
- **Despliegue como stub comentado**, no job activo: el push a ECR y el deploy a
  ECS dependen de la infraestructura (bloque 4). Se documentan los pasos y el
  modelo OIDC (sin llaves estáticas) para activarlos sin rediseñar el pipeline.

**Verificación:**
- Ambos YAML parsean (`yaml.safe_load`). La ejecución real del workflow queda
  pendiente del primer push a un remoto GitHub (aún no hay `origin`).

**Siguiente:**
- Bloque 4: esqueleto Terraform en `infra/` (network, ecr, ecs, iam, secrets).
  Al crear ECR + rol OIDC + servicio ECS, se activa el job `deploy-dev` del stub.

---

## 2026-06-03 · Fase 0 — Fundaciones · bloque 4 (Terraform)

**Hecho:**
- `infra/` completo: 5 módulos + entorno `dev` + stubs de `staging`/`prod`.
  - `modules/network`: VPC 10.0.0.0/16, 2 AZs, subredes pública/app/data, IGW,
    NAT GW configurable (1 en dev, N en prod), route tables.
  - `modules/ecr`: repositorios ECR por servicio, `IMMUTABLE` tagging, escaneo
    en push, lifecycle policy (últimas N con tag, borrado de untagged en 24h).
  - `modules/iam`: execution role + task role ECS, proveedor OIDC GitHub Actions,
    rol de deploy con mínimo privilegio (ECR push + ECS update + iam:PassRole).
  - `modules/secrets`: placeholders de Secrets Manager (valor nunca en código).
  - `modules/ecs`: cluster Fargate con Container Insights, log groups CloudWatch,
    security groups por tarea, task definitions con health check hacia /v1/health,
    ECS services (ignore_changes en desired_count para no pisar autoscaling).
  - `environments/dev/main.tf`: composición de módulos (single_nat_gw=true,
    cpu=256/mem=512, desired_count=1, log_retention=7d).
- 20 archivos `.tf` con sintaxis HCL verificada (heurística, falso positivo aclarado).

**Decisiones:**
- **Un módulo por responsabilidad**: network, ecr, iam, secrets, ecs. Los
  entornos solo componen, no definen recursos directamente.
- **ALB no incluido en Fase 0**: el servicio `health` es de validación; el ALB
  + listener rules se añaden en Fase 1 con los servicios de negocio reales.
- **OIDC sin llaves estáticas**: el rol GitHub deploys asume via WebIdentity;
  no hay `AWS_ACCESS_KEY_ID` en ningún Secret del repo.

**Verificación:**
- Sintaxis `.tf` revisada manualmente y con heurística PowerShell: OK.
- `terraform validate` y `terraform apply` **pendientes** (Terraform no instalado).
  Instalar con: `winget install --id HashiCorp.Terraform -e`.

**Siguiente:**
- Instalar Terraform → `terraform validate` en `environments/dev/`.
- Crear repo en GitHub → primer push → verificar que el workflow CI pasa.
- Con cuenta AWS: `terraform apply` en dev y activar el job `deploy-dev` del stub.
- Al cumplirse esos tres puntos: **DoD de Fase 0 cerrado → Fase 1**.

---

## 2026-06-03 · Fase 0 — Fundaciones · verificación Terraform

**Hecho:**
- Instalado **Terraform v1.15.5** (winget `Hashicorp.Terraform`; ojo: la 'c' es
  minúscula, `HashiCorp.Terraform` no existe en el repo de winget).

**Verificación:**
- `terraform fmt -recursive` ✓ (reformateó 6 archivos: alineación de `=`).
- `terraform init -backend=false` ✓ — resolvió e instaló provider `hashicorp/aws`
  v5.100.0; generó `.terraform.lock.hcl` (ahora versionado).
- `terraform validate` ✓ — **Success! The configuration is valid.** tras corregir 1 bug.

**Bug encontrado y corregido por `validate`:**
- Las descripciones de reglas de Security Group de AWS solo admiten ASCII
  (regex `^[0-9A-Za-z_ .:/()#,@\[\]+=&;{}!$*-]*$`). Tres descripciones tenían
  acentos (`tráfico`, `vía`). Pasadas a ASCII en `modules/ecs/main.tf`. (Los
  comentarios de código sí pueden llevar acentos; solo los strings que ve AWS no.)

**Decisión:**
- **`.terraform.lock.hcl` se versiona** (lo recomienda el propio `init`): fija las
  versiones de provider de forma reproducible entre máquinas y CI. Se ajustó el
  `.gitignore` (antes lo excluía) y el patrón de tfvars a `!*.tfvars.example`.

**Siguiente:**
- Crear repo GitHub → push → CI verde (el workflow corre `-race` y `docker build`).
- Con cuenta AWS: `terraform apply` en dev y activar `deploy-dev` → cierre del DoD.

---

## 2026-06-03 · Fase 0 — Fundaciones · decisión: diferir despliegue AWS

**Decisión (responsable):** no tocar AWS por ahora. La Fase 0 queda como
**"construcción local completa y verificada; despliegue diferido"**.

**Estado:**
- Verificado en local: servicio Go (tests + smoke), CI (YAML válido, lógica lista),
  Terraform (`fmt` + `validate` OK con provider real).
- Parqueado (⏸️ en el checklist): `terraform apply`, push a GitHub, deploy a dev,
  CloudWatch. Todos dependen de cuenta AWS / remoto GitHub.
- Pasos para retomar el despliegue documentados en `docs/fase-0-checklist.md`.

**Implicación:** el trabajo de aplicación puede avanzar a Fase 1 sin bloqueo; el
despliegue se ejecuta cuando se decida, sin re-trabajo (código ya validado).

**Siguiente:** a definir con el responsable — Fase 1 (Identidad y catálogo:
Cognito + usuarios Go/Postgres + catálogo) requiere planificación previa.

---

## 2026-06-03 · Fase 0 — Re-arquitectura a costo cero (ADR-07)

**Contexto:** restricción del responsable — desplegar en AWS **sin gastar dinero**
(solo Free Tier, sin créditos). El diseño Fargate+NAT (~$45/mes) no es viable a $0.
Decisión (vía preguntas): **solo Free Tier** + **cómputo en AWS Lambda** (capa
"always free": 1M req + 400k GB-s/mes, no solo 12 meses).

**Hecho:**
- **ADR-07** añadido al doc de arquitectura (enmienda contextual a ADR-05).
- **Servicio Go — doble entrypoint sobre el mismo router:**
  - `internal/logging`: logger extraído a paquete compartido.
  - `cmd/lambda/main.go`: nuevo entrypoint; envuelve `httpapi.NewRouter` con
    `aws-lambda-go-api-proxy/httpadapter` (payload v2 de Function URL).
  - `cmd/server` intacto (local + ruta Fargate). Dominio agnóstico al destino.
  - Deps nuevas (justificadas por Lambda): `aws-lambda-go` v1.54.0,
    `aws-lambda-go-api-proxy` v0.16.2. Resto del servicio sigue siendo stdlib.
- **Terraform — ruta de costo cero:**
  - `modules/lambda`: función `provided.al2023` arm64, Function URL pública,
    rol de ejecución mínimo (solo logs), log group con retención. Sin VPC → sin NAT.
  - `modules/cicd`: OIDC + rol de deploy con permiso solo `lambda:UpdateFunctionCode`
    sobre la función del proyecto.
  - `environments/dev`: reescrito para instanciar solo `lambda` + `cicd`.
  - Módulos `network/ecr/ecs/iam/secrets` **PARQUEADOS** (validados, no instanciados).
- **CI:** job `docker-build` → `build-lambda` (compila bootstrap + zip + artefacto);
  stub de deploy actualizado a `aws lambda update-function-code`.
- **Makefile:** targets `build-lambda` y `package-lambda`.

**Verificación:**
- `gofmt` ✓ · `go vet` ✓ · `go build ./...` ✓ · `go test ./...` ✓.
- Cross-compile `bootstrap` linux/arm64 ✓ (~7.8 MB).
- `terraform fmt` ✓ · `terraform validate` (dev con lambda+cicd) → **Success** ✓.

**Costo resultante:** dev = **$0** (Lambda + Function URL + CloudWatch Logs dentro
de la capa gratuita permanente; sin NAT, sin Fargate, sin ALB).

**Riesgo registrado (ADR-07):** Fase 1+ introduce RDS/Mongo. Una Lambda en VPC
para acceder a RDS reintroduce costo (NAT o VPC endpoints). Reevaluar al llegar
la capa de datos (presupuesto, RDS con SG restringido, o EC2 free-tier).

**Siguiente:** desplegar sigue diferido (sin cuenta AWS activa). Cuando se decida:
`make package-lambda` → `terraform apply` en dev → activar `deploy-dev`. Todo $0.

---

## 2026-06-03 · Fase 1 — Identidad y catálogo · diseño (sin implementar)

**Contexto/decisiones (vía preguntas):**
- Postgres: **local en dev + Neon en deploy** (Postgres serverless gratis, TLS
  público → mantiene Lambda fuera de VPC, $0). Registrado como **ADR-08**.
- Alcance de este turno: **solo plan detallado** (no se escribe código).

**Hecho:**
- **ADR-08** añadido al doc de arquitectura (Neon como Postgres de costo cero).
- **`docs/fase-1-diseno.md`**: diseño detallado para revisión —
  - Fronteras de servicios: `catalog` (certificaciones, temas, pistas,
    inscripciones) y `users` (usuarios, perfiles). Refs entre servicios = lógicas.
  - Topología BD $0: 1 Postgres, esquema por servicio (`catalog`, `users`).
  - DDL del esquema `catalog` + contratos REST `/v1` (envolturas, paginación,
    endpoints de lectura/admin/inscripción) con reglas anti-SQLi/IDOR.
  - Modelo auth: JWT/OIDC agnóstico del emisor (Cognito en prod, parqueado;
    emisor local en dev). RBAC estudiante/admin.
  - Stack Go: pgx/v5 + golang-migrate + `go.work` + librería `libs/platform`
    compartida (logging, middleware, salud, pool). Doble entrypoint server/lambda.
  - Plan de 3 incrementos. Empezar por Inc. 1 (datos + catalog).

**Entorno verificado para la fase:** Node v24 + npm 11 (Next.js OK), Go 1.26,
Terraform 1.15.5. Postgres NO instalado (winget: `PostgreSQL.PostgreSQL.17`).
Sin Docker ni gh.

**Verificación:** N/A (diseño). Pendiente de revisión del responsable.

**Siguiente:** al aprobar el diseño → Incremento 1 (instalar Postgres local,
`go.work` + `libs/platform` + `services/catalog` con migraciones y tests).

---

## 2026-06-03 · Fase 1 — Revisión del diseño · separar inscripciones (ADR-09)

**Decisión del responsable:** "separa las inscripciones mejor y ok".
- Las **inscripciones se mueven a un servicio propio `enrollments`** (esquema
  `enrollments`), en vez de vivir en `catalog`. `catalog` = contenido puro;
  `users` = identidad pura; `enrollments` = vínculo, referencia lógica a ambos.
  Registrado como **ADR-09** (refinamiento de la §10).
- Resto del diseño **aprobado**, incluido dejar `services/health` intacto y que
  `catalog` use la futura `libs/platform`.

**Hecho:** actualizado `docs/fase-1-diseno.md` (fronteras, DDL, contratos,
incrementos) y añadido ADR-09. Inc. 1 ahora = `catalog` SIN inscripciones;
`enrollments` se construye en Inc. 2 junto con auth (que es donde se necesita).

**Siguiente (aprobado):** construir **Incremento 1** — instalar Postgres local,
`go.work` + `libs/platform` + `services/catalog` (esquema, migraciones, lecturas,
create admin tras gate) + tests.

---

## 2026-06-03 · Fase 1 — Incremento 1 (servicio catalog) · construido

**Nota:** PostgreSQL ya estaba instalado en la máquina (`C:\Program Files\PostgreSQL\17`,
servicio `postgresql-x64-17`). Se borró la caché de descarga de winget (~357 MB).

**Hecho:**
- **`go.work`** (workspace multi-módulo) a go 1.25 (pgx arrastra deps que lo exigen;
  `health` se queda en go 1.23, admitido por ser menor).
- **`libs/platform`** (módulo compartido): `config` (helpers de entorno),
  `logging`, `httpx` (middleware request-id/access-log/recover, sondas de salud,
  helpers JSON con límite de cuerpo y rechazo de campos desconocidos), `postgres`
  (pool pgx). `services/health` se dejó intacto (deuda menor anotada).
- **`services/catalog`** (Go + Postgres):
  - Migraciones embebidas (`embed.FS`) + runner propio idempotente (sin
    golang-migrate; protocolo simple para multi-sentencia, transacción por versión).
  - Esquema `catalog`: certificaciones, temas, pistas_entrevista (gen_random_uuid
    nativo de PG13+, sin pgcrypto).
  - Repositorio pgx con **queries 100% parametrizadas** (anti-SQLi); UUID
    proyectado a texto para mapeo robusto. ErrNotFound/ErrConflict.
  - HTTP: lecturas `/v1/certifications|topics|tracks`, create admin **gated 501**
    (sin auth aún). Interfaz `CatalogStore` → handlers testeables sin DB.
  - Entrypoints `cmd/server`, `cmd/lambda`, `cmd/migrate`.
- Tests: `httpx` (salud), `httpapi` (handlers con doble en memoria, sin DB),
  `store` (integración, se salta sin `CATALOG_TEST_DATABASE_URL`).

**Verificación — Incremento 1 CERRADO (contra Postgres 17 real):**
- Postgres local acepta auth `trust` (sin contraseña). Se crearon las bases
  `certready_dev` y `certready_test`.
- `gofmt` ✓ · `go vet` ✓ (libs + catalog) · `go build` ✓.
- `cmd/migrate` ✓ — aplicó el esquema `catalog` (4 tablas) en `certready_dev`.
- Tests de integración del `store` ✓ (5/5 contra `certready_test`): migración
  idempotente, create/get por id y por slug, not-found, conflicto de unicidad,
  filtro por proveedor. Tests `httpx` y `httpapi` ✓.
- Prueba de humo del servidor real (`certready_dev` sembrada): `/v1/ready`
  → 200 con `postgres:ok`; lecturas de certifications/topics/tracks → 200;
  POST gated → 501; no-existe → 404.

**Pendiente (diferido, no bloquea):**
- Wiring de CI (bump go 1.25, matriz por módulo, servicio Postgres) y Terraform
  (2ª Lambda `catalog`). El deploy sigue diferido; CI aún en go 1.23.

**Siguiente:** Incremento 2 — `libs/platform/auth` (JWT/OIDC), `services/users`,
`services/enrollments`, y conectar la autorización admin de `catalog`.

---

## 2026-06-03 · Fase 1 — Incremento 2a (auth JWT/OIDC) · construido y verificado

**Hecho:** `libs/platform/auth` — validación de tokens OIDC agnóstica del emisor.
- `auth.go`: `Authenticator` sobre `coreos/go-oidc/v3`. `New` (discovery por issuer,
  ruta Cognito/prod) y `NewWithKeySet` (KeySet directo, tests). `Verify` valida
  firma RS256, `iss`, `aud`, `exp`; extrae `Identity{Subject, Email, Roles}`
  (roles de `cognito:groups` + claim `role`).
- `middleware.go`: `Middleware` (Bearer → 401 si falta/ inválido), `RequireRole`
  (401 sin identidad, 403 sin rol), `IdentityFromContext`.
- `authtest/`: emisor de tokens RS256 de prueba (clave RSA efímera + `StaticKeySet`)
  para que los servicios prueben rutas protegidas sin IdP real.
- Deps nuevas (justificadas por auth): `coreos/go-oidc/v3`, `golang-jwt/jwt/v5`,
  `go-jose/v4`, `x/oauth2`.

**Verificación:** `gofmt` ✓ · `go vet` ✓ · `go test ./auth/...` ✓ —
token válido (sub/email/rol), rechazo de expirado, audiencia incorrecta, token
basura y firma de otra clave; cadena Middleware+RequireRole (401/403/200).

**Bug encontrado y corregido:** el helper de tokens trataba `Expira <= 0` como
"sin valor" (default 1h), anulando los `-1h` para probar expiración. Corregido a
`== 0` → un valor negativo ya produce un token vencido. (Lo destapó el test, no la
lectura.)

**Siguiente:** 2b — `services/users` (usuarios/perfiles, provisión JIT, `/v1/me`)
y conectar el gate admin real de `catalog`; luego 2c (`enrollments`), 2d (Cognito TF).

---

## 2026-06-03 · Fase 1 — Incremento 2b (servicio users + gate admin catalog) · construido y verificado

**Hecho:**
- **`libs/platform/pgmigrate`**: runner de migraciones extraído (parametrizado por
  esquema, identificador citado). `catalog` refactorizado para usarlo; `users` lo usa.
- **`auth.Identity`**: añadido claim `name` (para la provisión del nombre).
- **`services/users`** (Go + Postgres, esquema `users`):
  - `usuarios` (id = sub del JWT) + `perfiles` (1:1).
  - Store: `ObtenerOProvisionar` (upsert JIT que sincroniza email/rol y garantiza
    perfil), `ActualizarCuenta` (tx; campos nil no borran), `ListarUsuarios`.
  - HTTP: `GET/PATCH /v1/me` (auth; identidad SIEMPRE del `sub` → anti-IDOR),
    `GET /v1/users` (admin). Gates 501 si no hay OIDC. Interfaz `UserStore`.
  - Entrypoints server/lambda/migrate.
- **`catalog`**: gate admin real — `POST /v1/certifications` ahora exige JWT + rol
  `admin` (vía `auth.Middleware`+`RequireRole`) cuando hay OIDC; 501 si no.

**Verificación (Postgres real + tokens de prueba):**
- `gofmt` ✓ · `go vet` ✓ · `go build` ✓ (libs, catalog, users).
- `go test` ✓ — libs (auth/httpx), catalog (handlers incl. gate admin 401/403/201
  con authtest, store integración), users (handlers: provisión JIT, 401, RBAC
  admin 401/403/200, gate 501; store integración: upsert idempotente+sync,
  actualización con nil-no-borra).
- `cmd/migrate` aplicó el esquema `users` en `certready_dev`.
- Smoke test del binario `users`: boot OK, `ready` con `postgres:ok`, `/v1/me`
  sin OIDC → 501.

**Nota de verificación:** el flujo end-to-end con tokens **reales de Cognito**
(discovery OIDC + DB + HTTP juntos) queda para cuando se provisione Cognito
(2d/diferido). El código de validación es el mismo que prueban los handlers con
`authtest` (solo cambia la fuente del JWKS).

**Siguiente:** 2c — `services/enrollments` (inscripciones, anti-IDOR, valida
objetivo contra `catalog`); luego 2d (módulo Terraform `cognito`, parqueado).

---

## 2026-06-03 · Fase 1 — Incremento 2c (servicio enrollments) · construido y verificado

**Hecho:**
- **`services/enrollments`** (Go + Postgres, esquema `enrollments`):
  - DDL: `inscripciones` con `tipo_objetivo` (`certificacion`|`pista`), `objetivo_id`
    (ref lógica a `catalog`, sin FK por ADR-09), `estado` con check, unique
    `(usuario_id, tipo_objetivo, objetivo_id)`.
  - Dominio: tipos `TipoObjetivo`/`Estado`, validación de UUID y de cambio de estado.
  - **`catalogclient`**: cliente HTTP mínimo al servicio catalog (200→true, 404→false,
    5xx/red→`ErrCatalogoNoDisponible`, otros→error). Interfaz para mock.
  - Store: `Crear` (ErrConflict en 23505), `ListarDeUsuario` (filtro estado/limit/offset),
    `CambiarEstadoDeUsuario`/`EliminarDeUsuario` (WHERE por `id` AND `usuario_id` →
    pertenencia integrada; ErrNotFound indistinto para ajeno/inexistente — BOLA).
  - HTTP: `POST /v1/enrollments`, `GET /v1/me/enrollments`, `PATCH|DELETE /v1/enrollments/{id}`.
    `usuario_id` SIEMPRE del `sub` del token; `DisallowUnknownFields` rechaza intentos
    de inyectar usuario_id en el body. Validación de objetivo contra catalog antes
    de insertar; 422 si no existe, 503 si catalog cae.
  - Entrypoints server/lambda/migrate (migrate setea placeholder de `CATALOG_URL`
    para no exigirla en tareas que no llaman a catalog).

- **`libs/platform/auth/authtest`**: `Signer.PublicKey()` expuesto para tests que
  necesitan servir un JWKS HTTP propio (e2e con discovery OIDC real).

**Verificación (real, contra Postgres + e2e con OIDC mock real):**
- `gofmt` ✓ · `go vet` ✓ · `go build` ✓ en libs + 4 servicios.
- Tests por módulo todos en verde: libs/platform, catalog, users, enrollments, health.
- Tests de `enrollments`:
  - **catalogclient** (servidor mock): 200→exists, 404→missing, 500→ErrNoDisponible, 403→error inesperado.
  - **handlers** (doble store + doble catalog): tabla de 7 casos en POST (sin token,
    validación, objetivo no existe, catalog caído, duplicada, ok); listar usa sub
    del token; PATCH/DELETE propio→200/204, ajeno→404 (BOLA); rutas protegidas sin
    OIDC → 501; `usuario_id` en body → 400 (DisallowUnknownFields).
  - **store integración** (Postgres real, `certready_test`): crear+listar, duplicada
    conflict, lista filtra por usuario, cambiar/eliminar solo el propietario (BOLA).
  - **e2e** (`TestEnd2End_FlujoCompleto`): emisor OIDC mock con discovery+JWKS HTTP
    reales, cliente OIDC real (`auth.New`), cliente HTTP real de catalog, store en
    memoria. Cubre el flujo completo end-to-end (crear/duplicar/listar/borrar) +
    aud incorrecta → 401. Si pasa, prod funciona cambiando solo emisor y URL.
- `cmd/migrate` aplicó el esquema `enrollments` en `certready_dev`; smoke test del
  binario (ready postgres:ok, POST sin OIDC → 501).

**Bugs encontrados y corregidos por los tests (no por leer):**
- `esViolacionUnicidad(nil)` desreferenciaba nil → guard contra `err == nil`.
- Test mío con método incorrecto (GET en ruta POST → 405) → corregido a usar los
  métodos reales registrados.

**Siguiente:** 2d — módulo Terraform `cognito` (parqueado). Cierra el Incremento 2
y la Fase 1 en su parte backend; queda el Incremento 3 (web Next.js).

---

## 2026-06-03 · Fase 1 — Incremento 2d (módulo Terraform cognito) · construido y validado

**Hecho:** `infra/modules/cognito/` (PARQUEADO, no instanciado por ningún entorno):
- **User Pool**: email como username, verificación por enlace (mejor en SPA),
  password policy razonable (min 8, mayús/minús/dígitos, sin símbolos), MFA OFF
  por defecto (variable; activable a OPTIONAL/ON en prod), atributo `name`
  estándar OIDC (alimenta `Identity.Nombre` de Inc.2b).
- **Grupos RBAC**: `admin` (precedence 1) y `estudiante` (10) — viajan como
  `cognito:groups` en el JWT y los lee `libs/platform/auth` (`Identity.Roles`).
- **App Client público (SPA/móvil)**: sin secret, Authorization Code + PKCE
  (recomendado por OAuth 2.1), scopes `openid email profile`, USER_SRP_AUTH +
  REFRESH_TOKEN_AUTH, `prevent_user_existence_errors=ENABLED` (anti-enumeración),
  callback/logout URLs configurables, vidas de token parametrizables.
- **Hosted UI** vía `aws_cognito_user_pool_domain` (sufijo amazoncognito.com
  gratuito; dominio propio con ACM queda para producción).
- **Outputs**: `issuer_url` (→ `OIDC_ISSUER`), `client_id` (→ `OIDC_AUDIENCE`,
  porque en Cognito el `aud` del ID token es el client id), `jwks_uri` (debug),
  `hosted_ui_domain` y `hosted_ui_login_url` listos para el front.
- `versions.tf` del módulo (provider aws ~> 5.0) → permite validarlo en aislamiento.

**Verificación:**
- `terraform fmt -check -recursive` ✓ (todo el repo IaC).
- `terraform init -backend=false && terraform validate` **en el módulo aislado**
  → Success! ✓
- `terraform validate` del **entorno dev** → Success! ✓ (no se rompió al añadir el
  módulo parqueado; sigue sin instanciarse).

**Decisión registrada:** el aud-del-token de Cognito es el client id, así que el
**`OIDC_AUDIENCE`** de los servicios debe inyectarse con el **output `client_id`**.
Documentado en el output mismo y en este registro.

**Cierre Fase 1 backend:** Inc.1 (catalog) + Inc.2a (auth) + Inc.2b (users + gate
admin) + Inc.2c (enrollments + e2e con OIDC real) + Inc.2d (cognito IaC parqueado).
El despliegue del cognito real queda diferido junto con el resto (sin cuenta AWS);
todo el código backend está listo para activarse.

**Siguiente:** Incremento 3 — web Next.js (login con OIDC contra Cognito, elegir
certificaciones, panel del estudiante). Único cliente pendiente del MVP de Fase 1.

---

## 2026-06-03 · Fase 1 — Incremento 3a (esqueleto web BFF + emisor OIDC mock) · construido y verificado

**Decisiones (vía preguntas):** patrón **BFF** (Next intermediario, tokens no
llegan al cliente), **Tailwind** como estilo, solo **3a** este turno.

**Hecho:**
- **`tools/oidc-mock`** (Go, en `go.work`): emisor OIDC mínimo para desarrollo
  local. Discovery + JWKS + `/authorize` (auto-aprueba con email/groups/sub por
  query) + `/token` (Authorization Code + PKCE S256/plain) + `/userinfo`. RSA
  generada al arranque; `sub` derivado determinísticamente del email para no
  romper los upserts JIT de `users`. Permite probar la web sin Cognito.
- **`web/`** — esqueleto Next.js 15 + TS estricto (`strict`,
  `noUncheckedIndexedAccess`, `noImplicitOverride`; `exactOptionalPropertyTypes`
  bajado por pelearse con fetch/iron-session — registrado en decisión):
  - **`lib/env.ts`** valida el entorno con zod; falla al arrancar si faltan/
    inválidas variables (mejor que fallo silencioso en runtime).
  - **`lib/auth/session.ts`** sesión cifrada con `iron-session` (cookie HttpOnly,
    SameSite=Lax, Secure en prod). El navegador NUNCA ve el token.
  - **`lib/auth/oidc.ts`** wrapper de `openid-client` v6 (PKCE, state, nonce,
    discovery memoizado). `exchangeCallback` extrae sub/email/name/groups del
    id_token y devuelve la identidad + tokens.
  - **`lib/api/{client,types}.ts`** cliente HTTP server-side tipado (timeout,
    ApiError con status+body, Bearer inyectado) y DTOs espejo de los modelos Go.
  - Rutas BFF: `GET /api/auth/login`, `GET /api/auth/callback`, `POST /api/auth/logout`,
    y proxy ejemplar `GET /api/me` → users (patrón canónico para catalog y
    enrollments en 3c/3d).
  - Tailwind + landing minimal con link a login.
- Tooling: ESLint (next/core-web-vitals + next/typescript), Prettier, Vitest.

**Verificación (BFF + mock):**
- Mock OIDC: smoke test real → `/healthz` ok, discovery con todos los endpoints
  estándar, `/authorize` → 302 con `?code=...&state=xyz` correctos.
- Web: `npm run check` (typecheck + lint + prettier + tests) → **exit 0**;
  **9/9 tests** verdes (cliente HTTP: ok/204/error/Bearer/JSON serialization;
  env: válido/URL inválida/SESSION_PASSWORD corto).
- **`next build` → exit 0**: 4 rutas dinámicas server-side + 1 estática (home),
  `output: standalone` listo para deploy en cualquier runtime Node.

**Decisión registrada:** `exactOptionalPropertyTypes: true` se desactiva. No es
default de `strict` por algo: pelea con la API estándar `fetch` (`body: string |
undefined`) y con el tipo de cookies de Next 15 vs iron-session. Conservamos el
resto de strict que sí da valor.

**Pendientes (3b–3d, cuando se decida):**
- 3b: vistas de login y callback (UI).
- 3c: vista catálogo (listar + inscribirse) usando proxies catalog y enrollments.
- 3d: panel del estudiante (`/api/me` + sus inscripciones).

**Smoke test end-to-end del flow login** (mock + web) queda pendiente porque
implica levantar 4 procesos coordinados (mock, catalog, users, enrollments + web)
y, sobre todo, las UI de 3b. Se hará en 3b cuando exista la vista de login.

**Siguiente:** 3b (UI de login/callback) — primera oportunidad de probar el flow
OIDC end-to-end con todo levantado.

---

## 2026-06-03 · Documentación y preparación para GitHub

**Contexto:** se incorporan más desarrolladores. Se prioriza dejar el proyecto
documentado para onboarding y listo para subir a un repositorio remoto.

**Hecho:**
- **`README.md`** reescrito a nivel profesional: descripción del producto,
  arquitectura (rutas de costo cero y de producción), stack, estructura, tabla de
  servicios, puesta en marcha, pruebas, despliegue, estado e índice de documentación.
- **`CONTRIBUTING.md`** (nuevo): principios de arquitectura, flujo de trabajo por
  fases, convenciones por lenguaje (Go, TypeScript, Python, SQL), commits
  convencionales, estructura de un servicio, seguridad y estilo de documentación
  del código. Absorbe las convenciones que vivían en configuración local.
- **`docs/desarrollo-local.md`** (nuevo): guía paso a paso para levantar el
  entorno completo (base de datos, emisor OIDC local, servicios, web), tabla de
  puertos y pruebas.
- **`docs/estado-roadmap.md`** (nuevo): qué está hecho, en curso y planeado,
  orientado a quien se incorpora.
- **`.github/pull_request_template.md`** (nuevo): plantilla de PR con checklist de
  verificación.

**Preparación para GitHub:**
- `.gitignore` actualizado para excluir la configuración local de herramientas de
  asistencia (no se versiona). Su contenido de valor (convenciones) quedó migrado
  a `CONTRIBUTING.md`.
- Referencias a configuración local depuradas de la documentación versionada.
- Los commits los realiza el responsable del repositorio con su propia identidad.

**Siguiente:** crear el repositorio remoto y subir; luego continuar con el
incremento 3b (vistas de la web).

---

## 2026-06-06 · Fase 1 — Incrementos 3b/3c/3d (vistas web) · construido y verificado en vivo

**Hecho:** se completaron las vistas de la web (patrón BFF) y con ello el
criterio de salida de la Fase 1.
- **Capa de servicios y guard:** `lib/api/services.ts` (llamadas tipadas a
  catalog/users/enrollments) y `lib/auth/guard.ts` (`requireSession`, redirige a
  login si no hay sesión).
- **Rutas BFF de mutación:** `POST /api/enrollments` y `DELETE /api/enrollments/{id}`
  (el `usuario_id` lo pone el backend desde el token; el navegador nunca lo envía).
- **3b — Login/callback:** landing según sesión, `/auth/error`, y el callback
  redirige a esa página ante fallo (en vez de devolver JSON).
- **3c — Catálogo:** `/certifications` lista certificaciones y permite inscribirse;
  marca "Inscrito" lo ya inscrito (componente cliente `EnrollButton`).
- **3d — Panel:** `/panel` muestra la cuenta y las inscripciones, con baja
  (`UnenrollButton`). Layout protegido con barra de navegación y logout.

**Verificación (estática):** `npm run check` (typecheck + lint + formato + 9
tests) y `next build` → ambos en verde (11 rutas).

**Verificación EN VIVO (stack completo: web + emisor OIDC mock + catalog + users
+ enrollments + PostgreSQL):**
- Flujo de login real `/api/auth/login` → mock → callback → `/panel` (200), con
  el usuario provisionado (JIT) y su panel renderizado.
- `POST /api/enrollments` → 201 (BFF → enrollments → validación del objetivo
  contra catalog → alta).
- `/certifications` refleja "Inscrito" tras la inscripción.

**Bugs encontrados por la prueba en vivo (no por build/tests) y corregidos:**
- El emisor OIDC de desarrollo no reflejaba el claim `nonce`; `openid-client` lo
  valida. Se añadió el `nonce` al token del mock.
- `openid-client` v6 exige HTTPS por defecto; el emisor de desarrollo es
  `http://localhost`. Se permite HTTP **solo** cuando el issuer es http (nunca en
  producción, donde el emisor es Cognito sobre https).
- Nota operativa: `users` y `enrollments` hacen *discovery* OIDC al arrancar, así
  que el emisor debe estar listo antes que ellos (orden de arranque en local).

**Estado:** Fase 1 completa (identidad y catálogo, backend + web). El despliegue
en AWS sigue diferido; todo verificado en local.

**Siguiente:** Fase 2 — Contenido y exámenes (MongoDB, servicio de contenido,
servicio de exámenes con simulacros y scoring).

---

## 2026-06-06 · Fase 2 — Backend (content + exams) · construido y verificado

**Decisiones (vía preguntas):** MongoDB local + **Atlas M0** para deploy (ADR-10);
construir los dos servicios de backend en una tanda; el frontend se pospone.

**Hecho:**
- **`libs/platform/mongo`**: helper de conexión a MongoDB (driver oficial v2).
- **`services/content`** (Go + MongoDB): material de estudio. Lecturas públicas
  (`/v1/content`, filtros) y creación admin. Consultas con BSON parametrizado
  (defensa anti-NoSQLi).
- **`services/exams`** (Go + MongoDB + PostgreSQL):
  - Preguntas en Mongo (banco); `$sample` para muestrear simulacros.
  - Sesiones e intentos en Postgres (refs de preguntas en jsonb).
  - Flujo: `POST /v1/exams/sessions` (genera simulacro sin respuestas),
    `.../submit` (califica + registra intentos + cierra, en transacción),
    `GET .../{id}` (repaso con respuestas y explicaciones si finalizada),
    `GET /v1/me/exams`, `POST /v1/questions` (admin).
  - Scoring por conjuntos (orden-independiente); puntaje [0,100].
  - Anti-IDOR/BOLA: sesiones acotadas al `sub`; ajena/inexistente → 404.

**Verificación:**
- `gofmt` ✓ · `go vet` ✓ · `go build` ✓ en libs + ambos servicios.
- Tests: scoring (unitario), content store (Mongo: crear/obtener/conflict/filtro),
  exams store (preguntas Mongo: crear/porRefs/muestrear/dup; sesiones Postgres:
  crear/obtener/finalizar/roundtrip jsonb/re-finalizar/BOLA).
- **Prueba en vivo de exams** (servicio real + Mongo + Postgres + OIDC mock):
  admin crea preguntas (201); sin token → 401; crear simulacro → 201 **sin fuga
  de respuesta_correcta**; entregar → puntaje 50 (1/2); repaso → respuestas
  visibles; re-entregar → 409.
- CI actualizada: añade `content` y `exams` al recorrido y un servicio MongoDB
  (más Postgres) con las variables de test de integración.

**Estado:** backend de la Fase 2 completo. Falta el frontend de la fase (estudiar,
simulacro, repaso), pospuesto por decisión. Despliegue AWS diferido.

**Siguiente:** frontend de Fase 2 cuando se retome el front, o Fase 3 (entrevistas
+ juez de código).

---

## 2026-06-06 · Fase 3 — Entrevistas + juez de código · backend construido

**Decisiones (vía preguntas):** sandbox real con **Docker Desktop** (instalar y
construir el runner seguro ya); primer lenguaje **Python**; incluir **Q&A** por
puesto/área además de los problemas; ejecución **síncrona** (cola diferida);
frontend (editor) pospuesto. Formalizado en **ADR-11**.

**Hecho — Incremento 3a · `services/problems` (Go + MongoDB):**
- Banco de **problemas** tipo LeetCode (con casos de prueba, incluidos ocultos +
  límites) y banco de **Q&A** por puesto/área (autoestudio), en dos colecciones.
- Lecturas públicas con filtros y creación admin. BSON parametrizado (anti-NoSQLi).
- **Anti-fuga:** la lectura pública pasa por `VistaPublica`, que elimina los casos
  ocultos; nunca se expone su entrada/salida esperada.

**Hecho — Incremento 3b · `judge/` (juez de código):**
- Orquestador Go + **runner Docker endurecido** (Python): `--network none`,
  `--read-only` + tmpfs, código montado solo-lectura, límites de
  memoria/CPU/PIDs, usuario sin privilegios, `cap-drop ALL`, `no-new-privileges`,
  corte por `timeout` + backstop por context. Imagen en `judge/runners/python`.
- Interfaz `Runner` conectable (extensible a más lenguajes).
- Calificación contra casos del problema (leídos de Mongo, con ocultos);
  veredicto global + por caso; **anti-fuga** (casos ocultos sin entrada/salida).
- Corridas persistidas en Postgres (esquema `judge`); historial propio; BOLA.
- Endpoints: `POST /v1/judge/runs`, `GET /v1/judge/runs/{id}`, `GET /v1/me/judge/runs`.
- El juez se despliega en **Fargate** (no Lambda): es la excepción a ADR-07.

**Verificación (sin Docker):**
- `gofmt` ✓ · `go vet` ✓ · `go build` ✓ · barrido de los **10 módulos** en verde.
- `problems`: unit de `VistaPublica`/`Validar`, store Mongo (CRUD problemas + Q&A),
  y test de API (RBAC 401/403/201 + **anti-fuga** vía router real).
- `judge`: calificación con runner falso (veredicto + anti-fuga), store de corridas
  en Postgres (crear/obtener/listar + **BOLA**), y API (sin auth 501, sin token
  401, problema inexistente 404, lenguaje no permitido 422, **anti-fuga** vía HTTP,
  BOLA 404).
- **Prueba en vivo de `problems`** (servicio real + Mongo + OIDC mock): gate
  401/403/201; el detalle y el listado **no** exponen el caso oculto; Q&A OK.

**Verificación con Docker (tras instalar Docker Desktop):**
- Imagen del sandbox construida (`certready/judge-python`).
- **Suite de escape del sandbox** (`JUDGE_DOCKER_TESTS=1`) en verde: red
  bloqueada, `/etc` y `/sandbox` de solo lectura, fork-bomb contenida
  (`--pids-limit`), OOM contenido y bucle infinito → TLE.
- **E2E en vivo del juez** (oidc-mock + problems + judge + Mongo + Postgres +
  Docker): solución correcta → `accepted` (2/2, sin fuga); incorrecta →
  `wrong_answer` (sin fuga del caso oculto); bucle → `time_limit_exceeded`; sin
  token → 401; corrida ajena → 404 (BOLA); historial propio OK.
- **Hallazgo y ajuste:** con `timeout -s KILL`, en este Docker la salida al
  expirar era 137 (igual que un OOM), confundible con MLE. Se cambió a SIGTERM
  (salida 124 limpia para timeout) con SIGKILL de respaldo (`-k`), y el 137 se
  desambigua por duración. Tras el ajuste, la suite quedó completa en verde.
- **Segundo hallazgo (en CI):** en Docker nativo de Linux (a diferencia de Docker
  Desktop) los permisos del host se aplican dentro del contenedor; con la fuente
  en `0600` y el dir temporal en `0700`, el usuario sin privilegios (65534) no
  podía leer `/sandbox/solucion.py` (Errno 13). Se ajustó a dir `0755` / archivo
  `0644` (es código del usuario, sin secretos, en un dir efímero de solo lectura).
  Reproducido con un volumen Docker y corregido.
- CI: nuevo job `sandbox` que construye la imagen y corre la suite de escape.

**Estado:** **backend de la Fase 3 completo y verificado**, incluida la contención
del sandbox del juez (suite de escape + e2e en vivo). Frontend (editor de código)
pospuesto. Despliegue AWS diferido.

---

## 2026-06-07 · Fase 4 — Capa analítica (OLAP) · construida y verificada

**Decisiones (vía preguntas):** ClickHouse + Cube en **Docker local**, nube
diferida (ADR-12); alcance **ETL + ClickHouse + Cube** (dashboards web pospuestos);
hechos de **exámenes + código**. Capa de datos en Python (único lugar permitido).

**Hecho — Incremento 4a · ETL + esquema estrella (`data/`):**
- Modelo dimensional en ClickHouse, **estrella plana** (hecho denormaliza
  dimensiones como columnas): `fact_intento` y `fact_corrida` (`ReplacingMergeTree`).
- ETL en Python (`etl/`): `config` (12-factor), `schema.sql`, `sources`
  (Postgres parametrizado + enriquecimiento desde Mongo), `transform` (puro),
  `load` (clickhouse-connect + watermark), `run` (CLI). **Incremental por
  watermark** e **idempotente**. Solo drivers (clickhouse-connect, pymongo,
  psycopg), sin pandas. `docker-compose` del stack OLAP local.

**Hecho — Incremento 4b · capa semántica (Cube):**
- Cubos `intentos` y `corridas` sobre los hechos: medidas (`accuracy`,
  `tasa_aceptacion`, conteos, duración media) y dimensiones (certificación, tema,
  dificultad, tipo, modo / área, lenguaje, veredicto, tiempo). Expone API REST.

**Verificación:**
- `ruff` ✓ · `black --check` ✓ · `pytest` (unit de `transform`, puro) ✓.
- Integración contra ClickHouse real (gated `DATA_ETL_IT=1`): esquema, inserción,
  **accuracy**, idempotencia (ReplacingMergeTree) y roundtrip del watermark.
- **ETL en vivo de extremo a extremo** (Postgres con esquemas reales vía las
  migraciones de exams/judge + Mongo + ClickHouse): carga 2 intentos y 1 corrida;
  `accuracy` redes = 0.5; `tasa_aceptacion` python = 1.0; **idempotencia**
  confirmada (segunda pasada: 0 nuevos, sin duplicar).
- **Cube en vivo:** `accuracy` por tema y `tasa_aceptacion` por lenguaje vía la
  API de Cube **coinciden** con la consulta directa a ClickHouse.
- CI: nuevo job `data` (ruff + black + pytest). Nombres de jobs simplificados
  (`go`, `sandbox`, `data`, `web`).

**Hallazgos y ajustes (de ejecutar de verdad):**
- ClickHouse Docker deshabilita el acceso de red del usuario `default` sin
  credenciales → se crea un usuario propio en el compose.
- `clickhouse-connect` interpretaba `datetime` naive en hora local → corrimiento
  de 6 h. Se trabaja en **UTC** consciente de zona en todo el ETL.
- `DateTime` (segundos) truncaba el watermark por debajo del instante real y
  reprocesaba filas del mismo segundo → se usa **`DateTime64(6)`** (microsegundos).
- En ClickHouse las **pre-agregaciones** de Cube requieren Cube Store con índices
  → se difieren; el modelo semántico ya es funcional sin ellas (ADR-12).

**Estado:** **Fase 4 (backend OLAP) completa y verificada**. Pre-agregaciones,
orquestación y dashboards web diferidos. Despliegue AWS diferido.

**Siguiente:** Fase 5 (DSS / readiness) sobre los hechos, o retomar el frontend
(dashboards de las fases 1–4) con un pase de diseño.

---

## 2026-06-07 · Fase 5 — DSS (readiness + recomendaciones) · construida y verificada

**Decisión (vía pregunta):** modelo **IRT Rasch (1PL) calibrado por población**,
en **numpy puro** (sin scipy, por wheels de Python 3.14). Servicio **FastAPI** que
lee ClickHouse. Frontend (panel) diferido. Formalizado en **ADR-13**.

**Hecho — `data/dss/`:**
- `modelo` (puro, numpy): celda = `(certificación, tema, dificultad)`; dificultad
  `b = -logit(p_global)`; habilidad `theta` por **MAP** (Newton 1D) con prior
  `N(0,σ²)`; `readiness` = media ponderada de `sigmoid(theta-b)`; probabilidad de
  aprobar por aproximación normal vs umbral; siguiente acción = celda más débil.
- `repo` (ClickHouse, parametrizado), `config` (12-factor), `api` (FastAPI:
  `GET /v1/health`, `GET /v1/readiness/{usuario_id}?certificacion=...`). Conexión
  perezosa (no conecta al importar). Respuestas con Pydantic.
- Dependencias nuevas (instaladas en 3.14): numpy 2.4, fastapi 0.136, uvicorn 0.49.

**Verificación:**
- `ruff` ✓ · `black --check` ✓ · `pytest` unit del modelo (orden de theta,
  monotonía de readiness, rango de probabilidad, siguiente acción) ✓.
- Integración con ClickHouse real (gated, FastAPI `TestClient`): estudiante
  **fuerte** > **débil** en readiness y theta; campos en rango; usuario sin
  intentos → 404.
- **E2E en vivo** (uvicorn + ClickHouse sembrado): fuerte readiness 87 % /
  prob 0.99; débil 63 % / prob 0.16; sin intentos → 404.
- CI: el job `data` ya cubre `dss/` y `test_modelo` (la integración va gated).

**Estado:** **Fase 5 (DSS) completa y verificada**. Integración en el panel del
estudiante (frontend) diferida. Despliegue AWS diferido.

**Siguiente:** retomar el **frontend** (panel + dashboards + readiness de las
fases 1–5) con un pase de diseño, o **Fase 6 (móvil Flutter)** / **Fase 7
(endurecimiento, pentesting y producción)**.

---

## 2026-06-10 · Frontend — experiencia de estudio SAA-C03 (ruta + simulacro + progreso)

**Contexto:** se retomó el frontend para convertir la web en una experiencia de
preparación real para **AWS Solutions Architect Associate (SAA-C03)**: ruta de
aprendizaje tipo Duolingo, simulacro con el formato oficial y una vista de
progreso útil. Restricciones vigentes: **$0 / solo Free Tier**, **sin UUIDs
visibles** en la UI, y **contenido 100% original** (sin copiar documentación,
guías ni preguntas reales de examen — regla de marcas).

**Hecho — Estudiar como ruta de aprendizaje + servicio `progress`:**
- **`services/progress`** (nuevo servicio Go, espejo de `enrollments`: Postgres +
  OIDC, reusa `libs/platform`; puerto `:18093`, esquema `progress`). Tablas
  `progress.lecciones` y `progress.temas` (quiz por tema, aprobado = ≥70).
  Endpoints `POST /v1/progress/lessons`, `POST /v1/progress/quizzes`,
  `GET /v1/me/progress?certificacion=<slug>`, salud/ready.
- **`exams` — quiz por tema/sección:** `Muestrear` acepta `temas []string`
  (filtro `$in`); `CrearSesion` acepta `tema`, `temas` y `grupos`.
- **Web:** `/estudiar` (certificaciones inscritas por **nombre**, con progreso),
  `/estudiar/[cert]` (ruta de temas tipo camino con estados bloqueado/disponible/
  completado), `/estudiar/[cert]/[tema]` (lecciones + quiz que **desbloquea** el
  siguiente tema). Componente `learning-path.tsx`. **Clave canónica = slug**
  (`aws-saa`, `iam`), nunca UUID; el BFF resuelve el UUID de inscripción → nombre
  vía catalog. Se quitaron los UUIDs del Panel/Estudiar/Exámenes/Progreso.
- **Quiz aislado a pantalla completa** (`quiz-runner.tsx`): el material de estudio
  queda oculto mientras se responde (antes se veía la respuesta arriba).

**Hecho — Temario reorganizado a los 4 dominios oficiales SAA-C03:**
- **12 temas** agrupados por dominio con sus pesos oficiales: **Seguridad 30%,
  Resiliencia 26%, Rendimiento 24%, Costos 20%** (`Tema.dominio` + `orden`).
- Lecciones markdown **originales** enfocadas a lo que sí cae en el examen, con
  notas `> En el examen:`; seed (`seed-temas.sql` + `seed-mongo.py`) reescrito a
  slugs y con limpieza de huérfanos (idempotente).

**Hecho — Quiz por sección y simulacro con formato real:**
- **Quiz de repaso por sección (dominio)**: muestrea preguntas a través de los
  temas de un dominio.
- **Simulacro formato SAA-C03**: **65 preguntas**, aprobación **720/1000 ≈ 72%**,
  dos tipos de pregunta (**opción múltiple** y **respuesta múltiple** de varias
  correctas), y **desglose de desempeño por sección** al terminar. El historial de
  Exámenes muestra **solo simulacros** (los quizzes de estudio no se listan ahí).
- **Muestreo ponderado por dominio (30/26/24/20) y rotatorio**: `exams` muestrea
  por **grupos** (una cuota por dominio) con `$sample` (aleatorio); el BFF calcula
  el reparto (`gruposPonderados` → `createSimulacroPonderado`) y mezcla las
  preguntas. Banco ampliado a **100 preguntas** para que la rotación sea real
  (sobre todo en Costos y Resiliencia). Verificado: 65 preg → Seg 19 · Res 17 ·
  Rend 16 · Cost 13, y dos intentos seguidos comparten ~40/65 (rotan ~25).

**Hecho — Arreglo de la vista de Progreso (causa raíz):**
- **Síntoma reportado:** en `/progreso`, al elegir la certificación "no abría
  nada", y un simulacro entregado "no se mostraba".
- **Causa:** la página dependía 100% del servicio **DSS (ClickHouse + IRT)**, que
  `dev-up.ps1` **no levanta** en el stack local de free-tier. Con el DSS apagado,
  `getReadiness` devolvía `null` y la página mostraba siempre "sin datos", aunque
  el simulacro **sí estaba persistido** (confirmado en Postgres).
- **Fix:** se reescribió `/progreso` para mostrar el **avance real de los
  servicios que sí corren** — estudio (temas con quiz aprobado, vía `progress`) y
  simulacros (mejor/último puntaje, total, umbral 72%, vía `exams`), más el
  **avance por dominio**. La estimación IRT del DSS pasa a ser un **extra
  opcional**: solo se muestra si el servicio está disponible y ya no bloquea la
  página.
- **Limpieza de datos:** se borraron **10 sesiones "en curso"** de prueba (Dev
  User) que ensuciaban el historial; las finalizadas se conservaron.

**Decisiones:**
- **Slug como clave canónica** de contenido/exámenes/progreso (mata los UUIDs en
  la UI y desacopla del id de inscripción).
- **Progreso no debe depender del DSS**: el avance básico se calcula con servicios
  que corren a $0; el análisis IRT es un plus cuando el stack OLAP está encendido.
- **Pesos y rotación reales** en el simulacro para que practicar se parezca al
  examen y no repita siempre las mismas preguntas.

**Verificación:**
- Web: `npm run check` (typecheck + lint + formato + tests) y `npm run build`
  en verde tras cada cambio, incluido el fix de Progreso.
- `exams`/`progress`: `gofmt`/`go vet`/`go test` en verde; binarios reconstruidos.
- Ponderación y rotación del simulacro comprobadas vía API; aislamiento del quiz,
  ruta de Estudiar y desglose por sección verificados con el preview.
- Progreso: el fix se validó por typecheck/build y contra los datos reales en
  Postgres (simulacro finalizado presente); la verificación en navegador en vivo
  queda para cuando el stack backend esté levantado.

**Siguiente:** verificación en vivo de `/progreso` con el stack completo; opcional
limpiar la sesión finalizada antigua con UUID como certificación (data de prueba
pre-slug). Sigue pendiente el despliegue AWS (diferido) y Fase 6 (móvil) / Fase 7.

---

## 2026-06-10 · Landing — ilustraciones de marca en SVG (reemplazo de los vídeos 3D)

**Contexto:** los visuales del landing eran **6 vídeos 3D pre-renderizados**
(`hero` + 5 secciones, ~5 MB) que no convencían (look "3D genérico de IA"). Se
evaluó usar el conector de Canva ("Claude design"), pero genera **gráficos
estáticos**, no animación; no encaja para esto.

**Hecho:**
- **`components/illustrations.tsx`** (nuevo, server component): 6 escenas **SVG
  originales** dibujadas en código, con la paleta azul→morado y movimiento sutil
  (flotar, dibujar el trazo, barras que suben, destellos). Una por sección: ruta
  de aprendizaje + birrete (hero), diploma con sello (certificaciones), libro
  abierto (estudio), tarjeta de quiz con cronómetro (exámenes), editor de código
  con tests en verde (entrevistas) y panel con medidor 72% (progreso).
- **`globals.css`**: keyframes `il-float/il-pulse/il-rise/il-draw`, todas
  **desactivadas bajo `prefers-reduced-motion`**.
- **`app/page.tsx`**: usa `<Illustration name=…>` en hero y secciones.
- Se eliminaron `hero-media.tsx`, `feature-media.tsx` y los **18 archivos** de
  vídeo/imagen de `public/` (≈5 MB menos de assets).

**Decisión:** ilustraciones **en código** (SVG) en vez de vídeo o imágenes de
Canva — nítidas a cualquier tamaño, peso mínimo, temáticas a la marca,
accesibles, y sin logos oficiales (íconos genéricos: nube, escudo, `</>`,
birrete), conforme a la regla de marcas.

**Seguimiento (mismo día):** a petición del responsable (quiere diseñar él las
imágenes en claude.ai), se añadió **`components/landing-art.tsx`**: detecta un
archivo propio en `public/landing/<seccion>.{svg,webp,png,avif,jpg}` y, si existe,
lo usa en vez de la SVG (respaldo si falta). Guía de tamaños/nombres y prompts en
`web/public/landing/README.md`. El landing ahora usa `LandingArt` en lugar de
`Illustration`.

**Verificación:** `npm run check` + `npm run build` en verde. Las 6 ilustraciones
revisadas en vivo con el preview (build de producción): hero, certificaciones,
estudio, exámenes, entrevistas y progreso renderizan correctamente, sin errores de
consola. El landing no depende del backend (solo lee la sesión), así que se validó
de forma aislada.

---

## 2026-06-10 · Landing — escenas 3D (Three.js) hechas en claude.ai, integradas

**Contexto:** el responsable diseñó en **claude.ai** un landing 3D propio
(Three.js, misma estructura/copys que el actual) y lo dejó en una carpeta
`temporal/`. Pidió integrarlo. Supera el enfoque de imágenes del paso anterior.

**Hecho:**
- Dependencia **`three@0.160`** (+ `@types/three`); `tsconfig` con `allowJs`/
  `checkJs:false` para los módulos del diseño.
- **`components/landing3d/`**: `three-helpers.js` (clase `Scene3D` + materiales
  toon, helpers) y `scenes.js` (6 builders: medallón hero, certificaciones,
  estudio, exámenes, entrevistas, progreso) — el código del diseño, versionado tal
  cual (`.prettierignore` para no reformatearlo).
- **`components/landing-scene.tsx`** (cliente): monta cada escena en su sección;
  carga `three` de forma **diferida** (solo en el cliente, code-split), respeta
  `prefers-reduced-motion` (vía `Scene3D`) y **cae a la ilustración SVG**
  (`illustrations.tsx`) si no hay WebGL.
- **`app/page.tsx`**: usa `<LandingScene>` en hero (medallón) y las 5 secciones.
- Se retiró `landing-art.tsx` y `public/landing/` (mecanismo de imágenes,
  superado); `illustrations.tsx` se conserva como respaldo sin WebGL. La carpeta
  scratch `temporal/` quedó en `.gitignore` (el diseño ya vive en `web/`).

**Decisión:** integración Three.js real (no vídeo ni imágenes). `three` queda en
un chunk diferido, así que la página `/` no engorda su First Load (~110 kB) ni
afecta a otras rutas. SVG como degradación elegante.

**Verificación:** `npm run check` + `npm run build` en verde; `three` sale como
chunk aparte. En vivo (preview, build de producción): los **6 canvas** se montan,
WebGL disponible, **sin errores** de consola ni de servidor; las escenas en
viewport renderizan contenido 3D real de marca (las de abajo cargan al entrar en
pantalla, por el render perezoso de `Scene3D`). Nota: el screenshot del preview no
captura por la animación WebGL continua (limitación de la herramienta), no es un
fallo de la página.

---

## 2026-06-10 · Panel + shell tipo app (diseño de Claude Design)

**Contexto:** el responsable diseñó en **Claude Design** un nuevo panel post-login
(handoff `Panel CertReady.html`: sidebar tipo app + inscripciones con avance +
columna de gamificación moderada). Se importó el bundle y se implementó en Next.

**Hecho:**
- **`components/sidebar.tsx`** (cliente): navegación lateral tipo app con iconos 3D
  y etiquetas Fredoka en mayúsculas; item activo por ruta (`usePathname`), usuario
  al pie (avatar + email + Salir). Colapsa a solo-iconos en pantallas estrechas.
- **`app/(protected)/layout.tsx`**: nuevo *shell* — grid `sidebar + main`
  desplazable a altura completa; sustituye la `NavBar` superior. El pie lleva el
  **aviso de marcas** (antes no estaba).
- **`app/(protected)/panel/page.tsx`** reescrito con **datos reales**:
  - **Mis inscripciones** con barra de progreso degradada, badge de proveedor +
    estado, "X de Y temas · Siguiente: …" y botón **Continuar** (calcula el avance
    desde `progress` + `catalog`).
  - **Columna derecha (gamificación moderada, sin XP):** *racha* y *meta semanal*
    **derivadas de las lecciones reales** (timestamps de `progress.lecciones`), y
    *último simulacro* (de `exams`). Nada inventado.
  - Estado vacío (sin inscripciones) con CTA al catálogo.
- **Iconos 3D** del handoff copiados a `public/icons/` (genéricos: casa, libro,
  fuego, diana, trofeo… sin logos de proveedor).
- Se eliminaron `nav-bar.tsx`, `mobile-menu.tsx`, `logout-button.tsx` y
  `panel/unenroll-button.tsx` (quedaron sin uso al pasar al sidebar).

**Decisión:** se adoptó el **sidebar como shell de toda el área autenticada** (no
solo del panel), que es la esencia del diseño; los `NAV_LINKS` ya coincidían. La
gamificación se calcula de datos reales para no mostrar cifras falsas.

**Verificación:** `npm run check` (typecheck + lint + formato + tests) y
`npm run build` en **verde** (22 rutas; `/panel` 111 kB). La verificación **en vivo
queda pendiente**: el panel necesita el stack backend completo (auth + users +
enrollments + catalog + exams + progress) y ahora estaba apagado. Traducción fiel a
los tokens/fuentes del diseño (mismos `--brand`, Fredoka/Nunito/IBM Plex Mono).

---

## 2026-06-10 · Estudiar — lector de hojas, navegación, contenido ampliado y velocidad

**Contexto:** feedback del responsable sobre Estudiar: el panel de quiz se veía
"incompleto" y sin botón para pasar de tema; poco material por tema (pidió un
"cambio de hoja" para más contenido); y la app "lenta para responder". Adjuntó la
guía oficial SAA-C03 (referencia de cobertura, **no se copia** — regla de marcas).

**Hecho:**
- **Velocidad (causa raíz):** `dev-up.ps1` arrancaba la web con **`next dev`**
  (recompila cada ruta al navegar). Ahora hace **build de producción + `next
  start`** → respuesta mucho más ágil.
- **Quiz:** la tarjeta de inicio del `QuizRunner` ya no se ve vacía (describe el
  quiz, nº de preguntas y el 70% para aprobar/desbloquear). Se añadió
  **navegación entre temas** al pie del tema ("← anterior" / "**Siguiente tema
  →**", habilitado al aprobar).
- **Lector de hojas:** nuevo `lesson-reader.tsx` (cliente) — el material se lee
  como cuadernillo: **una hoja a la vez** con "← Hoja anterior / Siguiente hoja →",
  indicador de página y "marcar leída" por hoja. Ordena por id (`m_<tema>` <
  `m_<tema>_2`…).
- **Contenido ampliado (workflow multi-agente):** una agente por tema redactó **3
  hojas nuevas originales** (profundizan los subtemas que mide cada dominio, con
  tablas comparativas y cierre "> En el examen:") + **3 preguntas** extra; un
  **revisor adversarial** verificó exactitud técnica, originalidad, relevancia,
  markdown y coherencia de respuestas en cada tema. Resultado en
  `scripts/content/<slug>.json` (**+36 hojas, +36 preguntas**, 12/12 verificados).
- **Seed:** `seed-mongo.py` carga `scripts/content/*.json` y crea las hojas
  (`m_<tema>_2..`) y preguntas adicionales (robusto a archivos ausentes). Tras
  sembrar: **materiales 48** (4/tema) y **preguntas 136** (más respuesta_múltiple),
  todo UTF-8 correcto.

**Verificación:** `npm run check` + `npm run build` en **verde**. Seed ejecutado
contra Mongo: 12 temas × 4 hojas con ids ordenados, preguntas por tema ampliadas
(p.ej. iam 10). El render en vivo de Estudiar queda para cuando el stack backend
esté levantado (con la web ya en modo producción).
