-- Migración 0001 (up) — esquema y tablas del servicio progress.
--
-- Progreso de estudio por usuario. Refs lógicas a users.usuarios y a las claves
-- (slug) de certificación/tema del catálogo y del contenido (ADR-09): sin FKs
-- entre servicios. El grano es (usuario, certificación, tema).

create schema if not exists progress;

-- Una fila por lección (material) que el usuario marcó como leída.
create table if not exists progress.lecciones (
  usuario_id    uuid not null,
  certificacion text not null,
  tema          text not null,
  material_id   text not null,
  creado_en     timestamptz not null default now(),
  primary key (usuario_id, material_id)
);

create index if not exists lecciones_usuario_cert_idx
  on progress.lecciones (usuario_id, certificacion);

-- Mejor resultado del quiz de cada tema (aprobado pegajoso una vez logrado).
create table if not exists progress.temas (
  usuario_id     uuid not null,
  certificacion  text not null,
  tema           text not null,
  quiz_puntaje   real not null default 0,
  quiz_aprobado  boolean not null default false,
  actualizado_en timestamptz not null default now(),
  primary key (usuario_id, certificacion, tema)
);

create index if not exists temas_usuario_cert_idx
  on progress.temas (usuario_id, certificacion);
