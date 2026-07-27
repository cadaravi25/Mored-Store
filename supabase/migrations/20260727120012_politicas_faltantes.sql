-- Mored Store: políticas de RLS que quedaron huérfanas
--
-- La 006 borró y recreó recepciones_lineas para pasar a recibir por prenda.
-- Al borrar la tabla se fue con ella su política, y la tabla nueva quedó con
-- RLS activo y CERO políticas. En Postgres eso no da error: simplemente no
-- devuelve ninguna fila.
--
-- Es un fallo silencioso y desagradable: guardar funciona, los movimientos de
-- stock se generan bien, y lo único que se nota es una pantalla vacía donde
-- debería salir el resumen. Fácil de perseguir por el lado equivocado.
--
-- Además de arreglarlo, se hace una barrida: cualquier tabla con RLS activo y
-- sin políticas queda cubierta. Así el problema no puede repetirse la próxima
-- vez que una migración recree una tabla.

begin;

do $$
declare
  t record;
begin
  for t in
    select c.relname as tabla
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity
       and not exists (
         select 1 from pg_policy p where p.polrelid = c.oid
       )
  loop
    raise notice 'Tabla sin politicas, se agrega la estandar: %', t.tabla;
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      'acceso_' || t.tabla, t.tabla
    );
  end loop;
end $$;

-- Y al revés: tablas sin RLS activo, que quedarían legibles por cualquiera con
-- permisos aunque mañana se agregue un rol nuevo.
do $$
declare
  t record;
begin
  for t in
    select c.relname as tabla
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and not c.relrowsecurity
  loop
    raise notice 'Tabla sin RLS, se activa: %', t.tabla;
    execute format('alter table public.%I enable row level security', t.tabla);
    if not exists (
      select 1 from pg_policy p
       where p.polrelid = format('public.%I', t.tabla)::regclass
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (true) with check (true)',
        'acceso_' || t.tabla, t.tabla
      );
    end if;
  end loop;
end $$;

commit;
