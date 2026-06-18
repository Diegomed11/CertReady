-- Migración 0003 (down) — revierte la denormalización de los intentos.

drop index if exists exams.intentos_usuario_tema_idx;

alter table exams.intentos
  drop column if exists dificultad,
  drop column if exists tema;
