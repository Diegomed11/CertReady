-- Migración 0001 (up) — esquema y tablas del servicio users.
-- usuarios.id NO se autogenera: es el `sub` del JWT (Cognito), clave estable
-- de la identidad. El servicio crea la fila en el primer login (provisión JIT).

create schema if not exists users;

create table if not exists users.usuarios (
  id             uuid primary key,
  email          text not null unique,
  nombre         text,
  rol            text not null default 'estudiante' check (rol in ('estudiante', 'admin')),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists users.perfiles (
  usuario_id     uuid primary key references users.usuarios (id) on delete cascade,
  bio            text,
  pais           text,
  avatar_url     text,
  actualizado_en timestamptz not null default now()
);
