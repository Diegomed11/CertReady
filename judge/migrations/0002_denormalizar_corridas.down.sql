-- Migración 0002 (down) — revierte la denormalización de las corridas.

drop index if exists judge.corridas_usuario_area_idx;

alter table judge.corridas
  drop column if exists area;
