-- Migración 0002 (down) — revierte Row Level Security en enrollments.inscripciones.
drop policy if exists inscripciones_por_usuario on enrollments.inscripciones;
alter table enrollments.inscripciones no force row level security;
alter table enrollments.inscripciones disable row level security;
revoke all privileges on enrollments.inscripciones from certready_app;
revoke usage on schema enrollments from certready_app;
-- El rol certready_app se conserva (puede compartirse con otros servicios).
