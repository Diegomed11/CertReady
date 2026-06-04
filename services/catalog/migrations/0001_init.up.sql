-- Migración 0001 (up) — esquema y tablas base del servicio catalog.
-- gen_random_uuid() es parte del núcleo de PostgreSQL desde la versión 13
-- (no requiere la extensión pgcrypto ni privilegios de superusuario).

create schema if not exists catalog;

create table if not exists catalog.certificaciones (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  nombre         text not null,
  proveedor      text not null,
  nivel          text not null,
  descripcion    text,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists catalog.temas (
  id               uuid primary key default gen_random_uuid(),
  certificacion_id uuid not null references catalog.certificaciones (id) on delete cascade,
  slug             text not null,
  nombre           text not null,
  dominio          text,
  orden            int not null default 0,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (certificacion_id, slug)
);

create table if not exists catalog.pistas_entrevista (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  puesto         text not null,
  area           text not null,
  nombre         text not null,
  descripcion    text,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists temas_certificacion_id_idx on catalog.temas (certificacion_id);
