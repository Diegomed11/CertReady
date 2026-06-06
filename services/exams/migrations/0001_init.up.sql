-- Migración 0001 (up) — esquema y tablas del servicio exams (lado transaccional).
--
-- Las PREGUNTAS viven en MongoDB (contenido heterogéneo, §8). Aquí, en Postgres,
-- vive lo transaccional (§7): las sesiones de examen y los intentos por pregunta,
-- que son la fuente operativa que alimentará la capa analítica en la Fase 4.

create schema if not exists exams;

create table if not exists exams.sesiones (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null,
  certificacion text not null,
  modo          text not null default 'simulacro' check (modo in ('simulacro', 'practica')),
  estado        text not null default 'en_curso' check (estado in ('en_curso', 'finalizada')),
  puntaje       double precision,              -- [0,100]; null hasta finalizar
  preguntas     jsonb not null,                -- refs de las preguntas incluidas, en orden
  iniciado_en   timestamptz not null default now(),
  finalizado_en timestamptz
);

create table if not exists exams.intentos (
  id           uuid primary key default gen_random_uuid(),
  sesion_id    uuid not null references exams.sesiones (id) on delete cascade,
  usuario_id   uuid not null,
  pregunta_ref text not null,                  -- ref lógica a la pregunta en MongoDB
  correcto     boolean not null,
  seleccion    jsonb not null,                 -- opciones elegidas por el estudiante
  creado_en    timestamptz not null default now()
);

create index if not exists sesiones_usuario_idx on exams.sesiones (usuario_id);
create index if not exists intentos_sesion_idx on exams.intentos (sesion_id);
