# Seguridad y preparación para producción (Fase 7)

Guía viva del endurecimiento de CertReady y de lo que falta para desplegar. El
despliegue a AWS está **diferido a propósito** (operar a costo cero); este documento
separa lo **ya cubierto**, lo **hecho ahora** y lo **pendiente de despliegue**.

## Ya cubierto (por diseño y verificado)

- **Sesión web (BFF)**: cookie `iron-session` cifrada, `HttpOnly`, `SameSite=Lax`,
  `Secure` en producción; `SESSION_PASSWORD` ≥ 32 validado al arrancar. El navegador
  **nunca** ve los tokens OIDC. Ver [session.ts](../web/lib/auth/session.ts).
- **BFF como frontera**: las rutas `/api/*` validan la forma del cuerpo, exigen sesión
  (401 si falta) y **fijan `usuario_id` desde el token** (no desde el cliente) → defensa
  anti-IDOR/BOLA. No filtran errores internos (502 genérico).
- **Config/secretos**: variables validadas con zod, solo en servidor; cero secretos en
  código ([env.ts](../web/lib/env.ts)). Igual en Go (12-factor).
- **AuthN/Z**: validación JWT/OIDC agnóstica del emisor + RBAC en los servicios Go;
  IDOR/BOLA y manipulación de token cubiertos por pruebas.
- **Juez de código**: ejecuta código no confiable en contenedores efímeros endurecidos
  (sin red, FS solo lectura, límites de CPU/mem/PIDs/tiempo, sin privilegios); suite de
  escape obligatoria. Ver regla `judge.md`.
- **Plataforma Go**: `RequestID`, `AccessLog`, `Recover` (panic → 500 controlado) en
  [middleware.go](../libs/platform/httpx/middleware.go).

## Hecho ahora (Fase 7, incremento 1)

- **Encabezados de seguridad** en toda respuesta web ([next.config.mjs](../web/next.config.mjs)):
  `Strict-Transport-Security` (HSTS), `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, y **CSP en
  `Report-Only`** (no rompe la app; reporta en consola para afinarla antes de forzarla).

## Hecho ahora (Fase 7, incremento 2)

- **Rate-limit (token-bucket por IP, en memoria, 429 + `Retry-After`)** como defensa
  base por instancia (en prod lo robusto lo da el WAF):
  - **Servicios Go**: middleware `RateLimit` en
    [httpx/ratelimit.go](../libs/platform/httpx/ratelimit.go) aplicado en los 7
    servicios (catalog, users, enrollments, content, exams, problems, progress);
    `/v1/health` y `/v1/ready` quedan exentos para no afectar health-checks.
  - **Registro/login (BFF)**: [rate-limit.ts](../web/lib/rate-limit.ts) en
    `/api/auth/register` y `/api/auth/login` (anti fuerza bruta; cubre web en dev y prod).
  - **Subida de CV (DSS)**: middleware acotado a `POST /v1/recommendations`
    ([api.py](../data/dss/api.py)); no afecta a readiness/analytics.
  - *Pendiente*: el IdP `oidc-mock` es **dev-only**; en prod el throttle de auth lo da
    **Cognito**.
- **Sanitización de la subida de CV** ([recomendador.py](../data/dss/recomendador.py) +
  [api.py](../data/dss/api.py)): lectura **acotada** (no materializa más de 5 MB),
  rechazo temprano por tamaño, **límite de páginas** PDF, guardia **anti zip-bomb** en
  DOCX y parseo tolerante a fallos → 422 (nunca 500); el archivo no se persiste (ADR-14).
- **CORS**: confirmado **ausente** en todos los servicios y el DSS → restrictivo por
  diseño (el navegador solo habla con el BFF, mismo origen). Mantener así.
- **Secretos/API keys**: auditoría sin hallazgos — sin `NEXT_PUBLIC_*` con secretos, sin
  claves AWS/privadas/contraseñas hardcodeadas; los "tokens" del cliente son de diseño.

## Hecho ahora (Fase 7, incremento 3 — piloto RLS en enrollments)

Row Level Security en `enrollments.inscripciones` como **piloto** (defensa en
profundidad; la autorización por usuario ya está en el código y probada), detrás de un
**interruptor** para que entrar el cambio **no altere el comportamiento** hasta activarlo:

- Plumbing reutilizable en [postgres/rls.go](../libs/platform/postgres/rls.go): `Querier`,
  `Q(ctx,pool)` (devuelve la transacción de la petición o el pool) y el middleware
  `RLSTx` (abre tx + `set_config('app.usuario_id', <sub>, true)`; commit/rollback por
  estado). El store enruta sus queries por `Q(...)` (no-op con RLS apagado).
- Migración [0002_rls](../services/enrollments/migrations/0002_rls.up.sql): rol
  `certready_app` (mínimos privilegios), `ENABLE`/`FORCE ROW LEVEL SECURITY` y política
  `usuario_id = current_setting('app.usuario_id', true)` (falla **cerrado** si no se fija).
- Interruptor `ENROLLMENTS_RLS_ENABLED` (default **false**). Apagado + conexión como
  superusuario `postgres` ⇒ idéntico a hoy.

**Cómo activarlo y probarlo (dev):**
1. (una vez) `alter role certready_app login password 'certready';`
2. Dar permisos de conexión a la BD: `grant connect on database certready_dev to certready_app;`
3. Apuntar el servicio al rol y encender el flag:
   `ENROLLMENTS_DATABASE_URL=postgres://certready_app:certready@localhost:5432/certready_dev?sslmode=disable`
   y `ENROLLMENTS_RLS_ENABLED=true`.
4. Probar: un usuario solo ve/edita SUS inscripciones; con otro `sub` no aparecen. Si algo
   falla, apagar el flag (vuelve al comportamiento actual) — sin revertir código.

*Pendiente*: replicar el patrón a **progress** y **exams** (el **juez** queda fuera por su
petición larga, ver más abajo).

## Dependencias (npm audit) — sin acción urgente

`npm audit` reporta 7 hallazgos (1 crítico), **todos en herramientas de dev/build**:
`vitest → vite → esbuild` (servidor de pruebas) y un `postcss` anidado dentro de Next.
**No** forman parte del runtime de producción (next/react/iron-session/openid-client/
zod/three están limpios), así que **no** llegan al bundle desplegado.

- **NO ejecutar `npm audit fix --force`**: degradaría Next a v9 (rompe la app).
- Opcional, más adelante: subir `vitest` a v4 (cambio mayor, solo afecta pruebas).

## Pendiente de código (próximos incrementos, a $0)

- **RLS — replicar a `progress` y `exams`**: el piloto ya está en `enrollments` (ver
  arriba). Replicar el mismo patrón (migración `0002_rls` + store por `Q(ctx, pool)` +
  `RLSTx` en el router + flag `*_RLS_ENABLED`). El **juez** queda fuera por su petición
  larga (la transacción amarraría una conexión del pool durante la ejecución del sandbox).
- **Límite de tamaño de cuerpo en servicios Go**: `http.MaxBytesReader` donde el cuerpo
  lo controla el usuario (`judge`, `content`); los timeouts del `http.Server`
  (`ReadTimeout`/`WriteTimeout`/`IdleTimeout`) ya están puestos en cada servicio.
- **CSP a enforce**: promover de Report-Only a `Content-Security-Policy` con **nonce**
  por request, tras verificar que no hay violaciones legítimas en consola.

## Pendiente de despliegue (requiere AWS — diferido por costo)

- **IdP real**: cambiar el emisor mock por **Cognito** (User Pool + PKCE ya en Terraform).
  El código ya es agnóstico del emisor; es config.
- **Secretos**: `SESSION_PASSWORD`, credenciales de DB, etc. desde **AWS Secrets Manager**
  (no `.env`).
- **Red/TLS**: ALB + HTTPS; CloudFront/**WAF** (rate-limit, reglas OWASP) delante; HSTS
  `preload` real solo con dominio en HTTPS.
- **CORS**: hoy **ausente por diseño** (el BFF es mismo-origen). Mantenerlo así; si se
  expone una API directa, definir origins explícitos (nunca `*`).
- **CI/CD**: el pipeline está escrito; activarlo al existir cuenta AWS + remoto.
- **Pentesting** y revisión final antes del lanzamiento.

## Antes de lanzar (legal/contenido)

Avisos a publicar (detalle en [contenido-y-marcas.md](contenido-y-marcas.md)):
disclaimer de marcas, política de contenido, atribuciones, Términos y Privacidad.
