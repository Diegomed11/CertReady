-- Migración 0001 (down) — revierte el esquema users.

drop table if exists users.perfiles;
drop table if exists users.usuarios;
drop schema if exists users cascade;
