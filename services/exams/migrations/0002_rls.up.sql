-- Migración 0002 (up) — Row Level Security en sesiones e intentos de examen.
--
-- Mismo patrón que enrollments/0002: la base solo devuelve/acepta filas del usuario
-- fijado en `app.usuario_id`. SOLO surte efecto con un rol SIN superusuario; bajo
-- `postgres` (dev) y con EXAMS_RLS_ENABLED apagado es un no-op seguro.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'certready_app') then
    create role certready_app nologin;
  end if;
end
$$;

grant usage on schema exams to certready_app;
grant select, insert, update, delete on exams.sesiones, exams.intentos to certready_app;

alter table exams.sesiones enable row level security;
alter table exams.sesiones force  row level security;
alter table exams.intentos enable row level security;
alter table exams.intentos force  row level security;

drop policy if exists sesiones_por_usuario on exams.sesiones;
create policy sesiones_por_usuario on exams.sesiones
  using (usuario_id::text = current_setting('app.usuario_id', true))
  with check (usuario_id::text = current_setting('app.usuario_id', true));

drop policy if exists intentos_por_usuario on exams.intentos;
create policy intentos_por_usuario on exams.intentos
  using (usuario_id::text = current_setting('app.usuario_id', true))
  with check (usuario_id::text = current_setting('app.usuario_id', true));
