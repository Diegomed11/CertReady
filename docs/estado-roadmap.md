# Estado del proyecto y hoja de ruta

Documento orientado a quien se incorpora: qué está hecho, qué está en curso y qué
falta. El registro cronológico con el detalle de cada decisión está en
[`BITACORA.md`](BITACORA.md); el plan completo de fases y los criterios de salida
están en [`arquitectura-y-fases-certready.md`](arquitectura-y-fases-certready.md).

## Resumen

La fase 1 está completa: identidad y catálogo, backend y web. Todo el backend
está implementado y verificado en local contra PostgreSQL real (pruebas
unitarias y de integración), y la web (patrón BFF) se verificó de extremo a
extremo con el stack completo levantado: login OIDC, inscripción y panel del
estudiante. El despliegue en AWS está escrito en Terraform y validado, pero
pospuesto de forma deliberada hasta disponer de cuenta; el desarrollo ocurre por
completo en local. El siguiente paso es la fase 2.

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
- **Web (Next.js, patrón BFF):** fundación (autenticación OIDC con PKCE, sesión
  cifrada, cliente HTTP tipado de los servicios) y vistas completas: inicio de
  sesión y callback, catálogo de certificaciones con inscripción, y panel del
  estudiante con sus inscripciones. Verificada de extremo a extremo con el stack
  completo en local.

Con esto se cumple el criterio de salida de la fase 1: el estudiante se registra,
elige varias certificaciones y ve su panel.

## Fase 2 — Contenido y exámenes (backend completo)

- **Servicio `content`** (Go + MongoDB): material de estudio, con lecturas
  públicas y creación administrada. Primer servicio sobre MongoDB.
- **Servicio `exams`** (Go + MongoDB + PostgreSQL): banco de preguntas en Mongo;
  simulacros, calificación e intentos en Postgres. Ciclo "simulacro → score →
  repaso" para preguntas de opción múltiple. Verificado de extremo a extremo en
  local (creación de preguntas, examen sin fuga de respuestas, calificación,
  repaso, control de reintento).

Pendiente de la fase: el **frontend** (estudiar, presentar simulacro, repasar),
pospuesto por decisión hasta hacer un pase de diseño único más adelante.

## Fase 3 — Entrevistas y juez de código (backend construido)

- **Servicio `problems`** (Go + MongoDB): banco de **problemas** tipo LeetCode
  (con casos de prueba ocultos y límites) y banco de **Q&A** por puesto/área.
  Lectura pública con anti-fuga (nunca expone casos ocultos) y creación admin.
- **Servicio `judge`** (Go + Docker + MongoDB + PostgreSQL): el subsistema de
  mayor riesgo. Ejecuta código no confiable en **contenedores Docker efímeros
  endurecidos** (sin red, FS de solo lectura, límites de CPU/memoria/PIDs/tiempo,
  sin privilegios), califica contra los casos del problema y registra la corrida.
  Primer lenguaje: Python (interfaz `Runner` extensible). Decisiones en ADR-11.

Verificado de extremo a extremo: build y pruebas de los diez módulos, calificación,
persistencia (con BOLA) y API (RBAC y anti-fuga), e2e en vivo de `problems`, y
—con Docker— la **suite de escape del sandbox** (red, FS, fork-bomb, memoria,
tiempo) y el **e2e en vivo del juez** (accepted / wrong sin fuga / TLE / 401 /
BOLA). El juez se despliega en **Fargate** (no Lambda).

Pendiente de la fase: el **frontend** (editor de código + correr contra casos),
pospuesto con el resto del front.

## Fase 4 — Capa analítica / OLAP (backend construido)

- **`data/`** (Python, única capa con Python): ETL que lleva los hechos operativos
  (`exams.intentos`, `judge.corridas`) a un **modelo dimensional en ClickHouse**
  (estrella plana: `fact_intento`, `fact_corrida`), enriquecidos desde MongoDB.
  Incremental por watermark e idempotente.
- **Cube**: capa semántica sobre ClickHouse con medidas (`accuracy`,
  `tasa_aceptacion`, …) y dimensiones, expuesta como API. Decisiones en ADR-12.

Verificado de extremo a extremo: `ruff`/`black`/`pytest`; integración contra
ClickHouse real; **ETL en vivo** (Postgres+Mongo→ClickHouse) con `accuracy` y
`tasa_aceptacion` correctas e idempotencia; y la **API de Cube** coincidiendo con
ClickHouse. ClickHouse y Cube corren en **Docker local**; la nube, las
pre-agregaciones, la orquestación y los **dashboards web** quedan diferidos.

## Fase 5 — DSS / readiness (backend construido)

- **`data/dss/`** (FastAPI, capa de datos): estima la preparación del estudiante
  con **IRT Rasch (1PL) calibrado por población** (numpy puro). Expone
  `readiness`, `probabilidad_aprobar`, dominio por celda y **siguiente mejor
  acción** vía `GET /v1/readiness/{usuario_id}?certificacion=...`. Lee de
  ClickHouse. Decisiones en ADR-13.

Verificado: `ruff`/`black`/`pytest` (modelo puro); integración con ClickHouse
(estudiante fuerte > débil) vía `TestClient`; y **e2e en vivo** con uvicorn
(readiness y probabilidad sensatas, 404 sin historial). La integración en el panel
del estudiante (frontend) queda diferida.

## En curso / inmediato

Backend de las Fases 1–5 completo y verificado (todo en local, sin costo). El
siguiente paso natural es retomar el **frontend** (panel, dashboards y readiness de
las fases 1–5) con un pase de diseño, o avanzar a **Fase 6 (móvil)** / **Fase 7
(endurecimiento, pentesting y producción)**.

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
