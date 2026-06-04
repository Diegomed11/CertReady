# Estado del proyecto y hoja de ruta

Documento orientado a quien se incorpora: qué está hecho, qué está en curso y qué
falta. El registro cronológico con el detalle de cada decisión está en
[`BITACORA.md`](BITACORA.md); el plan completo de fases y los criterios de salida
están en [`arquitectura-y-fases-certready.md`](arquitectura-y-fases-certready.md).

## Resumen

El proyecto está al final de la fase 1. Toda la base del backend de identidad y
catálogo está implementada y verificada en local contra PostgreSQL real, con
pruebas unitarias y de integración. La aplicación web tiene lista su fundación
(patrón BFF, autenticación OIDC, cliente de los servicios) y faltan las vistas.
El despliegue en AWS está escrito en Terraform y validado, pero pospuesto de
forma deliberada hasta disponer de cuenta; el desarrollo ocurre por completo en
local.

## Completado

### Fase 0 — Fundaciones

- Estructura del monorepo y convenciones de trabajo.
- Servicio Go de referencia (`health`) con configuración 12-factor, logging
  estructurado, apagado ordenado y sondas de salud.
- Esqueleto de CI en GitHub Actions (lint, pruebas y empaquetado por servicio).
- Infraestructura en Terraform validada: módulos de la ruta de costo cero
  (Lambda + Function URL, OIDC para despliegue) y de la ruta de producción
  parqueada (red, ECS, ECR, IAM, Secrets).

### Fase 1 — Identidad y catálogo (backend)

- **Librería compartida `libs/platform`:** configuración, logging, kit HTTP
  (middleware, sondas de salud, utilidades JSON), pool de PostgreSQL, validación
  OIDC y runner de migraciones.
- **Servicio `catalog`:** certificaciones, temas y pistas de entrevista.
  Consultas parametrizadas, migraciones embebidas, lecturas públicas y creación
  protegida por rol `admin`.
- **Servicio `users`:** identidad de aplicación y perfiles. Provisión del usuario
  en el primer acceso a partir de los datos del token. `GET /v1/me` y edición del
  perfil propio.
- **Servicio `enrollments`:** inscripciones del estudiante a objetivos del
  catálogo. Valida la existencia del objetivo contra `catalog`. Autorización por
  pertenencia (un estudiante solo accede a sus inscripciones).
- **Autenticación:** validación de JWT/OIDC agnóstica del emisor (Cognito en
  producción, emisor local en desarrollo), con RBAC. Prevención de IDOR/BOLA y de
  manipulación de tokens cubierta por diseño y por pruebas.
- **Infraestructura de Cognito** escrita en Terraform y validada (User Pool, App
  Client con PKCE, grupos de roles, Hosted UI). Parqueada hasta el despliegue.
- **Web (incremento inicial):** fundación del BFF en Next.js. Autenticación OIDC
  con PKCE, sesión cifrada, cliente HTTP tipado de los servicios y rutas de auth.
  Sin vistas todavía.

## En curso / inmediato

Vistas de la aplicación web (fase 1):

- Pantalla de inicio de sesión y callback.
- Vista de catálogo: listar certificaciones e inscribirse.
- Panel del estudiante: datos de la cuenta e inscripciones.

Criterio de salida de la fase 1: el estudiante se registra, elige varias
certificaciones y ve su panel.

## Planeado

Según el plan de fases del documento de arquitectura:

- **Fase 2 — Contenido y exámenes.** Esquemas de contenido y preguntas en
  MongoDB. Servicio de contenido y servicio de exámenes (banco de preguntas,
  simulacros cronometrados, scoring, registro de intentos). Flujo completo de
  estudio y simulacro en la web.
- **Fase 3 — Entrevistas y juez de código.** Subsistema de ejecución de código en
  sandbox aislado, sin red y con límites estrictos. Problemas y casos de prueba
  en MongoDB. Editor de código en la web.
- **Fase 4 — Capa analítica (OLAP).** ETL en Python de los intentos a un esquema
  estrella en ClickHouse, capa semántica con Cube y dashboards de desempeño.
- **Fase 5 — DSS (readiness).** Estimación de preparación y recomendación de la
  siguiente acción a partir del modelo dimensional.
- **Fase 6 — Móvil.** Aplicación Flutter consumiendo las mismas APIs.
- **Fase 7 — Endurecimiento, pentesting y producción.** Revisión de seguridad,
  afinado de la infraestructura y despliegue en producción.

## Pendientes transversales

- **Despliegue en AWS:** pospuesto por decisión (operar sin costo mientras no haya
  presupuesto). El código de servicios y la infraestructura están listos para
  activarse; el procedimiento está en [`infra/README.md`](../infra/README.md).
- **CI:** el pipeline está escrito; el despliegue automático se activa cuando
  exista la cuenta de AWS y el repositorio remoto.
- **Capas `judge/`, `data/` y `mobile/`:** marcadores de carpeta; se materializan
  en sus fases correspondientes.
