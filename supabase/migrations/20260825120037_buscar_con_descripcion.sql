-- Mored Store: que la búsqueda del panel devuelva también la descripción
--
-- El inventario ya deja corregir el nombre de la prenda, pero la descripción
-- es lo único que distingue dos prendas que se llaman igual, y es donde están
-- las erratas: salieron de leer vídeos de WhatsApp cuadro a cuadro. Sin
-- traerla no hay forma de enseñarla para corregirla.
--
-- La columna va al final. Los que ya usan esta función leen por nombre, así
-- que añadir una no les cambia nada.

begin;

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
  color_id         uuid,
  color_nombre     text,
  color_hex        text,
  foto_url         text,
  talla            text,
  sku              text,
  precio_usd       numeric,
  precio_bs        numeric,
  stock            integer,
  disponible       integer,
  destacado        boolean,
  descripcion      text
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
    c.id, c.nombre, cc.hex,
    coalesce(c.foto_url, c.foto_miniatura_url),
    v.talla, v.sku, v.precio_usd,
    case when v.precio_bs > 0 then v.precio_bs else v.precio_usd end,
    v.stock, d.disponible, p.destacado, p.descripcion
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
               and public.f_normalizar(concat_ws(' ', t.nombre, p.detalle, p.nombre, p.descripcion, c.nombre, v.sku, v.codigo_proveedor))
                   like '%' || palabra || '%')
         )
      )
    )
  order by p.nombre, c.nombre,
           array_position(array['XS','S','M','L','XL','XXL'], v.talla), v.talla
  limit greatest(p_limite, 1);
$$;

comment on function buscar_variantes is
  'La búsqueda del panel. Ahora también busca dentro de la descripción: con ciento y pico prendas que se llaman "Conjunto", el nombre solo no alcanza para encontrar ninguna.';

revoke all on function buscar_variantes(text, integer) from public;
grant execute on function buscar_variantes(text, integer) to authenticated;

commit;
