-- Migración 0003 (down) — revierte Row Level Security en el progreso de estudio.
drop policy if exists lecciones_por_usuario on progress.lecciones;
drop policy if exists temas_por_usuario on progress.temas;
drop policy if exists qa_revisiones_por_usuario on progress.qa_revisiones;

alter table progress.lecciones     no force row level security;
alter table progress.lecciones     disable row level security;
alter table progress.temas         no force row level security;
alter table progress.temas         disable row level security;
alter table progress.qa_revisiones no force row level security;
alter table progress.qa_revisiones disable row level security;

revoke all privileges
  on progress.lecciones, progress.temas, progress.qa_revisiones from certready_app;
revoke usage on schema progress from certready_app;
