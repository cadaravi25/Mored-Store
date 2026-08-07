-- Mored Store: "Lo nuevo" se escoge, no se calcula
--
-- La idea obvia era ordenar por fecha de entrada, y está mal: si llega un
-- restock de un top que tienen desde marzo, la fecha diría que es nuevo y no lo
-- es. Lo mismo con una corrección de inventario o un conteo.
--
-- Nuevo es una decisión de tienda, no un dato del almacén. Así que lo marcan
-- ellas desde el panel, prenda por prenda.

begin;

alter table productos
  add column destacado boolean not null default false;

comment on column productos.destacado is
  'Sale en "Lo nuevo" de la tienda. Se marca a mano: la fecha de entrada no sirve porque un restock no es una novedad.';

create index idx_productos_destacado on productos (destacado) where destacado;

-- ============================================================================
-- EL CATÁLOGO PÚBLICO LO EXPONE
-- ============================================================================

create or replace function catalogo_publico(p_producto uuid default null)
returns table (
  producto_id  uuid,
  producto     text,
  coleccion    text,
  tipo         text,
  estilo       text,
  color_id     uuid,
  color        text,
  hex          text,
  foto_url     text,
  variante_id  uuid,
  talla        text,
  precio_usd   numeric,
  disponible   integer,
  destacado    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.nombre, p.coleccion, t.nombre, p.detalle,
    c.id, c.nombre, cc.hex, c.foto_url,
    v.id, v.talla, v.precio_usd, d.disponible, p.destacado
  from variantes v
  join productos p            on p.id = v.producto_id
  join colores   c            on c.id = v.color_id
  join v_stock_disponible d   on d.variante_id = v.id
  left join tipos_prenda t    on t.id = p.tipo_id
  left join colores_catalogo cc
         on f_normalizar(cc.nombre) = f_normalizar(c.nombre)
  where p.activo
    and v.activa
    and v.precio_usd > 0
    -- Sin foto no sale a la calle. Un recuadro gris no vende: da la impresión
    -- de que la tienda está rota.
    and c.foto_url is not null
    and (p_producto is null or p.id = p_producto)
  order by p.nombre, c.nombre,
           array_position(array['XS','S','M','L','XL','XXL'], v.talla), v.talla;
$$;

comment on function catalogo_publico is
  'Lo único que ve el público. Las columnas van escritas una por una a propósito: si mañana alguien agrega el costo a variantes, no sale por accidente.';

revoke all on function catalogo_publico(uuid) from public;
grant execute on function catalogo_publico(uuid) to anon, authenticated;

-- ============================================================================
-- EL INVENTARIO DEL PANEL TAMBIÉN, PARA PODER MARCARLO DESDE AHÍ
-- ============================================================================

drop function if exists buscar_variantes(text, integer);

create function buscar_variantes(
  p_termino text default null,
  p_limite  integer default 200
)
returns table (
  variante_id      uuid,
  producto_id      uuid,
  producto_nombre  text,
  tipo             text,
  estilo           text,
  coleccion        text,
  color_nombre     text,
  color_hex        text,
  foto_url         text,
  talla            text,
  sku              text,
  precio_usd       numeric,
  stock            integer,
  disponible       integer,
  destacado        boolean
)
language sql
stable
as $$
  with palabras as (
    select coalesce(array_agg(w), '{}') as lista
      from unnest(string_to_array(trim(public.f_normalizar(coalesce(p_termino,''))), ' ')) as w
     where w <> ''
       and w not in ('talla','tallas','color','colores','de','del','en',
                     'el','la','los','las','y','un','una')
  )
  select
    v.id, p.id, p.nombre, t.nombre, p.detalle, p.coleccion,
    c.nombre, cc.hex,
    coalesce(c.foto_url, c.foto_miniatura_url),
    v.talla, v.sku, v.precio_usd, v.stock, d.disponible, p.destacado
  from variantes v
  join productos p              on p.id = v.producto_id
  join colores   c              on c.id = v.color_id
  join v_stock_disponible d     on d.variante_id = v.id
  left join tipos_prenda t      on t.id = p.tipo_id
  left join colores_catalogo cc on public.f_normalizar(cc.nombre) = public.f_normalizar(c.nombre)
  where p.activo
    and v.activa
    and (
      cardinality((select lista from palabras)) = 0
      or not exists (
        select 1 from unnest((select lista from palabras)) as palabra
         where not (
           public.f_normalizar(v.talla) = palabra
           or public.f_normalizar(c.nombre) = palabra
           or (length(palabra) >= 3
               and public.f_normalizar(concat_ws(' ', t.nombre, p.detalle, p.nombre, c.nombre, v.sku, v.codigo_proveedor))
                   like '%' || palabra || '%')
         )
      )
    )
  order by p.nombre, c.nombre,
           array_position(array['XS','S','M','L','XL','XXL'], v.talla), v.talla
  limit greatest(p_limite, 1);
$$;

grant execute on function buscar_variantes to authenticated;

commit;
