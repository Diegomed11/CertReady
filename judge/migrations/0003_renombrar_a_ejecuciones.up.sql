-- Migración 0003 (up) — renombra judge.corridas a judge.ejecuciones.
--
-- "Corrida" se renombró a "ejecución" en todo el sistema. Las migraciones 0001 y
-- 0002 conservan el nombre histórico (corrieron contra esa tabla); esta la lleva
-- al nombre final, junto con sus índices. pgmigrate registra la versión, así que
-- no se reaplica.

alter table if exists judge.corridas rename to ejecuciones;

alter index if exists judge.corridas_usuario_idx      rename to ejecuciones_usuario_idx;
alter index if exists judge.corridas_problema_idx     rename to ejecuciones_problema_idx;
alter index if exists judge.corridas_usuario_area_idx rename to ejecuciones_usuario_area_idx;
