-- Mored Store: permisos de acceso desde la aplicación
--
-- Dos cosas que faltaban y que solo se notan al conectar la app de verdad:
--
-- 1. Las políticas de RLS dicen QUIÉN puede ver cada fila, pero no otorgan el
--    permiso de leer la tabla. Son dos capas distintas y hacían falta las dos.
--
-- 2. Una vista en Postgres se ejecuta con los permisos de QUIEN LA CREÓ, no de
--    quien la consulta. Como las creó `postgres`, se saltaban RLS por completo:
--    bastaba con poder leer la vista para ver todas las filas. Con
--    security_invoker las vistas pasan a respetar las políticas del usuario
--    que consulta, que es lo que uno espera que hagan.

begin;

-- ============================================================================
-- 1. LAS VISTAS RESPETAN RLS
-- ============================================================================

do $$
declare v record;
begin
  for v in
    select table_name from information_schema.views where table_schema = 'public'
  loop
    execute format('alter view public.%I set (security_invoker = true)', v.table_name);
  end loop;
end $$;

-- ============================================================================
-- 2. PERMISOS
-- ============================================================================
-- El sistema interno es para las dos socias: todo pasa por sesión iniciada.
-- El rol anónimo no recibe nada. Cuando exista la tienda pública se le darán
-- permisos puntuales de lectura sobre catálogo, y solo sobre eso.

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Que lo creado de aquí en adelante herede lo mismo, sin tener que acordarse.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

revoke all on all tables in schema public from anon;

-- ============================================================================
-- 3. PERFIL AUTOMÁTICO AL REGISTRARSE
-- ============================================================================
-- Sin esto habría que crear la fila de perfiles a mano cada vez que se da de
-- alta a alguien, y olvidarlo deja a la persona sin poder trabajar.

create or replace function fn_crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    'admin'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists tg_crear_perfil on auth.users;
create trigger tg_crear_perfil
  after insert on auth.users
  for each row execute function fn_crear_perfil();

-- Cubre a quien ya se haya registrado antes de esta migración.
insert into perfiles (id, nombre, rol)
select u.id, coalesce(u.raw_user_meta_data->>'nombre', split_part(u.email, '@', 1)), 'admin'
  from auth.users u
 where not exists (select 1 from perfiles p where p.id = u.id);

commit;
