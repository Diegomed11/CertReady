# CertReady

CertReady es una plataforma para preparar **certificaciones técnicas** (AWS,
Azure, GCP, CompTIA, Cisco, Kubernetes, entre otras) y **entrevistas de
programación**. Ofrece dos superficies de producto sobre una misma base: estudio
y exámenes de práctica por certificación, y ejercicios tipo LeetCode con
evaluación automática más preguntas por puesto. Encima corre una capa analítica
dimensional (OLAP) y un sistema de apoyo a decisiones que estima qué tan
preparado está el estudiante y recomienda qué estudiar a continuación.

El backend es políglota por diseño, con un único lenguaje de servicios (Go) y
otras tecnologías acotadas a donde aportan. El objetivo es que el sistema sea
realista y desplegable en producción sobre AWS, no una maqueta.

La especificación completa de arquitectura, las decisiones (ADR) y el plan de
fases están en [`docs/arquitectura-y-fases-certready.md`](docs/arquitectura-y-fases-certready.md).

## Arquitectura

El tráfico entra por el borde (CDN/WAF) y llega a una capa de aplicación de
servicios pequeños e independientes, cada uno dueño de sus datos. El cliente
nunca habla directamente con la base de datos. Los servicios validan tokens
OIDC y aplican autorización a nivel de objeto en cada endpoint.

Existen dos rutas de cómputo que conviven a propósito:

- **Ruta de costo cero (activa).** Los servicios se empaquetan como funciones
  AWS Lambda con Function URL, sin VPC ni NAT Gateway, dentro de la capa
  permanentemente gratuita de AWS. Es la ruta que se despliega hoy. La base de
  datos transaccional se aloja en un PostgreSQL gestionado externo (Neon),
  accesible por TLS, para no requerir red privada con costo.
- **Ruta de producción (objetivo).** El mismo código corre como contenedores en
  ECS Fargate detrás de un ALB, con RDS en subredes privadas. La
  infraestructura está escrita en Terraform y validada, pero no se aplica hasta
  que exista presupuesto.

El aislamiento entre ambas rutas vive en el código: cada servicio expone un
único `http.Handler` y dos puntos de entrada (`cmd/server` para HTTP y
`cmd/lambda` para Lambda). La lógica de negocio no conoce su destino de
despliegue. Las decisiones que sostienen este enfoque están registradas como
ADR-07 (Lambda en costo cero) y ADR-08 (Neon) en el documento de arquitectura.

## Stack

| Capa | Tecnología | Rol |
|------|-----------|-----|
| Servicios backend | Go | Único lenguaje de servicios. Binarios estáticos, arranque rápido. |
| Librería compartida | Go (`libs/platform`) | Logging, middleware HTTP, sondas de salud, pool de Postgres, validación OIDC, runner de migraciones. |
| Web | Next.js 15 + TypeScript | Patrón BFF: el navegador solo habla con la web; esta proxea a los servicios. |
| Móvil | Flutter (Dart) | Cliente Android/iOS. Fase 6 en curso (incrementos 1–2 hechos; iOS pendiente). |
| Capa de datos | Python (FastAPI + jobs) | ETL, OLAP y DSS (Fases 4–5, backend completo). Único lugar donde se usa Python. |
| Transaccional | PostgreSQL | Integridad relacional. Local/Neon en dev; RDS objetivo en producción. |
| Contenido y preguntas | MongoDB | Esquemas heterogéneos. En uso por `content`, `exams`, `problems` y `judge`. |
| OLAP | ClickHouse + Cube | Modelo dimensional expuesto como API (Fase 4, backend completo). |
| Identidad | Amazon Cognito | OAuth2/OIDC. En desarrollo se usa un emisor OIDC local. |
| Infraestructura | Terraform | IaC para AWS (Lambda, Cognito y la ruta Fargate parqueada). |
| CI | GitHub Actions | Lint, pruebas y empaquetado por servicio. |

## Estructura del repositorio

```
certready/
├── services/        Servicios backend en Go (uno por carpeta, módulo propio)
│   ├── health/      Servicio de salud (referencia mínima desplegable)
│   ├── catalog/     Certificaciones, temas y pistas de entrevista
│   ├── users/       Identidad de aplicación, perfiles y RBAC
│   └── enrollments/ Inscripciones del estudiante a objetivos del catálogo
├── libs/
│   └── platform/    Librería Go compartida por los servicios
├── tools/
│   └── oidc-mock/   Emisor OIDC para desarrollo local (reemplaza Cognito en dev)
├── web/             Aplicación web (Next.js, patrón BFF)
├── infra/           Infraestructura como código (Terraform)
├── judge/           Juez de código en sandbox (fase 3, aún no implementado)
├── data/            Capa de datos en Python (fases 4-5, aún no implementada)
├── mobile/          Aplicación Flutter (fase 6, aún no implementada)
└── docs/            Arquitectura, diseño, bitácora y hoja de ruta
```

El repositorio es un monorepo multi-módulo de Go coordinado por un archivo
`go.work`. Cada servicio y la librería compartida son módulos independientes con
su propio `go.mod`.

## Servicios

Los servicios siguen una estructura común: configuración por entorno
(12-factor), logging estructurado, apagado ordenado, API REST/JSON versionada
bajo `/v1`, y sondas `GET /v1/health` y `GET /v1/ready`.

| Servicio | Responsabilidad | Datos | Puerto local sugerido |
|----------|-----------------|-------|------------------------|
| `health` | Salud y readiness. Plantilla de referencia. | — | 8080 |
| `catalog` | Certificaciones, temas, pistas de entrevista. | PostgreSQL (esquema `catalog`) | 18090 |
| `users` | Usuarios, perfiles, roles. Provisión en el primer acceso. | PostgreSQL (esquema `users`) | 18091 |
| `enrollments` | Inscripciones estudiante-objetivo. Valida el objetivo contra `catalog`. | PostgreSQL (esquema `enrollments`) | 18092 |

La autorización se basa en JWT/OIDC. El rol `admin` gobierna las operaciones de
administración del catálogo; el resto de endpoints aplican autorización por
pertenencia (un estudiante solo accede a lo suyo).

## Puesta en marcha local

Requisitos: Go 1.25 o superior, Node.js 20 o superior, PostgreSQL 13 o superior.
Terraform es opcional (solo para validar la infraestructura).

Pasos resumidos (la guía detallada está en
[`docs/desarrollo-local.md`](docs/desarrollo-local.md)):

```bash
# 1. Crear las bases de datos de desarrollo y de pruebas
createdb certready_dev
createdb certready_test

# 2. Emisor OIDC de desarrollo (en una terminal aparte)
go run ./tools/oidc-mock

# 3. Migrar y arrancar un servicio (ejemplo: catalog)
cd services/catalog
export CATALOG_DATABASE_URL='postgres://postgres@localhost:5432/certready_dev?sslmode=disable'
go run ./cmd/migrate
go run ./cmd/server   # escucha en :8080 por defecto

# 4. Web (BFF)
cd web
cp .env.example .env.local   # ajustar URLs y SESSION_PASSWORD
npm install
npm run dev   # http://localhost:3000
```

## Pruebas

```bash
# Servicios y librería (desde la raíz del workspace)
go test ./...

# Pruebas de integración del repositorio (requieren PostgreSQL de pruebas)
export CATALOG_TEST_DATABASE_URL='postgres://postgres@localhost:5432/certready_test?sslmode=disable'
go test ./services/catalog/...

# Web
cd web && npm run check   # typecheck + lint + formato + pruebas
```

Las pruebas de los manejadores HTTP usan dobles en memoria y no requieren base
de datos. Las pruebas del repositorio se ejecutan contra un PostgreSQL real y se
omiten automáticamente si no se define la variable de conexión de pruebas.

## Despliegue

El despliegue objetivo es AWS, en la ruta de costo cero descrita arriba. La
infraestructura está en [`infra/`](infra/) (Terraform) y validada con
`terraform validate`. El despliegue real está pospuesto de forma deliberada
hasta disponer de una cuenta de AWS; mientras tanto el sistema se desarrolla y
verifica por completo en local. Los detalles y el procedimiento para activar el
despliegue están en [`infra/README.md`](infra/README.md).

## Estado del proyecto

El proyecto se construye por fases, cada una con un criterio de salida (DoD).

- **Fase 0 (Fundaciones):** completada. Estructura del repositorio, primer
  servicio Go, esqueleto de CI e infraestructura validada.
- **Fase 1 (Identidad y catálogo):** completada (backend + web): servicios
  `catalog`, `users` y `enrollments`, validación OIDC, módulo Cognito, y vistas
  web (login, catálogo con inscripción, panel del estudiante).
- **Fase 2 (Contenido y exámenes):** completada. Servicios `content` y `exams`;
  ruta de estudio, simulacro con formato real y repaso en la web.
- **Fase 3 (Entrevistas y juez de código):** completada. Servicios `problems` y
  `judge` (sandbox Docker endurecido); editor de código y banco de Q&A en la web.
- **Fase 4 (Analítica / OLAP):** backend completo. ETL Python → ClickHouse y
  capa semántica Cube.
- **Fase 5 (DSS / readiness):** backend completo. Estimación de preparación con
  IRT Rasch y recomendador de CV (embeddings), expuestos en la web.
- **Fase 6 (Móvil — Flutter):** en curso. Incrementos 1 y 2 hechos (paridad con
  la web: estudiar, catálogo, exámenes, entrevistas, progreso y recomendador).
  Pendiente: pulido visual, login Cognito nativo, push, iOS y release a tiendas.
- **Fase 7 (Endurecimiento y producción):** planeada (revisión de seguridad,
  afinado de infraestructura y despliegue en AWS, hoy diferido por costo).

> El **MVP web** está completo y sólido; el backend de las Fases 1–5 está
> verificado en local. El despliegue en AWS está escrito en Terraform pero
> pospuesto a propósito (operar a costo cero). El pulido fino de UI es continuo.

El detalle de lo hecho y lo pendiente está en
[`docs/estado-roadmap.md`](docs/estado-roadmap.md), y la bitácora cronológica de
decisiones en [`docs/BITACORA.md`](docs/BITACORA.md).

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [`docs/arquitectura-y-fases-certready.md`](docs/arquitectura-y-fases-certready.md) | Arquitectura, ADR y plan de fases (fuente canónica). |
| [`docs/estado-roadmap.md`](docs/estado-roadmap.md) | Qué está hecho y qué falta, orientado a quien se incorpora. |
| [`docs/desarrollo-local.md`](docs/desarrollo-local.md) | Cómo levantar el entorno completo en local. |
| [`docs/fase-1-diseno.md`](docs/fase-1-diseno.md) | Diseño detallado de la fase 1 (datos, contratos, auth). |
| [`docs/BITACORA.md`](docs/BITACORA.md) | Registro cronológico de avance y decisiones. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Convenciones de código, flujo de trabajo y cómo añadir servicios. |

## Contribuir

Antes de enviar cambios, revisa [`CONTRIBUTING.md`](CONTRIBUTING.md): cubre los
principios de arquitectura, las convenciones por lenguaje, el formato de los
commits y los requisitos de pruebas.

## Licencia

Todos los derechos reservados. Este repositorio no incluye una licencia de uso;
el código es propietario salvo acuerdo explícito por escrito.
