# `oidc-mock` — Emisor OIDC para desarrollo local

Proveedor OIDC mínimo (discovery, JWKS, authorize, token con PKCE) para
desarrollar la web y los servicios localmente sin Amazon Cognito.

> No es código de producción. En prod el emisor es Cognito (ADR-06). El
> validador del backend (`libs/platform/auth`) es el mismo en ambos casos: solo
> cambia la fuente del JWKS.

## Ejecutar

```bash
go run ./tools/oidc-mock                       # :9099, dev@local por defecto
OIDC_MOCK_ADDR=:9100 go run ./tools/oidc-mock  # otro puerto
```

Endpoints:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/.well-known/openid-configuration` | Discovery OIDC. |
| `GET`  | `/jwks` | Claves públicas (JWKS). |
| `GET`  | `/authorize` | Auto-aprueba; redirige con `?code=...`. |
| `POST` | `/token` | Canjea code (PKCE) o refresh por JWT. |
| `GET`  | `/userinfo` | Claims del bearer. |
| `GET`  | `/healthz` | Comprobación de salud. |

## Simular distintos usuarios / roles

El `/authorize` lee del query (todos opcionales):

| Param | Default | Efecto en el token |
|-------|---------|--------------------|
| `email` | `dev@local` (o `OIDC_MOCK_DEFAULT_EMAIL`) | claim `email` |
| `name`  | `Dev User` | claim `name` |
| `groups`| — | claim `cognito:groups` (CSV → array) |
| `sub`   | derivado del email | claim `sub` (UUID-like) |

El `sub` se **deriva determinísticamente del email**: un mismo email produce
siempre el mismo `sub` entre logins, así no se rompen los upserts JIT del
servicio `users`.

Ejemplos:

```text
http://localhost:9099/authorize?...&email=admin@local&groups=admin
http://localhost:9099/authorize?...&email=u1@local
http://localhost:9099/authorize?...&email=u2@local
```

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `OIDC_MOCK_ADDR` | `:9099` | Dirección de escucha. |
| `OIDC_MOCK_DEFAULT_EMAIL` | `dev@local` | Email simulado si el query no lo trae. |
