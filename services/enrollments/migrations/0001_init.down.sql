-- Migración 0001 (down) — revierte el esquema enrollments.

drop table if exists enrollments.inscripciones;
drop schema if exists enrollments cascade;
