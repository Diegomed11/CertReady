-- Migración 0003 (up) — Row Level Security en el progreso de estudio.
--
-- Mismo patrón que enrollments/0002: la base solo devuelve/acepta filas del usuario
-- fijado en `app.usuario_id`. SOLO surte efecto con un rol SIN superusuario; bajo
-- `postgres` (dev) y con PROGRESS_RLS_ENABLED apagado es un no-op seguro.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'certready_app') then
    create role certready_app nologin;
  end if;
end
$$;

grant usage on schema progress to certready_app;
grant select, insert, update, delete
  on progress.lecciones, progress.temas, progress.qa_revisiones to certready_app;

alter table progress.lecciones     enable row level security;
alter table progress.lecciones     force  row level security;
alter table progress.temas         enable row level security;
alter table progress.temas         force  row level security;
alter table progress.qa_revisiones enable row level security;
alter table progress.qa_revisiones force  row level security;

drop policy if exists lecciones_por_usuario on progress.lecciones;
create policy lecciones_por_usuario on progress.lecciones
  using (usuario_id::text = current_setting('app.usuario_id', true))
  with check (usuario_id::text = current_setting('app.usuario_id', true));

drop policy if exists temas_por_usuario on progress.temas;
create policy temas_por_usuario on progress.temas
  using (usuario_id::text = current_setting('app.usuario_id', true))
  with check (usuario_id::text = current_setting('app.usuario_id', true));

drop policy if exists qa_revisiones_por_usuario on progress.qa_revisiones;
create policy qa_revisiones_por_usuario on progress.qa_revisiones
  using (usuario_id::text = current_setting('app.usuario_id', true))
  with check (usuario_id::text = current_setting('app.usuario_id', true));
