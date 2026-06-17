-- Migración 0002 (down) — revierte Row Level Security en sesiones e intentos.
drop policy if exists sesiones_por_usuario on exams.sesiones;
drop policy if exists intentos_por_usuario on exams.intentos;

alter table exams.sesiones no force row level security;
alter table exams.sesiones disable row level security;
alter table exams.intentos no force row level security;
alter table exams.intentos disable row level security;

revoke all privileges on exams.sesiones, exams.intentos from certready_app;
revoke usage on schema exams from certready_app;
