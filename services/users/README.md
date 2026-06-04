# Servicio `users`

Identidad de aplicación de CertReady: usuarios, perfiles y RBAC. Go + PostgreSQL.
La autenticación es JWT/OIDC (Cognito en prod) vía `libs/platform/auth`.

> Diseño: [`docs/fase-1-diseno.md`](../../docs/fase-1-diseno.md) (§5–6).

## Endpoints (`/v1`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET`   | `/v1/health` | — | Liveness. |
| `GET`   | `/v1/ready` | — | Readiness (ping a Postgres). |
| `GET`   | `/v1/me` | usuario | Perfil propio. **Provisiona** la cuenta en el primer acceso (JIT). |
| `PATCH` | `/v1/me` | usuario | Edita el perfil propio (nombre, bio, país, avatar). |
| `GET`   | `/v1/users` | **admin** | Lista usuarios. |

- La identidad se toma **siempre del `sub` del token**, nunca de un id del cliente
  (anti-IDOR/BOLA).
- Provisión JIT: el `sub` del JWT es el `id`; email y rol se sincronizan con el
  token en cada acceso. Rol = `admin` si el token trae el grupo `admin`, si no `estudiante`.

## Configuración (variables de entorno)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `USERS_DATABASE_URL` / `DATABASE_URL` | — (**obligatoria**) | DSN de Postgres. |
| `USERS_OIDC_ISSUER` / `OIDC_ISSUER` | — | Emisor OIDC. Vacío ⇒ rutas protegidas responden 501. |
| `USERS_OIDC_AUDIENCE` / `OIDC_AUDIENCE` | — | Audiencia esperada del token. |
| `USERS_ADDR` / `PORT` | `:8080` | Dirección de escucha. |
| `USERS_ENV` | `dev` | `dev` \| `staging` \| `prod`. |
| `USERS_AUTO_MIGRATE` | `false` | Migrar al arrancar (en deploy: usar `cmd/migrate`). |

## Desarrollo

```bash
export DATABASE_URL='postgres://postgres@localhost:5432/certready_dev?sslmode=disable'
make migrate     # crea el esquema users (usuarios, perfiles)

# Tests (unitarios siempre; integración del store si hay base de prueba):
export USERS_TEST_DATABASE_URL='postgres://postgres@localhost:5432/certready_test?sslmode=disable'
make test
```

Requisitos: Go ≥ 1.25, PostgreSQL ≥ 13. Comparte `auth`, `httpx`, `logging`,
`postgres` y `pgmigrate` con [`libs/platform`](../../libs/platform).
