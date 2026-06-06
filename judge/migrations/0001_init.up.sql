-- Migración 0001 (up) — esquema y tabla del servicio judge (lado transaccional).
--
-- Los PROBLEMAS y sus casos de prueba viven en MongoDB (contenido heterogéneo,
-- §8). Aquí, en Postgres, vive lo transaccional (§7): las corridas (resultados de
-- calificación) que forman el historial del estudiante y alimentan la capa
-- analítica en la Fase 4.

create schema if not exists judge;

create table if not exists judge.corridas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null,
  problema_ref  text not null,                 -- ref lógica al problema en MongoDB
  lenguaje      text not null,
  veredicto     text not null,                 -- accepted | wrong_answer | ...
  casos_pasados integer not null,
  casos_total   integer not null,
  duracion_ms   integer not null,
  creado_en     timestamptz not null default now()
);

create index if not exists corridas_usuario_idx on judge.corridas (usuario_id);
create index if not exists corridas_problema_idx on judge.corridas (problema_ref);
