-- Esquema dimensional de CertReady en ClickHouse (estrella "plana").
--
-- El hecho lleva los atributos de dimensión como columnas (las dimensiones son
-- lógicas y las define Cube). Es la forma idiomática en ClickHouse: evita joins
-- en el ETL y aprovecha el motor columnar. ReplacingMergeTree da idempotencia por
-- id ante una reejecución. El marcador {db} lo sustituye el cargador.
--
-- creado_en y el watermark usan DateTime64(6) (microsegundos): con DateTime (solo
-- segundos) el watermark se truncaría por debajo del instante real y el filtro
-- incremental "creado_en > watermark" reprocesaría las filas del mismo segundo.

create database if not exists {db};

create table if not exists {db}.fact_intento
(
    intento_id    String,
    usuario_id    String,
    certificacion LowCardinality(String),
    tema          LowCardinality(String),
    dificultad    LowCardinality(String),
    tipo_pregunta LowCardinality(String),
    modo          LowCardinality(String),
    fecha         Date,
    creado_en     DateTime64(6, 'UTC'),
    es_correcto   UInt8,
    intentos_n    UInt8 default 1
)
engine = ReplacingMergeTree
order by (fecha, certificacion, tema, usuario_id, intento_id);

create table if not exists {db}.fact_corrida
(
    corrida_id    String,
    usuario_id    String,
    problema_ref  String,
    area          LowCardinality(String),
    dificultad    LowCardinality(String),
    lenguaje      LowCardinality(String),
    veredicto     LowCardinality(String),
    aceptado      UInt8,
    casos_pasados UInt16,
    casos_total   UInt16,
    duracion_ms   UInt32,
    fecha         Date,
    creado_en     DateTime
)
engine = ReplacingMergeTree
order by (fecha, area, lenguaje, usuario_id, corrida_id);

create table if not exists {db}.fact_qa
(
    qa_id      String,
    usuario_id String,
    qa_ref     String,
    puesto     LowCardinality(String),
    area       LowCardinality(String),
    categoria  LowCardinality(String),
    nivel      UInt8,
    fecha      Date,
    creado_en  DateTime64(6, 'UTC')
)
engine = ReplacingMergeTree
order by (fecha, puesto, area, usuario_id, qa_id);

create table if not exists {db}.etl_estado
(
    fuente    String,
    ultimo_ts DateTime64(6, 'UTC')
)
engine = ReplacingMergeTree
order by (fuente);
