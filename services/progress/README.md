# Servicio `progress`

Progreso de estudio del estudiante: lecciones leídas y resultado del **quiz por
tema**. Es el respaldo durable de la ruta de aprendizaje tipo Duolingo de la web
(`/estudiar`). Persistencia en **PostgreSQL** (esquema `progress`); autorización
por **pertenencia** (el `usuario_id` sale del `sub` del JWT, nunca del body).

El grano es `(usuario, certificación, tema)`. Las claves de certificación y tema
son **slugs** legibles (`aws-saa`, `iam`, …), no UUIDs.

## API (`/v1`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/v1/health` | Liveness. |
| `GET`  | `/v1/ready` | Readiness (ping a Postgres). |
| `POST` | `/v1/progress/lessons` | Marca una lección leída `{certificacion, tema, material_id}` (idempotente). |
| `POST` | `/v1/progress/quizzes` | Registra el quiz de un tema `{certificacion, tema, puntaje}`; aprobado si `puntaje ≥ 70`. Devuelve `{tema, quiz_puntaje, quiz_aprobado}`. |
| `GET`  | `/v1/me/progress?certificacion=<slug>` | Progreso del usuario: `{lecciones:[{tema,material_id,creado_en}], temas:[{tema,quiz_puntaje,quiz_aprobado}]}`. |

## Configuración (entorno)

`PROGRESS_ADDR` (o `PORT`), `PROGRESS_DATABASE_URL` (o `DATABASE_URL`),
`PROGRESS_OIDC_ISSUER` (o `OIDC_ISSUER`), `PROGRESS_OIDC_AUDIENCE` (o
`OIDC_AUDIENCE`), `PROGRESS_AUTO_MIGRATE`, y los timeouts del servidor.

## Local

```bash
export PROGRESS_DATABASE_URL='postgres://postgres@localhost:5432/certready_dev?sslmode=disable'
export PROGRESS_ADDR=':18093'
export PROGRESS_OIDC_ISSUER='http://localhost:9099'
go run ./cmd/migrate
go run ./cmd/server
```
