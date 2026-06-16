# Proyecto 4 (Libre) — CertReady: OLAP, ETL y Modelado dimensional

Documento de entrega. Demuestra que **CertReady** cumple los tres requisitos del
proyecto y reúne los diagramas pedidos: el **diagrama relacional** y el **diagrama
dimensional** de cada uno de los dos problemas (data marts), más el **diagrama de
flujo del proceso ETL**.

> Todos los diagramas están en **Mermaid** (se renderizan en GitHub y en VS Code
> con la extensión *Markdown Preview Mermaid*). El detalle de implementación vive
> en `data/etl/` (ETL), `data/etl/schema.sql` (ClickHouse) y `data/cube/` (capa
> semántica). Decisiones en ADR-12.

## 1. Cómo cumple los requisitos

| Requisito | En CertReady |
|-----------|--------------|
| **ETL** | `data/etl/` en Python: extrae los hechos nuevos de PostgreSQL, los enriquece con MongoDB, transforma (funciones puras) y carga en ClickHouse. **Incremental por watermark** e **idempotente** (ReplacingMergeTree). |
| **Modelado dimensional** | Esquema **estrella**: hechos `fact_intento` y `fact_corrida`; dimensiones (fecha, usuario, certificación, tema, dificultad, área, lenguaje, veredicto…) modeladas en **Cube**. Grano = una fila por evento atómico (un intento de pregunta / una corrida del juez). |
| **OLAP** | **ClickHouse** (motor columnar) como almacén analítico + **Cube** como capa semántica (medidas y dimensiones) que alimenta dashboards y el DSS de *readiness*. |

**Las dos fuentes operativas = los dos problemas (data marts):**

1. **Desempeño en exámenes** — cada intento de pregunta en un simulacro/práctica.
   Mide **acierto** por certificación, tema, dificultad y tiempo.
2. **Práctica de código (juez)** — cada corrida de código evaluada por el juez.
   Mide **tasa de aceptación**, casos pasados y duración por área y lenguaje.

---

## 2. Problema 1 — Desempeño en exámenes

### 2.1 Diagrama relacional (origen OLTP)

Lo transaccional vive en **PostgreSQL** (esquemas `catalog`, `exams`); el contenido
de las preguntas vive en **MongoDB** (colección `preguntas`). `pregunta_ref` es una
referencia lógica entre almacenes (el cliente nunca hace el join; lo resuelve el ETL).

```mermaid
erDiagram
  CERTIFICACIONES ||--o{ TEMAS : "tiene"
  SESIONES ||--o{ INTENTOS : "agrupa"
  PREGUNTAS ||--o{ INTENTOS : "ref lógica (pregunta_ref)"

  CERTIFICACIONES {
    uuid id PK
    text slug UK
    text nombre
    text proveedor
    text nivel
  }
  TEMAS {
    uuid id PK
    uuid certificacion_id FK
    text slug
    text nombre
    text dominio
    int  orden
  }
  SESIONES {
    uuid id PK
    uuid usuario_id
    text certificacion
    text modo
    text estado
    float puntaje
    timestamptz iniciado_en
    timestamptz finalizado_en
  }
  INTENTOS {
    uuid id PK
    uuid sesion_id FK
    uuid usuario_id
    text pregunta_ref
    bool correcto
    jsonb seleccion
    timestamptz creado_en
  }
  PREGUNTAS {
    string _id PK
    string certificacion
    string tema
    string dificultad
    string tipo
    string enunciado
  }
```

- `PREGUNTAS` es una **colección MongoDB** (esquema flexible); el resto son tablas
  PostgreSQL.
- El **hecho atómico** es `INTENTOS` (un intento por pregunta). `SESIONES` da el
  contexto (certificación, modo); `PREGUNTAS` aporta tema/dificultad/tipo.

### 2.2 Diagrama dimensional (estrella `fact_intento`)

Modelo en estrella: un hecho central rodeado de dimensiones. En ClickHouse se
implementa como **estrella plana** (las dimensiones se denormalizan como columnas
del hecho; Cube las expone como dimensiones lógicas), idiomático en un motor
columnar y sin joins en el ETL.

```mermaid
erDiagram
  DIM_FECHA          ||--o{ FACT_INTENTO : ""
  DIM_USUARIO        ||--o{ FACT_INTENTO : ""
  DIM_CERTIFICACION  ||--o{ FACT_INTENTO : ""
  DIM_TEMA           ||--o{ FACT_INTENTO : ""
  DIM_DIFICULTAD     ||--o{ FACT_INTENTO : ""
  DIM_TIPO_PREGUNTA  ||--o{ FACT_INTENTO : ""
  DIM_MODO           ||--o{ FACT_INTENTO : ""

  FACT_INTENTO {
    string intento_id PK
    date   fecha FK
    string usuario_id FK
    string certificacion FK
    string tema FK
    string dificultad FK
    string tipo_pregunta FK
    string modo FK
    uint8  es_correcto "medida"
    uint8  intentos_n "medida"
  }
  DIM_FECHA { date fecha }
  DIM_USUARIO { string usuario_id }
  DIM_CERTIFICACION { string certificacion }
  DIM_TEMA { string tema }
  DIM_DIFICULTAD { string dificultad }
  DIM_TIPO_PREGUNTA { string tipo_pregunta }
  DIM_MODO { string modo }
```

- **Grano:** un intento de pregunta.
- **Medidas:** `es_correcto` (0/1) e `intentos_n`. Cube deriva **`accuracy`** =
  `sum(es_correcto)/count()`.
- **Dimensiones:** fecha, usuario, certificación, tema, dificultad, tipo de
  pregunta y modo (simulacro/práctica).

---

## 3. Problema 2 — Práctica de código (juez)

### 3.1 Diagrama relacional (origen OLTP)

Las corridas (resultados de calificación) viven en **PostgreSQL** (`judge.corridas`);
la definición del problema (área, dificultad) vive en **MongoDB** (colección
`problemas`), referenciada por `problema_ref`.

```mermaid
erDiagram
  PROBLEMAS ||--o{ CORRIDAS : "ref lógica (problema_ref)"

  CORRIDAS {
    uuid id PK
    uuid usuario_id
    text problema_ref
    text lenguaje
    text veredicto
    int  casos_pasados
    int  casos_total
    int  duracion_ms
    timestamptz creado_en
  }
  PROBLEMAS {
    string _id PK
    string area
    string dificultad
    string titulo
    array  lenguajes_permitidos
  }
```

- **Hecho atómico:** `CORRIDAS` (una corrida evaluada por el juez).
- `veredicto` ∈ {accepted, wrong_answer, time_limit_exceeded, …}.

### 3.2 Diagrama dimensional (estrella `fact_corrida`)

```mermaid
erDiagram
  DIM_FECHA       ||--o{ FACT_CORRIDA : ""
  DIM_USUARIO     ||--o{ FACT_CORRIDA : ""
  DIM_PROBLEMA    ||--o{ FACT_CORRIDA : ""
  DIM_AREA        ||--o{ FACT_CORRIDA : ""
  DIM_DIFICULTAD  ||--o{ FACT_CORRIDA : ""
  DIM_LENGUAJE    ||--o{ FACT_CORRIDA : ""
  DIM_VEREDICTO   ||--o{ FACT_CORRIDA : ""

  FACT_CORRIDA {
    string corrida_id PK
    date   fecha FK
    string usuario_id FK
    string problema_ref FK
    string area FK
    string dificultad FK
    string lenguaje FK
    string veredicto FK
    uint8  aceptado "medida"
    uint16 casos_pasados "medida"
    uint16 casos_total "medida"
    uint32 duracion_ms "medida"
  }
  DIM_FECHA { date fecha }
  DIM_USUARIO { string usuario_id }
  DIM_PROBLEMA { string problema_ref }
  DIM_AREA { string area }
  DIM_DIFICULTAD { string dificultad }
  DIM_LENGUAJE { string lenguaje }
  DIM_VEREDICTO { string veredicto }
```

- **Grano:** una corrida del juez.
- **Medidas:** `aceptado` (0/1), `casos_pasados`, `casos_total`, `duracion_ms`.
  Cube deriva **`tasa_aceptacion`** = `sum(aceptado)/count()`.
- **Dimensiones:** fecha, usuario, problema, área, dificultad, lenguaje, veredicto.

---

## 4. Diagrama de flujo del proceso ETL

Una pasada del ETL (`python -m etl.run`) es **incremental** (solo lee lo nuevo
desde el *watermark*) e **idempotente** (reejecutar sin datos nuevos no cambia nada).

```mermaid
flowchart TD
  A([Inicio: python -m etl.run]) --> B[Leer watermark por fuente<br/>tabla etl_estado en ClickHouse]
  B --> C[/EXTRACT · PostgreSQL<br/>intentos + sesiones y corridas<br/>creado_en posterior al watermark/]
  C --> D{¿Hay filas nuevas?}
  D -- No --> Z([Fin: no-op])
  D -- Sí --> E[/EXTRACT · MongoDB<br/>preguntas → tema, dificultad, tipo<br/>problemas → área, dificultad/]
  E --> F[TRANSFORM · funciones puras<br/>denormaliza dimensiones · UTC<br/>deriva es_correcto / aceptado y fecha]
  F --> G[(LOAD · ClickHouse<br/>fact_intento / fact_corrida<br/>ReplacingMergeTree = idempotente)]
  G --> H[Avanzar watermark<br/>max creado_en por fuente]
  H --> I[[Cube: capa semántica<br/>medidas y dimensiones]]
  I --> J([Dashboards web y DSS de readiness])
```

**Pasos:**

1. **Watermark** — lee el último timestamp procesado por fuente (`intentos`,
   `corridas`) desde `etl_estado`.
2. **Extract (PostgreSQL)** — hechos nuevos: `exams.intentos ⋈ exams.sesiones` y
   `judge.corridas`, filtrando `creado_en > watermark` (consultas parametrizadas).
3. **Extract (MongoDB)** — enriquecimiento: `preguntas` (tema/dificultad/tipo) y
   `problemas` (área/dificultad), solo de las refs que aparecen en los hechos.
4. **Transform** — funciones **puras** (sin I/O, testeables): normaliza a UTC,
   denormaliza las dimensiones en el hecho, deriva `es_correcto`/`aceptado` y `fecha`.
5. **Load (ClickHouse)** — inserta en `fact_intento`/`fact_corrida`
   (`ReplacingMergeTree` → idempotente por id).
6. **Avanzar watermark** — guarda el `max(creado_en)` cargado por fuente.
7. **Cube** expone las medidas/dimensiones; los **dashboards** y el **DSS** las consumen.

---

## 5. Notas de diseño

- **Estrella plana (ClickHouse):** no se crean claves subrogadas ni tablas de
  dimensión físicas; el hecho denormaliza las dimensiones como columnas. Es el
  patrón idiomático en un motor columnar (evita joins, aprovecha `LowCardinality`).
  El modelo *lógico* sigue siendo una estrella (la que muestran los diagramas).
- **Tiempo:** columnas de tiempo en `DateTime64(6)` (microsegundos) para que el
  watermark no reprocese filas del mismo segundo. Todo en **UTC**.
- **Idempotencia:** `ReplacingMergeTree` ordena por el id del hecho; reinsertar la
  misma fila no duplica.
- **Separación políglota:** Python vive **solo** en la capa de datos (ETL/OLAP/DSS);
  los servicios de app (Go) producen los hechos; el cliente nunca toca el almacén.
