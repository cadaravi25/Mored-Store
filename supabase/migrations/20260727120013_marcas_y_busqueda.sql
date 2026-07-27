-- Mored Store: marcas y búsqueda por varias palabras
--
-- Del inventario real de Fina salieron dos cosas:
--
-- 1. "Musera" es una MARCA, y estaba metida dentro del nombre del producto
--    ("top musera dupe"). Como campo propio se puede filtrar y reportar por
--    marca; dentro del texto libre no sirve para nada.
--
-- 2. "árabe", "básico", "lazo", "cierre frontal" son ESTILOS: la manera que
--    tenían de diferenciar modelos cuando todo era una sola casilla de texto.
--    Eso es el campo `detalle` que ya existe.
--
-- El nombre queda armado como: Top + Musera + árabe.

begin;

-- ============================================================================
-- 1. MARCAS
-- ============================================================================

create table marcas (
  id        uuid primary key default uuid_generate_v4(),
  nombre    text not null check (length(trim(nombre)) between 2 and 40),
  orden     integer not null default 0,
  activo    boolean not null default true,
  creado_at timestamptz not null default now()
);

create unique index idx_marcas_unico on marcas (f_normalizar(nombre));

alter table productos
  add column marca_id uuid references marcas(id) on delete set null;

create index on productos (marca_id);

create or replace function obtener_o_crear_marca(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from marcas
   where f_normalizar(nombre) = f_normalizar(trim(p_nombre));
  if v_id is null then
    insert into marcas (nombre) values (trim(p_nombre)) returning id into v_id;
  end if;
  return v_id;
end;
$$;

insert into marcas (nombre, orden) values ('Musera', 10) on conflict do nothing;

alter table marcas enable row level security;
create policy acceso_marcas on marcas
  for all to authenticated using (true) with check (true);
grant select, insert, update on marcas to authenticated;
grant execute on function obtener_o_crear_marca to authenticated;

-- ============================================================================
-- 2. TIPOS: SU VOCABULARIO, NO EL MÍO
-- ============================================================================
-- Tomados del inventario real. Los que yo había inventado y no usan se borran
-- si nadie los referencia; el resto queda desactivado.

delete from tipos_prenda t
 where not exists (select 1 from productos p where p.tipo_id = t.id)
   and f_normalizar(t.nombre) in (
     'legging','body','conjunto','pantalon','franela','bikini',
     'short de playa','pareo','sombrero','bolso','salida de bano'
   );

insert into tipos_prenda (coleccion, nombre, orden) values
  ('active', 'Top', 10),
  ('active', 'Set', 20),
  ('active', 'Enterizo', 30),
  ('active', 'Licra', 40),
  ('active', 'Short', 50),
  ('active', 'Suéter', 60),
  ('active', 'Sudadera', 70),
  ('active', 'Chaqueta', 80),
  ('active', 'Accesorios deportivos', 90),
  ('swim', 'Traje de baño', 10),
  ('swim', 'Bañador', 20),
  ('swim', 'Vestido playero', 30),
  ('swim', 'Salida de baño', 40),
  ('swim', 'Top playero', 50),
  ('swim', 'Short playero', 60),
  ('swim', 'Accesorios', 70)
on conflict do nothing;

-- ============================================================================
-- 3. BÚSQUEDA POR VARIAS PALABRAS
-- ============================================================================
-- Tiene que funcionar en los dos sentidos:
--   "top blanco"   -> los tops blancos, en todas sus tallas
--   "top talla s"  -> los tops en S, en todos sus colores
--
-- Dos detalles que la hacen funcionar de verdad:
--
-- Se descartan palabras de relleno ("talla", "color", "de"). Si no, "top talla
-- s" no devolvería nada, porque "talla" no aparece en ningún campo y se exige
-- que todas las palabras coincidan.
--
-- Y las palabras de una o dos letras solo se comparan contra talla y color, en
-- coincidencia exacta. Con búsqueda parcial, "s" coincidiría dentro de
-- "Musera" y "top s" devolvería el catálogo entero.

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
  marca           text,
  detalle         text,
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
       and w not in ('talla','tallas','color','colores','de','del','en','el','la','los','las','y')
  )
  select
    v.id, p.id, p.nombre, t.nombre, m.nombre, p.detalle, p.coleccion,
    c.nombre, cc.hex,
    coalesce(c.foto_url, c.foto_miniatura_url),
    v.talla, v.sku, v.precio_usd, v.stock, d.disponible
  from variantes v
  join productos p            on p.id = v.producto_id
  join colores   c            on c.id = v.color_id
  join v_stock_disponible d   on d.variante_id = v.id
  left join tipos_prenda t    on t.id = p.tipo_id
  left join marcas m          on m.id = p.marca_id
  left join colores_catalogo cc on f_normalizar(cc.nombre) = f_normalizar(c.nombre)
  where v.activa
    and p.activo
    and (p_coleccion is null or p.coleccion = p_coleccion)
    and (
      cardinality((select lista from palabras)) = 0
      -- Todas las palabras tienen que coincidir: "top blanco" exige las dos.
      or not exists (
        select 1
          from unnest((select lista from palabras)) as palabra
         where not (
           -- Talla y color siempre por coincidencia exacta.
           f_normalizar(v.talla) = palabra
           or f_normalizar(c.nombre) = palabra
           -- Y de tres letras en adelante, también coincidencia parcial en el
           -- resto. Por debajo de eso no: "s" aparece dentro de "Musera".
           or (
             length(palabra) >= 3
             and f_normalizar(
                   concat_ws(' ', t.nombre, m.nombre, p.detalle, p.nombre,
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
  'Busca exigiendo TODAS las palabras. Ordena por talla en orden natural y no alfabetico, para que L no salga antes que M.';

grant execute on function buscar_variantes to authenticated;

commit;
