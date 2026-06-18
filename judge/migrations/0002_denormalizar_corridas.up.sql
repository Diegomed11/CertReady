-- Migración 0002 (up) — denormaliza el área del problema en las corridas.
--
-- Mueve la analítica por-usuario al plano OPERATIVO (Go en tiempo real, sin OLAP):
-- "problemas resueltos por área" se calcula directo de Postgres. El problema ya
-- está cargado al calificar (lectura de MongoDB), así que el área se denormaliza al
-- escribir; el script de backfill rellena las corridas existentes. El default
-- 'desconocido' deja las filas previas en un estado válido.

alter table judge.corridas
  add column if not exists area text not null default 'desconocido';

create index if not exists corridas_usuario_area_idx
  on judge.corridas (usuario_id, area);
