# Guía de contribución

Esta guía recoge los principios, convenciones y el flujo de trabajo del
repositorio. Léela antes de tu primer cambio. La arquitectura y el plan de fases
viven en [`docs/arquitectura-y-fases-certready.md`](docs/arquitectura-y-fases-certready.md);
el estado actual, en [`docs/estado-roadmap.md`](docs/estado-roadmap.md).

## Principios de arquitectura

Estos principios no son negociables y explican la mayoría de las decisiones del
repositorio:

1. **La herramienta correcta para cada trabajo.** Ninguna tecnología entra por
   inercia ni por preferencia personal. Cada una se justifica por su encaje.
2. **Políglota con disciplina.** Un único lenguaje de servicios (Go). Se
   introduce otro lenguaje solo cuando hay una razón técnica real. Menos
   lenguajes significa menos pipelines, runtimes y superficie que mantener.
3. **Python solo en la capa de datos.** ETL, OLAP y DSS. Nunca en los servicios
   de aplicación ni en la ruta del cliente.
4. **Seguridad por diseño.** OIDC/JWT, RBAC, autorización a nivel de objeto,
   secretos fuera del código, validación de entrada y consultas parametrizadas
   desde el primer día.
5. **Separación de responsabilidades.** Los datos operativos se separan de los
   analíticos. El cliente nunca habla directamente con la base de datos.
6. **Realista y desplegable.** Todo en contenedores o funciones, IaC, CI y
   observabilidad. El objetivo es producción, no maqueta.

## Flujo de trabajo

El proyecto se construye **por fases**. Cada fase tiene entregables y un criterio
de salida (Definition of Done); no se avanza de fase sin cumplirlo. Las fases se
descomponen en incrementos pequeños y verificables.

Para un cambio concreto:

1. Crea una rama desde `main` (`feat/...`, `fix/...`, `chore/...`).
2. Implementa el cambio acotado a un incremento verificable.
3. Ejecuta lint y pruebas en local antes de hacer commit.
4. Abre un Pull Request hacia `main`. La CI debe quedar en verde.
5. Tras revisión y aprobación, integra.

No se hace push directo a `main`.

## Convenciones por lenguaje

### Go (`services/`, `libs/`, `judge/`, `tools/`)

- Formato con `gofmt` (obligatorio). `go vet` y `golangci-lint` sin hallazgos
  antes de commit. Pruebas con `go test ./...`.
- Cada servicio es su propio módulo (`go.mod` propio). El workspace (`go.work`)
  los enlaza localmente.
- Solo biblioteca estándar salvo razón técnica real; si se añade una
  dependencia, se justifica en el PR y en la bitácora.
- Errores envueltos con `%w` y contexto. No se descartan errores en silencio.
- Logging estructurado con `log/slog`. Nada de `fmt.Println` en servicios.
- Configuración por entorno (12-factor). Cero secretos en el código.
- Concurrencia con `context.Context` propagado. Apagado ordenado en todo servidor.

Estructura estándar de un servicio:

```
services/<nombre>/
├── cmd/server/    Punto de entrada HTTP (local y ruta Fargate)
├── cmd/lambda/    Punto de entrada AWS Lambda (ruta de costo cero)
├── cmd/migrate/   Aplica las migraciones y termina
├── internal/
│   ├── <dominio>/ Tipos de dominio y validación
│   ├── store/     Repositorio Postgres (pgx) y migraciones
│   ├── config/    Configuración desde el entorno
│   └── httpapi/   Router, manejadores e interfaz del store
├── migrations/    Archivos SQL embebidos (0001_init.up.sql, .down.sql)
├── Dockerfile     Imagen de contenedor (ruta Fargate)
└── Makefile       fmt / vet / test / migrate / build-lambda
```

### TypeScript (`web/`)

- TypeScript estricto. Lint con ESLint (`next/core-web-vitals`,
  `next/typescript`) y formato con Prettier. Pruebas con Vitest.
- La web sigue el patrón **BFF**: el navegador solo habla con la web; las rutas
  `/api/*` leen la sesión cifrada y proxean a los servicios Go inyectando el
  token. El token OIDC nunca llega al navegador.
- `npm run check` (typecheck, lint, formato y pruebas) debe pasar antes de commit.

### Python (`data/`)

- Cuando llegue la capa de datos: formato con `black`, lint con `ruff`, type
  hints obligatorios y pruebas con `pytest`. Python queda restringido a esta capa.

### SQL y migraciones

- Migraciones versionadas y embebidas en el binario (`embed.FS`), aplicadas por
  el runner compartido `libs/platform/pgmigrate`. Nomenclatura
  `NNNN_descripcion.up.sql` / `.down.sql`.
- Un esquema de PostgreSQL por servicio (`catalog`, `users`, `enrollments`). Los
  servicios no comparten tablas; las referencias entre servicios son lógicas.
- **Todas** las consultas son parametrizadas. No se concatena entrada del usuario
  en SQL.

## Commits

- Commits convencionales: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
  `test:`. El asunto describe el cambio en imperativo.
- Ejecuta lint y pruebas antes de cada commit.

## API y seguridad

- REST/JSON versionado bajo `/v1`. Todo servicio expone `GET /v1/health` y
  `GET /v1/ready`.
- Valida y sanea toda la entrada en el borde.
- Autorización a nivel de objeto en cada endpoint. La identidad del usuario se
  toma siempre del `sub` del token, nunca de un identificador del cliente
  (prevención de IDOR/BOLA).
- La validación de JWT comprueba firma, emisor, audiencia y expiración, y rechaza
  algoritmos no esperados.

## Documentación del código

Los comentarios son **documentación**, no narración del código. Se documenta cada
paquete y cada símbolo exportado. El estilo sigue una estructura cercana a la de
NumPy/SciPy, con secciones cuando aportan:

```go
// CalcularScore pondera los intentos de un examen y devuelve el puntaje [0,100].
//
// Parameters
//
//	intentos : intentos resueltos de la sesión.
//	pesos    : ponderación por dificultad; debe sumar 1.0.
//
// Returns
//
//	float64 : puntaje normalizado en el rango [0, 100].
//	error   : ErrPesosInvalidos si los pesos no suman 1.0.
```

Reglas: empezar el comentario con el nombre del símbolo (convención de godoc),
una frase de resumen, y secciones `Parameters`/`Returns` solo cuando aclaran. No
se comenta lo obvio ni se deja narración línea por línea.

## Pruebas

- `go test ./...` en verde antes de commit. Casos en tabla cuando aplique.
- Manejadores HTTP probados con `net/http/httptest` y dobles en memoria (sin base
  de datos).
- Repositorios probados contra un PostgreSQL real; estas pruebas se omiten si no
  se define la variable de conexión de pruebas correspondiente.
- La web verifica con `npm run check`.
