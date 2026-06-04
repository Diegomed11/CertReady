-- Migración 0001 (down) — revierte el esquema catalog.
-- Solo se usa en tests y en rollbacks manuales; el runner aplica únicamente up.

drop table if exists catalog.temas;
drop table if exists catalog.pistas_entrevista;
drop table if exists catalog.certificaciones;
drop schema if exists catalog cascade;
