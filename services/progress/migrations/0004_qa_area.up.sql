-- Migración 0004 (up) — denormaliza el área en las autoevaluaciones de Q&A.
--
-- La "preparación por puesto" pasó a ser OPERATIVA (Go en vivo, sin OLAP): la
-- señal de Q&A se agrupa por área directo de Postgres. El cliente envía el área al
-- autoevaluar (ya tiene la pregunta a la vista); el backfill rellena las filas
-- previas desde MongoDB. El default 'desconocido' deja lo viejo en estado válido.

alter table progress.qa_revisiones
  add column if not exists area text not null default 'desconocido';

create index if not exists qa_revisiones_usuario_area_idx
  on progress.qa_revisiones (usuario_id, area);
