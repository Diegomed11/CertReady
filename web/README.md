# Web — CertReady (Next.js 15 + TypeScript)

Frontend de la plataforma con **patrón BFF**: el navegador habla únicamente con
esta app; las rutas `/api/*` leen la sesión cifrada (cookie HttpOnly + iron-session)
y proxean a los servicios Go (`catalog`, `users`, `enrollments`) inyectando
`Authorization: Bearer`. El token OIDC **nunca llega al cliente**.

> Diseño: [`docs/fase-1-diseno.md`](../docs/fase-1-diseno.md) §6 + decisión BFF
> registrada en la bitácora.

## Estado

**Fase 1 completa.** La web cubre el flujo del estudiante de extremo a extremo.

- Auth OIDC con PKCE (`openid-client` v6): `/api/auth/login`, `/api/auth/callback`,
  `/api/auth/logout`. Sesión cifrada con `iron-session` (cookie HttpOnly); el
  token nunca llega al navegador.
- Cliente HTTP server-side tipado de los servicios (`lib/api/`) y rutas BFF de
  mutación (`/api/enrollments`, `/api/enrollments/{id}`, `/api/me`).
- Vistas: inicio de sesión (landing + `/auth/error`), catálogo
  (`/certifications`, con inscripción) y panel del estudiante (`/panel`, con
  baja). Rutas protegidas por un guard de sesión.
- Tailwind, TypeScript estricto (`strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`), ESLint + Prettier, Vitest.

Verificado de extremo a extremo con el stack completo levantado (web + emisor
OIDC de desarrollo + catalog + users + enrollments + PostgreSQL): login,
inscripción y panel.

## Desarrollo

```bash
# 1) Levantar el emisor OIDC mock (otra terminal)
go run ./tools/oidc-mock                                  # :9099

# 2) Levantar los servicios Go (en sus carpetas; otras terminales)
#   catalog en :18090, users en :18091, enrollments en :18092

# 3) Variables de entorno del BFF
cp .env.example .env.local
#   ajusta OIDC_*, *_BASE_URL y un SESSION_PASSWORD de 32+ caracteres

# 4) BFF
npm install
npm run dev                                               # :3000
```

Verificación:

```bash
npm run check    # typecheck + lint + format check + tests
npm run build    # build de producción
```

## Patrón BFF — flujo

1. El navegador va a `/api/auth/login`. El BFF genera PKCE+state+nonce, los
   guarda en la sesión y redirige al Authorization Endpoint del IdP.
2. El IdP autentica al usuario y redirige a `/api/auth/callback?code=...`.
3. El BFF intercambia el code por tokens (validando state/nonce/PKCE), guarda
   `access_token` y refresh en la sesión cifrada, y redirige a `/panel`.
4. Las rutas `/api/*` leen el `access_token` de la sesión y lo inyectan al
   llamar a los servicios Go (`Authorization: Bearer`). El navegador solo ve
   JSON ya filtrado por el BFF.

## Variables de entorno

Ver [`.env.example`](./.env.example) y la validación en
[`lib/env.ts`](./lib/env.ts). El proceso falla al arrancar si faltan o son
inválidas (mejor que un fallo silencioso en runtime).

| Variable                                                       | Descripción                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `OIDC_ISSUER`                                                  | Emisor OIDC. Dev: `http://localhost:9099` (mock). Prod: Cognito. |
| `OIDC_CLIENT_ID`                                               | Client ID del App Client.                                        |
| `OIDC_CLIENT_SECRET`                                           | Opcional; vacío para clientes públicos (PKCE).                   |
| `OIDC_REDIRECT_URI`                                            | Callback (debe estar en la allowlist del IdP).                   |
| `OIDC_POST_LOGOUT_REDIRECT_URI`                                | Destino tras logout.                                             |
| `SESSION_PASSWORD`                                             | Secreto de la cookie (>= 32 caracteres).                         |
| `SESSION_COOKIE_NAME`                                          | Default `certready_session`.                                     |
| `CATALOG_BASE_URL` / `USERS_BASE_URL` / `ENROLLMENTS_BASE_URL` | URLs de los servicios Go.                                        |
