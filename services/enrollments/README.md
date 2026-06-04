# Servicio `enrollments`

Vínculo entre estudiantes y objetivos del catálogo (certificaciones, pistas de
entrevista). Servicio independiente por decisión de dominio (**ADR-09**): no
acopla identidad ni catálogo; los referencia de forma lógica.

> Diseño: [`docs/fase-1-diseno.md`](../../docs/fase-1-diseno.md) §5.bis.

## Endpoints (`/v1`)

| Método  | Ruta                          | Auth     | Descripción |
|---------|-------------------------------|----------|-------------|
| `GET`   | `/v1/health`                  | —        | Liveness. |
| `GET`   | `/v1/ready`                   | —        | Readiness (ping a Postgres). |
| `POST`  | `/v1/enrollments`             | usuario  | Crear: `{tipo_objetivo, objetivo_id}`. `usuario_id` = `sub` del token. |
| `GET`   | `/v1/me/enrollments`          | usuario  | Listar las propias. Filtros: `estado`, `limit`, `offset`. |
| `PATCH` | `/v1/enrollments/{id}`        | usuario  | Cambiar `estado` (solo del propio usuario). |
| `DELETE`| `/v1/enrollments/{id}`        | usuario  | Eliminar (solo del propio usuario). |

**Defensas integradas (cubre OWASP IDOR/BOLA):**
- `usuario_id` siempre del `sub` del JWT, nunca del body.
- `GET /v1/me/enrollments` filtra por usuario autenticado.
- En `PATCH`/`DELETE`, si el id no existe **o no pertenece** se devuelve `404`
  indistintamente (no se filtra la existencia de IDs ajenos).
- El objetivo de la inscripción se valida contra `catalog` antes de insertar
  (referencia lógica entre servicios — sin FKs).

## Configuración (variables de entorno)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `ENROLLMENTS_DATABASE_URL` / `DATABASE_URL` | — (**obligatoria**) | DSN de Postgres. |
| `ENROLLMENTS_CATALOG_URL` | — (**obligatoria** salvo migrate) | URL raíz del servicio catalog. |
| `ENROLLMENTS_CATALOG_TIMEOUT` | `5s` | Timeout total de las llamadas a catalog. |
| `ENROLLMENTS_OIDC_ISSUER` / `OIDC_ISSUER` | — | Emisor OIDC. Vacío ⇒ rutas protegidas responden 501. |
| `ENROLLMENTS_OIDC_AUDIENCE` / `OIDC_AUDIENCE` | — | Audiencia esperada del token. |
| `ENROLLMENTS_ADDR` / `PORT` | `:8080` | Dirección de escucha. |
| `ENROLLMENTS_ENV` | `dev` | `dev` \| `staging` \| `prod`. |
| `ENROLLMENTS_AUTO_MIGRATE` | `false` | Migrar al arrancar (en deploy: usar `cmd/migrate`). |

## Desarrollo

```bash
export DATABASE_URL='postgres://postgres@localhost:5432/certready_dev?sslmode=disable'
export ENROLLMENTS_CATALOG_URL='http://localhost:18090'  # catalog levantado aparte
make migrate     # crea el esquema enrollments
make run         # arranca en :8080

# Tests (unitarios siempre; integración del store si hay base de prueba):
export ENROLLMENTS_TEST_DATABASE_URL='postgres://postgres@localhost:5432/certready_test?sslmode=disable'
make test
```

Requisitos: Go ≥ 1.25, PostgreSQL ≥ 13, servicio `catalog` corriendo. Comparte
`auth`, `httpx`, `logging`, `postgres` y `pgmigrate` con [`libs/platform`](../../libs/platform).
