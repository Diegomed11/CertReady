-- Migración 0002 (up) — Row Level Security en enrollments.inscripciones.
--
-- Defensa en profundidad: la base solo devuelve/acepta las filas del usuario fijado
-- en `app.usuario_id`. SOLO surte efecto cuando la app se conecta con un rol SIN
-- superusuario (el superusuario IGNORA RLS). El servicio fija el usuario por petición
-- con `set_config('app.usuario_id', <sub>, true)` dentro de una transacción
-- (ver libs/platform/postgres, middleware RLSTx). Mientras se conecte como el
-- superusuario `postgres` (dev por defecto) y ENROLLMENTS_RLS_ENABLED esté apagado,
-- esto es un no-op seguro: no cambia el comportamiento actual.

-- Rol de aplicación con privilegios mínimos (idempotente; los roles son del clúster).
-- Se crea SIN login; para activar RLS en dev: `alter role certready_app login
-- password '...'`, apuntar ENROLLMENTS_DATABASE_URL a ese rol y poner
-- ENROLLMENTS_RLS_ENABLED=true.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'certready_app') then
    create role certready_app nologin;
  end if;
end
$$;

grant usage on schema enrollments to certready_app;
grant select, insert, update, delete on enrollments.inscripciones to certready_app;

alter table enrollments.inscripciones enable row level security;
alter table enrollments.inscripciones force row level security;

-- La política acota por el usuario fijado en la sesión. Con la GUC sin fijar,
-- current_setting(..., true) devuelve NULL → no hay filas (falla cerrado).
drop policy if exists inscripciones_por_usuario on enrollments.inscripciones;
create policy inscripciones_por_usuario on enrollments.inscripciones
  using (usuario_id::text = current_setting('app.usuario_id', true))
  with check (usuario_id::text = current_setting('app.usuario_id', true));
