-- Migración 0001 (up) — esquema y tabla del servicio enrollments.
--
-- Inscripción = vínculo estudiante ↔ objetivo. Refs lógicas a users.usuarios y a
-- catalog.{certificaciones,pistas_entrevista} (ADR-09): sin FKs entre servicios.
-- La existencia del objetivo se valida llamando a catalog antes de insertar.

create schema if not exists enrollments;

create table if not exists enrollments.inscripciones (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null,
  tipo_objetivo text not null check (tipo_objetivo in ('certificacion', 'pista')),
  objetivo_id   uuid not null,
  estado        text not null default 'activa'
                  check (estado in ('activa', 'pausada', 'completada', 'archivada')),
  creado_en     timestamptz not null default now(),
  unique (usuario_id, tipo_objetivo, objetivo_id)
);

create index if not exists inscripciones_usuario_id_idx on enrollments.inscripciones (usuario_id);
