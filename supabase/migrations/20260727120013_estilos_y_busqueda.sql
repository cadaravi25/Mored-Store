-- Mored Store: estilos y búsqueda por varias palabras
--
-- Del inventario real de Fina: "musera", "árabe", "básico", "lazo" son la
-- manera que tenían de diferenciar modelos cuando todo era una sola casilla de
-- texto. Algunos son marca y otros no, pero obligar a decidir cuál es cuál
-- solo consigue que el campo se llene con cualquier cosa. Va uno solo:
-- ESTILO, con lista controlada igual que los tipos.
--
-- El nombre queda armado como: Top + musera dupe.

begin;

-- Por si se llegó a aplicar la versión anterior con marcas.
drop table if exists marcas cascade;
alter table productos drop column if exists marca_id;

-- ============================================================================
-- 1. ESTILOS
-- ============================================================================

create table if not exists estilos (
  id        uuid primary key default uuid_generate_v4(),
  nombre    text not null check (length(trim(nombre)) between 2 and 40),
  orden     integer not null default 0,
  activo    boolean not null default true,
  creado_at timestamptz not null default now()
);

create unique index if not exists idx_estilos_unico
  on estilos (f_normalizar(nombre));

comment on table estilos is
  'Lista controlada. El indice va sobre el nombre normalizado, asi que "Musera", "musera" y "MUSERA" no se pueden duplicar.';

create or replace function obtener_o_crear_estilo(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from estilos
   where f_normalizar(nombre) = f_normalizar(trim(p_nombre));
  if v_id is null then
    insert into estilos (nombre) values (trim(p_nombre)) returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Sacados del inventario real. Van a agregar los que falten.
insert into estilos (nombre, orden) values
  ('musera', 10), ('musera dupe', 20), ('básico', 30), ('árabe', 40),
  ('lazo', 50), ('dupe', 60), ('dupe dfyne', 70), ('aralina', 80),
  ('cierre frontal', 90), ('manga larga', 100), ('cruzado', 110),
  ('con tiras', 120), ('corto', 130), ('largo', 140), ('en v', 150),
  ('premium', 160), ('playero', 170)
on conflict do nothing;

alter table estilos enable row level security;
drop policy if exists acceso_estilos on estilos;
create policy acceso_estilos on estilos
  for all to authenticated using (true) with check (true);
grant select, insert, update on estilos to authenticated;
grant execute on function obtener_o_crear_estilo to authenticated;

-- ============================================================================
-- 2. TIPOS: SU VOCABULARIO, NO EL MÍO
-- ============================================================================

delete from tipos_prenda t
 where not exists (select 1 from productos p where p.tipo_id = t.id)
   and f_normalizar(t.nombre) in (
     'legging','body','conjunto','pantalon','franela','bikini',
     'short de playa','pareo','sombrero','bolso','salida de bano'
   );

insert into tipos_prenda (coleccion, nombre, orden) values
  ('active', 'Top', 10), ('active', 'Set', 20), ('active', 'Enterizo', 30),
  ('active', 'Licra', 40), ('active', 'Short', 50), ('active', 'Suéter', 60),
  ('active', 'Sudadera', 70), ('active', 'Chaqueta', 80),
  ('active', 'Accesorios deportivos', 90),
  ('swim', 'Traje de baño', 10), ('swim', 'Bañador', 20),
  ('swim', 'Vestido playero', 30), ('swim', 'Salida de baño', 40),
  ('swim', 'Top playero', 50), ('swim', 'Short playero', 60),
  ('swim', 'Accesorios', 70)
on conflict do nothing;

-- ============================================================================
-- 3. BÚSQUEDA
-- ============================================================================
-- Funciona en los dos sentidos:
--   "top blanco"   -> los tops blancos, en todas sus tallas
--   "top talla s"  -> los tops en S, en todos sus colores
--
-- Se descartan palabras de relleno ("talla", "color", "de"): como se exige que
-- TODAS las palabras coincidan, "top talla s" no devolvería nada porque
-- "talla" no aparece en ningún campo.
--
-- Y las palabras de una o dos letras solo se comparan contra talla y color, en
-- coincidencia exacta. Con búsqueda parcial, "s" coincidiría dentro de
-- "musera" y "top s" devolvería el catálogo entero.

create or replace function buscar_variantes(
  p_termino    text,
  p_coleccion  text    default null,
  p_limite     integer default 80
)
returns table (
  variante_id     uuid,
  producto_id     uuid,
  producto_nombre text,
  tipo            text,
  estilo          text,
  coleccion       text,
  color_nombre    text,
  color_hex       text,
  foto_url        text,
  talla           text,
  sku             text,
  precio_usd      numeric,
  stock           integer,
  disponible      integer
)
language sql
stable
as $$
  with palabras as (
    select coalesce(array_agg(w), '{}') as lista
      from unnest(
             string_to_array(trim(f_normalizar(coalesce(p_termino, ''))), ' ')
           ) as w
     where w <> ''
       and w not in ('talla','tallas','color','colores','de','del','en',
                     'el','la','los','las','y','un','una')
  )
  select
    v.id, p.id, p.nombre, t.nombre, p.detalle, p.coleccion,
    c.nombre, cc.hex,
    coalesce(c.foto_url, c.foto_miniatura_url),
    v.talla, v.sku, v.precio_usd, v.stock, d.disponible
  from variantes v
  join productos p              on p.id = v.producto_id
  join colores   c              on c.id = v.color_id
  join v_stock_disponible d     on d.variante_id = v.id
  left join tipos_prenda t      on t.id = p.tipo_id
  left join colores_catalogo cc on f_normalizar(cc.nombre) = f_normalizar(c.nombre)
  where v.activa
    and p.activo
    and (p_coleccion is null or p.coleccion = p_coleccion)
    and (
      cardinality((select lista from palabras)) = 0
      or not exists (
        select 1
          from unnest((select lista from palabras)) as palabra
         where not (
           f_normalizar(v.talla) = palabra
           or f_normalizar(c.nombre) = palabra
           or (
             length(palabra) >= 3
             and f_normalizar(
                   concat_ws(' ', t.nombre, p.detalle, p.nombre,
                                  c.nombre, v.sku, v.codigo_proveedor)
                 ) like '%' || palabra || '%'
           )
         )
      )
    )
  order by p.nombre, c.nombre,
           array_position(array['XS','S','M','L','XL','XXL'], v.talla),
           v.talla
  limit p_limite;
$$;

comment on function buscar_variantes is
  'Exige que todas las palabras coincidan. Ordena las tallas en orden natural y no alfabetico: alfabeticamente la L sale antes que la M.';

grant execute on function buscar_variantes to authenticated;

commit;
