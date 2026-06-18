-- Migración 0003 (down) — revierte el renombrado a judge.corridas.

alter table if exists judge.ejecuciones rename to corridas;

alter index if exists judge.ejecuciones_usuario_idx      rename to corridas_usuario_idx;
alter index if exists judge.ejecuciones_problema_idx     rename to corridas_problema_idx;
alter index if exists judge.ejecuciones_usuario_area_idx rename to corridas_usuario_area_idx;
