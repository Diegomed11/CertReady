-- Migración 0001 (down) — revierte el esquema exams.

drop table if exists exams.intentos;
drop table if exists exams.sesiones;
drop schema if exists exams cascade;
