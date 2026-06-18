# Estado del proyecto y hoja de ruta

Documento orientado a quien se incorpora: qué está hecho, qué está en curso y qué
falta. El registro cronológico con el detalle de cada decisión está en
[`BITACORA.md`](BITACORA.md); el plan completo de fases y los criterios de salida
están en [`arquitectura-y-fases-certready.md`](arquitectura-y-fases-certready.md).

## Resumen

El **backend de las Fases 1–5 está completo y verificado** en local (pruebas
unitarias y de integración contra Postgres, MongoDB y ClickHouse reales). Sobre él,
el **frontend web (MVP) está construido y en forma sólida**: landing, login OIDC,
catálogo, panel tipo app, ruta de estudio con lector de hojas y quizzes,
simulacros con formato real, entrevistas con editor de código y juez, y progreso.
El despliegue en AWS está escrito en Terraform y validado, pero **pospuesto** de
forma deliberada (operar a costo cero hasta tener presupuesto); el desarrollo
ocurre por completo en local. Pendientes mayores: **dashboards de analítica** en la
web, **Fase 6 (móvil Flutter)** y **Fase 7 (endurecimiento + producción)**, más el
pulido fino de UI.

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
- **Login/registro nativo (local):** el emisor local hace de IdP con store en
  Postgres (`idp_users`, bcrypt) y endpoints `POST /register` y `/login`; web y
  móvil tienen formularios propios (no redirect). $0 local; en prod = API de
  Cognito. Admin por grupos (`OIDC_MOCK_ADMIN_EMAILS`). Detalle en la bitácora.
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

El **frontend** de esta fase ya está construido (ver "Frontend — experiencia de
estudio SAA-C03" más abajo): ruta de estudio, simulacro con formato real y repaso.

## Fase 3 — Entrevistas y juez de código (backend construido)

- **Servicio `problems`** (Go + MongoDB): banco de **problemas** tipo LeetCode
  (con casos de prueba ocultos y límites) y banco de **Q&A** por puesto/área.
  Lectura pública con anti-fuga (nunca expone casos ocultos) y creación admin.
- **Servicio `judge`** (Go + Docker + MongoDB + PostgreSQL): el subsistema de
  mayor riesgo. Ejecuta código no confiable en **contenedores Docker efímeros
  endurecidos** (sin red, FS de solo lectura, límites de CPU/memoria/PIDs/tiempo,
  sin privilegios), califica contra los casos del problema y registra la ejecucion.
  Primer lenguaje: Python (interfaz `Runner` extensible). Decisiones en ADR-11.

Verificado de extremo a extremo: build y pruebas de los diez módulos, calificación,
persistencia (con BOLA) y API (RBAC y anti-fuga), e2e en vivo de `problems`, y
—con Docker— la **suite de escape del sandbox** (red, FS, fork-bomb, memoria,
tiempo) y el **e2e en vivo del juez** (accepted / wrong sin fuga / TLE / 401 /
BOLA). El juez se despliega en **Fargate** (no Lambda).

El **frontend** de esta fase ya está construido: lista de problemas con **editor de
código** que corre contra los casos vía el juez, y banco de **Q&A** por puesto/área
(ver la sección "Frontend").

## Fase 4 — Capa analítica / OLAP (backend construido)

- **`data/`** (Python, única capa con Python): ETL que lleva los hechos operativos
  (`exams.intentos`, `judge.ejecuciones`) a un **modelo dimensional en ClickHouse**
  (estrella plana: `fact_intento`, `fact_ejecucion`), enriquecidos desde MongoDB.
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

## Frontend (web Next.js) — MVP completo y sólido

La web (patrón BFF, App Router) cubre toda la experiencia del estudiante para **AWS
Solutions Architect Associate (SAA-C03)**, con contenido **original**, clave
canónica = **slug** (sin UUIDs visibles) e identidad de marca propia (sin logos
oficiales):

- **Landing** con escenas **3D (Three.js)** por sección; degrada a ilustraciones
  SVG si no hay WebGL.
- **Autenticación** OIDC (login/callback) y **catálogo** de certificaciones con
  inscripción.
- **Panel** tipo app con **sidebar** de navegación: inscripciones con su avance y
  gamificación moderada (racha y meta semanal **derivadas de lecciones reales**,
  último simulacro).
- **Estudiar** como **ruta de aprendizaje** (tipo Duolingo): 12 temas por los 4
  dominios (Seguridad 30%, Resiliencia 26%, Rendimiento 24%, Costos 20%), estados
  bloqueado/disponible/completado; cada tema con **lector de hojas paginado**
  (material original ampliado, 4 hojas/tema) + **mini-quiz** (6 preguntas
  **alineadas a las hojas**) que desbloquea el siguiente tema.
- **Servicio `progress`** (Go + PostgreSQL, nuevo) que respalda el avance por tema.
- **Exámenes**: **simulacro con formato real** (65 preguntas, 720/1000 ≈ 72%,
  opción y respuesta múltiple, **muestreo ponderado por dominio** 30/26/24/20 y
  **rotatorio**, con **desglose por sección**). El historial lista solo simulacros.
- **Entrevistas**: lista de problemas con **editor de código** evaluado por el
  **juez** (sandbox Docker), y banco de **Q&A** por puesto/área.
- **Progreso**: avance real (temas aprobados, mejor/último simulacro, por dominio)
  y **dashboards de analítica** (acierto por dominio en simulacros, vía el DSS); la
  estimación IRT del DSS es un extra opcional (no bloquea la vista).
- **Mi camino** (recomendador): el usuario sube su CV (PDF/DOCX) y el DSS detecta
  su perfil con **embeddings locales (ONNX)** y propone los mejores caminos de
  certificación. El CV no se persiste (ADR-14).
- **Rendimiento**: la web corre en **build de producción** (`next start`) en el
  stack local para respuesta ágil.

Calidad: `npm run check` (typecheck + lint + formato + tests) y `npm run build` en
verde. La verificación en vivo se hace con el stack completo (`scripts/dev-up.ps1`).

## En curso / inmediato

Backend de las Fases 1–5 y el **MVP web** completos y verificados (local, sin
costo). El frontend está en forma **sólida**; el pulido fino de UI queda como
trabajo continuo. Próximos pasos posibles (a decidir con el responsable):
**dashboards de analítica** (Cube/DSS) en la web, **Fase 6 (móvil Flutter)** o
**Fase 7 (endurecimiento, pentesting y despliegue a producción)**.

## Planeado

- **Más analítica en la web.** Ya están el acierto por dominio + el recomendador
  de CV (DSS), la **preparación por puesto** (el DSS combina exámenes + código + Q&A
  y estima qué tan listo estás para un rol; web `/preparacion` y móvil `/preparacion`)
  y un **catálogo de ~50 certificaciones** (AWS/Azure/GCP + otras) con camino, estudio
  y quiz (contenido ligero, se refina cert por cert). Falta surfacear más medidas de
  Cube (tendencias, comparativas) y **refinar/profundizar** el contenido de las certs
  nuevas (hoy `aws-saa` es la única profunda), además de pesos de simulacro y corte de
  aprobación por cert.
- **Pulido de UI/UX.** Refinamiento visual y de interacción sobre el MVP.
- **Fase 6 — Móvil (en curso).** App **Flutter** en `mobile/` consumiendo las mismas
  APIs Go `/v1` (sin BFF móvil). **Incrementos 1, 2 y 3 hechos**: fundación (config, dio,
  modelos, auth OIDC+PKCE por HTTP, Riverpod + go_router) + **paridad de módulos**:
  Estudiar (ruta + lector + quiz), Catálogo+inscripción, Panel, **Exámenes** (simulacro +
  historial + repaso), **Entrevistas** (banco de Q&A; los problemas de código se quitaron
  del móvil), **Progreso** (readiness + acierto por tema) y **Mi camino** (recomendador por
  CV: **subir PDF/DOC** con `file_picker`, o pegar texto). **Inc. 3 — pulido visual**:
  fuentes de marca (Fredoka/Nunito), tema afinado, y animaciones con `flutter_animate`
  (entradas escalonadas, Hero, gauge/barras animadas, reveal de resultados). Q&A ahora
  respondibles (escribe → ver respuesta modelo). Corre en Android; en Windows requiere
  Modo de desarrollador (por `file_picker`). `analyze` verde.
  Falta: login Cognito nativo, push, **iOS** y release a tiendas.
- **Fase 7 — Endurecimiento, pentesting y producción.** Revisión de seguridad,
  afinado de la infraestructura y **despliegue en AWS** (hoy diferido por costo).

## Pendientes transversales

- **Despliegue en AWS:** pospuesto por decisión (operar sin costo mientras no haya
  presupuesto). El código de servicios y la infraestructura están listos para
  activarse; el procedimiento está en [`infra/README.md`](../infra/README.md).
- **CI:** el pipeline está escrito; el despliegue automático se activa cuando
  exista la cuenta de AWS y el repositorio remoto.
- **`mobile/`:** ya iniciada (Fase 6, incremento 1 — núcleo de estudio en Flutter);
  el resto de la paridad y el release a tiendas son incrementos siguientes.
- **Contenido y marcas:** se opta por el camino seguro (contenido original o con
  licencia abierta; sin logos oficiales, identidad propia). Los avisos legales a
  publicar antes de lanzar (disclaimer de marcas, política de contenido,
  atribuciones, Términos y Privacidad) están en
  [`contenido-y-marcas.md`](contenido-y-marcas.md).
