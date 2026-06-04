# Fase 1 — Identidad y catálogo · Diseño detallado

> Estado: **propuesta para revisión** (no implementado todavía).
> Objetivo de fase (del roadmap): el estudiante se registra, elige varias
> certificaciones y ve su panel.

Este documento fija el diseño de datos, los contratos de API, el modelo de auth
y el stack Go antes de escribir código. Las decisiones de arquitectura se anclan
en los ADR del doc principal (en particular ADR-03, ADR-06, ADR-07, ADR-08).

---

## 1. Servicios y fronteras (quién posee qué)

| Servicio | Posee (Postgres) | Responsabilidad |
|---|---|---|
| **`catalog`** | `certificaciones`, `temas`, `pistas_entrevista` | Catálogo de estudio (contenido navegable). |
| **`users`** | `usuarios`, `perfiles` | Identidad de aplicación, perfil y RBAC. |
| **`enrollments`** | `inscripciones` | Vínculo estudiante ↔ objetivo (certificación o pista). |

- **Decisión (2026-06-03, responsable):** las **inscripciones se separan a su propio
  servicio** `enrollments`, en lugar de vivir en `catalog` como sugería la §10 del
  doc de arquitectura. Razón: una inscripción es un **contexto propio** que une dos
  dominios (identidad y catálogo); no pertenece a ninguno. Mantiene `catalog` puro
  (solo contenido) y `users` puro (solo identidad). Registrado como **ADR-09**.
- **Independencia de servicios:** no comparten tablas. Las referencias entre
  servicios son **lógicas**, no FKs de base de datos:
  - `inscripciones.usuario_id` → `users.usuarios.id` (vía JWT `sub`).
  - `inscripciones.objetivo_id` → `catalog.{certificaciones|pistas_entrevista}.id`
    (se valida llamando a `catalog`), igual que `pregunta_ref` → Mongo es un cruce
    lógico en la §8.

## 2. Topología de base de datos a costo cero (ADR-08)

- **Una instancia Postgres** (local en dev; **Neon** en el despliegue $0).
- **Un esquema por servicio:** `catalog`, `users`, `enrollments`. Aísla los
  dominios sin pagar por instancias separadas. Cada servicio solo recibe permisos
  sobre su esquema.
- Extensión `pgcrypto` para `gen_random_uuid()` (o `uuid-ossp`).
- 12-factor: cada servicio recibe su `DATABASE_URL` (con `search_path` a su esquema).

---

## 3. Modelo de datos — servicio `catalog` (foco del Incremento 1)

DDL de referencia (la versión canónica vivirá en `services/catalog/migrations/`):

```sql
-- esquema catalog
create table catalog.certificaciones (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,                 -- id externo estable: "aws-saa"
  nombre        text not null,
  proveedor     text not null,                         -- AWS, Azure, GCP, CompTIA...
  nivel         text not null,                         -- foundational | associate | professional...
  descripcion   text,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table catalog.temas (
  id               uuid primary key default gen_random_uuid(),
  certificacion_id uuid not null references catalog.certificaciones(id) on delete cascade,
  slug             text not null,
  nombre           text not null,
  dominio          text,                               -- alimenta DIM_TEMA.dominio (OLAP, §9)
  orden            int not null default 0,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (certificacion_id, slug)
);

create table catalog.pistas_entrevista (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  puesto        text not null,                          -- backend, frontend, data, devops...
  area          text not null,                          -- algorithms, system-design...
  nombre        text not null,
  descripcion   text,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index on catalog.temas (certificacion_id);
```

**Notas de diseño:**
- Borrado de certificaciones: **soft delete** vía `activo=false` (preserva
  integridad analítica e inscripciones históricas en el otro servicio). El
  `on delete cascade` de `temas` aplica solo a borrados físicos administrativos.
- `slug` da URLs e IDs estables y legibles, independientes del UUID interno.
- `catalog` **no conoce** a usuarios ni inscripciones: es contenido puro.

---

## 4. Contratos de API — `catalog` (REST/JSON, `/v1`)

### Convenciones transversales
- **Envoltura de lista:** `{ "data": [...], "count": <n>, "next_offset": <n|null> }`.
- **Envoltura de error:** `{ "error": { "code": "<slug>", "message": "<humano>", "details": [...] } }`.
- **Paginación:** `limit` (default 20, máx 100) + `offset`. Cursor/keyset queda como
  optimización futura (el catálogo es pequeño).
- **Versionado:** todo bajo `/v1`. **Salud:** `/v1/health`, `/v1/ready` (como todo servicio).
- **Seguridad por diseño:** toda query es **parametrizada** (pgx) → sin SQLi;
  toda entrada se valida en el borde.

### Endpoints (Incremento 1 = lecturas + create admin)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| `GET` | `/v1/certifications` | público* | Lista; filtros `?proveedor=&nivel=&activo=&limit=&offset=`. |
| `GET` | `/v1/certifications/{idOrSlug}` | público* | Detalle de una certificación. |
| `GET` | `/v1/certifications/{id}/topics` | público* | Temas de una certificación (ordenados). |
| `GET` | `/v1/topics/{id}` | público* | Detalle de un tema. |
| `GET` | `/v1/tracks` | público* | Pistas de entrevista; filtros `?puesto=&area=`. |
| `GET` | `/v1/tracks/{idOrSlug}` | público* | Detalle de una pista. |
| `POST` | `/v1/certifications` | **admin** | Crear certificación. |
| `PATCH`| `/v1/certifications/{id}` | **admin** | Editar / activar / desactivar. |
| `POST` | `/v1/certifications/{id}/topics` | **admin** | Crear tema. |
| `POST` | `/v1/tracks` | **admin** | Crear pista. |

\* En Incremento 1 las lecturas no exigen auth; la **autorización admin de las
escrituras se conecta en Incremento 2** (cuando exista el middleware JWT). Hasta
entonces las rutas de escritura quedan tras un *gate* que las rechaza (501/403)
para no exponerlas sin protección.

### Ejemplo
`GET /v1/certifications?proveedor=AWS&limit=2`
```json
{
  "data": [
    { "id": "…", "slug": "aws-saa", "nombre": "AWS Solutions Architect Associate",
      "proveedor": "AWS", "nivel": "associate", "activo": true }
  ],
  "count": 1,
  "next_offset": null
}
```

---

## 5. Modelo de datos — servicio `users` (Incremento 2)

```sql
create table users.usuarios (
  id          uuid primary key,            -- = "sub" del JWT (Cognito), no autogenerado
  email       text not null unique,
  nombre      text,
  rol         text not null default 'estudiante' check (rol in ('estudiante','admin')),
  creado_en   timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
-- (perfiles: datos extendidos opcionales; se detalla en Incremento 2)
```
- **Provisión en primer login:** el `sub` del JWT es el `id`. Si no existe fila,
  el servicio la crea (just-in-time provisioning) a partir de los claims.

---

## 5.bis. Servicio `enrollments` (Incremento 2)

Dominio propio: el vínculo estudiante ↔ objetivo. No posee identidad ni catálogo;
los referencia lógicamente.

```sql
create table enrollments.inscripciones (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null,                          -- ref lógica a users.usuarios.id (JWT sub)
  tipo_objetivo text not null check (tipo_objetivo in ('certificacion','pista')),
  objetivo_id   uuid not null,                          -- ref lógica a catalog (cert o pista según tipo)
  estado        text not null default 'activa'
                  check (estado in ('activa','pausada','completada','archivada')),
  creado_en     timestamptz not null default now(),
  unique (usuario_id, tipo_objetivo, objetivo_id)       -- no inscribirse dos veces al mismo objetivo
);
create index on enrollments.inscripciones (usuario_id);
```

- `objetivo_id` no puede ser FK (apunta a dos tablas según `tipo_objetivo`); su
  existencia se valida llamando a `catalog` antes de inscribir.

### Endpoints (`/v1`, requieren auth de estudiante)

| Método | Ruta | Regla anti-IDOR/BOLA |
|---|---|---|
| `POST` | `/v1/enrollments` | crea para el `usuario_id` del **token**, nunca del body. |
| `GET` | `/v1/me/enrollments` | devuelve **solo** las del usuario autenticado. |
| `DELETE` | `/v1/enrollments/{id}` | solo si la inscripción **pertenece** al usuario. |

---

## 6. Modelo de autenticación / autorización (Incremento 2)

- **Emisor agnóstico (ADR-06 + ADR-07):** el servicio valida **JWT firmados (RS256)**
  contra un **JWKS** configurable por env (`OIDC_ISSUER`, `OIDC_JWKS_URL`, `OIDC_AUDIENCE`).
  - **Prod:** el emisor es **Cognito** (IaC en módulo Terraform `cognito`, parqueado
    como el resto hasta que haya cuenta AWS).
  - **Dev/tests:** un emisor local de prueba (o claves RS256 de test) genera tokens;
    el código de validación es idéntico. **Nada de Cognito requerido para construir.**
- **Middleware `internal/auth`:** valida firma, `exp`, `iss`, `aud`, `alg` (rechaza
  `alg=none` y algoritmos no esperados → cubre la superficie de pentest "manipulación
  de JWT"). Extrae `sub` y `rol`.
- **RBAC:** roles `estudiante` | `admin`. Autorización a nivel de objeto en cada
  endpoint (un estudiante solo ve/gestiona lo suyo → cubre IDOR/BOLA).

---

## 7. Stack Go y estructura

- **Driver/pool:** `jackc/pgx/v5` (rendimiento, tipos nativos, *prepared statements*).
- **Migraciones:** `golang-migrate` con archivos `*.up.sql` / `*.down.sql` embebidos
  (`embed.FS`), ejecutables por `cmd/migrate` y/o al arranque (configurable).
- **Consultas:** SQL escrito a mano en una capa **repositorio** (sin codegen) →
  disciplina de dependencias; parametrizado siempre.
- **Multi-módulo + código compartido:** se introduce un **`go.work`** en la raíz y
  una librería compartida **`libs/platform`** (módulo Go) con lo reutilizable:
  `logging`, middleware HTTP (request-id, access-log, recover), handlers de salud,
  helpers de config y pool de Postgres.
  - **Decisión de alcance (recomendada):** en Incremento 1, `catalog` usa
    `libs/platform`; **`services/health` se deja intacto** (ya verificado) y su
    convergencia hacia la librería queda como deuda técnica menor anotada, para no
    arriesgar lo que ya funciona. (Alternativa: migrar `health` también ahora.)
- **Doble entrypoint** por servicio (igual que `health`, ADR-07): `cmd/server` +
  `cmd/lambda`, compartiendo el mismo router.

### Estructura propuesta de `services/catalog`
```
services/catalog/
├── cmd/server/          # entrypoint HTTP
├── cmd/lambda/          # entrypoint Lambda
├── cmd/migrate/         # aplica migraciones (golang-migrate)
├── internal/
│   ├── catalog/         # dominio: tipos + reglas (Certificacion, Tema, Pista, Inscripcion)
│   ├── store/           # repositorio Postgres (pgx, SQL a mano)
│   └── httpapi/         # router + handlers + DTOs
├── migrations/          # 0001_init.up.sql / .down.sql ...
├── Dockerfile           # ruta Fargate (parqueada)
└── Makefile
```

---

## 8. Pruebas y verificación (local, $0)

- **Postgres local** (winget) con una BD de test dedicada (`catalog_test`).
- Tests de repositorio contra Postgres real (no mocks de SQL): migran, insertan,
  consultan, truncan. Tabla de casos.
- Tests de handlers con `httptest` + repositorio real o un doble del store.
- `go test ./...`, `go vet`, `gofmt`; `terraform validate` para el módulo nuevo.
- Smoke test: `cmd/migrate` + `cmd/server` arriba + `curl` de los endpoints.

## 9. Superficie de pentesting cubierta en esta fase (§11 del doc)
- **SQLi:** queries parametrizadas en todo el repositorio.
- **IDOR/BOLA:** inscripciones siempre acotadas al `sub` del token.
- **Manipulación de JWT:** validación estricta de `alg`/`iss`/`aud`/`exp`.
- (NoSQLi entra en Fase 2 con Mongo.)

## 10. Lo que NO entra en Fase 1
- Contenido de estudio y preguntas (Mongo) → Fase 2.
- Exámenes/intentos, juez de código → Fases 2–3.
- OLAP/DSS → Fases 4–5.

---

## 11. Plan de incrementos
1. **Inc. 1 (siguiente turno):** Postgres local + `go.work` + `libs/platform` +
   `services/catalog` (esquema `catalog`, migraciones, lecturas, create admin tras
   gate) + tests. **Sin inscripciones** (van en `enrollments`, Inc. 2).
2. **Inc. 2:** `libs/platform/auth` (JWT/OIDC) + `services/users` +
   **`services/enrollments`** + conectar autorización admin en `catalog` + módulo
   Terraform `cognito` (parqueado).
3. **Inc. 3:** web Next.js (login OIDC, elegir certificaciones, panel).

**Criterio de salida de la fase:** el estudiante se registra (Cognito/JWT), elige
varias certificaciones (inscripciones) y ve su panel (web).
