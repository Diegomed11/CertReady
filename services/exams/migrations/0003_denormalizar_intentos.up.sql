-- Migración 0003 (up) — denormaliza tema y dificultad en los intentos.
--
-- Mueve la analítica por-usuario al plano OPERATIVO (Go en tiempo real, sin OLAP):
-- el "acierto por tema" se calcula directo de Postgres. El metadato (tema,
-- dificultad) ya está en memoria al calificar (preguntas cargadas de MongoDB), así
-- que se denormaliza al escribir; el script de backfill rellena los intentos
-- existentes. El default 'desconocido' deja las filas previas en un estado válido.

alter table exams.intentos
  add column if not exists tema       text not null default 'desconocido',
  add column if not exists dificultad text not null default 'desconocido';

create index if not exists intentos_usuario_tema_idx
  on exams.intentos (usuario_id, tema);
