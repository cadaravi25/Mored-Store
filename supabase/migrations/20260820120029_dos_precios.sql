-- Mored Store: dos precios por prenda
--
-- Aquí una prenda no vale lo mismo si se paga en divisas que si se paga en
-- bolívares. No es un recargo por método de pago: son dos precios distintos que
-- ellas fijan prenda por prenda, y la clienta ve el que le toca según cómo vaya
-- a pagar.
--
-- Los DOS se escriben en divisas. El de bolívares se guarda también en divisas
-- y se multiplica por la tasa del euro del BCV del día para mostrarlo en Bs.
-- Guardar bolívares directos sería un número que caduca cada mañana.
--
--   precio_usd  20      lo que paga quien paga en divisas
--   precio_bs   22      la base del precio en bolívares: 22 x tasa del euro
--
-- SOBRE EL NOMBRE precio_usd
--
-- Esa columna nunca tuvo dólares dentro. La tasa de venta que usa el sistema es
-- `bcv_eur` desde el principio, así que lo que guarda son euros. El nombre
-- quedó mal desde el esquema inicial y arrastrarlo es feo, pero renombrarlo
-- obliga a rehacer ocho funciones y nueve pantallas para no cambiar nada que se
-- vea. Se queda, con este comentario, y las etiquetas de la interfaz pasan a
-- euros, que es lo que la gente lee.

begin;

alter table variantes
  add column if not exists precio_bs numeric(12,2) not null default 0
    check (precio_bs >= 0);

comment on column variantes.precio_usd is
  'Precio en divisas, en EUROS pese al nombre. Es lo que paga quien paga en efectivo divisas, Zelle o Binance.';
comment on column variantes.precio_bs is
  'Base del precio en bolívares, también en euros. Se multiplica por la tasa BCV del euro del día. Guardar bolívares aquí sería un número que caduca cada mañana.';

-- Arranque: el mismo número en los dos. Las de Active traen el suyo del vídeo
-- y las de Swim se van ajustando desde el panel.
update variantes set precio_bs = precio_usd where precio_bs = 0;

-- ============================================================================
-- LAS DOS CONSULTAS QUE ENSEÑAN PRECIOS
-- ============================================================================

drop function if exists catalogo_publico(uuid);

create function catalogo_publico(p_producto uuid default null)
returns table (
  producto_id  uuid,
  producto     text,
  descripcion  text,
  coleccion    text,
  tipo         text,
  estilo       text,
  color_id     uuid,
  color        text,
  hex          text,
  foto_url     text,
  fotos        text[],
  variante_id  uuid,
  talla        text,
  precio_usd   numeric,
  precio_bs    numeric,
  disponible   integer,
  destacado    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.nombre, p.descripcion, p.coleccion, t.nombre, p.detalle,
    c.id, c.nombre, cc.hex,
    coalesce(c.foto_url, respaldo.url),
    coalesce(c.foto_url, respaldo.url) || coalesce(galeria.urls, '{}'::text[]),
    v.id, v.talla, v.precio_usd,
    -- Si nunca le pusieron precio de bolívares, se cobra el de divisas.
    case when v.precio_bs > 0 then v.precio_bs else v.precio_usd end,
    d.disponible, p.destacado
  from variantes v
  join productos p            on p.id = v.producto_id
  join colores   c            on c.id = v.color_id
  join v_stock_disponible d   on d.variante_id = v.id
  left join tipos_prenda t    on t.id = p.tipo_id
  left join colores_catalogo cc
         on f_normalizar(cc.nombre) = f_normalizar(c.nombre)
  left join lateral (
    select array_agg(f.url order by f.orden, f.creado_at) as urls
      from fotos_color f
     where f.color_id = c.id
       and f.url is distinct from c.foto_url
  ) galeria on true
  left join lateral (
    select coalesce(c2.foto_url, f2.url) as url
      from colores c2
      left join fotos_color f2 on f2.color_id = c2.id
     where c2.producto_id = p.id
       and coalesce(c2.foto_url, f2.url) is not null
     order by c2.orden, f2.orden
     limit 1
  ) respaldo on true
  where p.activo
    and v.activa
    and v.precio_usd > 0
    and coalesce(c.foto_url, respaldo.url) is not null
    and v.talla <> 'POR DEFINIR'
    and (p_producto is null or p.id = p_producto)
  order by p.nombre, p.descripcion, c.nombre,
           array_position(array['XS','S','M','L','XL','XXL'], v.talla), v.talla;
$$;

revoke all on function catalogo_publico(uuid) from public;
grant execute on function catalogo_publico(uuid) to anon, authenticated;

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
    c.id, c.nombre, cc.hex,
    coalesce(c.foto_url, c.foto_miniatura_url),
    v.talla, v.sku, v.precio_usd,
    case when v.precio_bs > 0 then v.precio_bs else v.precio_usd end,
    v.stock, d.disponible, p.destacado
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

grant execute on function buscar_variantes(text, integer) to authenticated;

-- ============================================================================
-- CAMBIAR LOS PRECIOS DESDE EL PANEL
-- ============================================================================

/**
 * Los dos precios de una prenda, en todas las tallas de ese color.
 *
 * Va por color y no por talla porque una misma prenda vale lo mismo en S que en
 * M. Pedirlo talla por talla sería pedir cuatro veces el mismo dato.
 */
create or replace function poner_precios(
  p_color_id   uuid,
  p_precio_usd numeric,
  p_precio_bs  numeric
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tocadas integer;
begin
  if p_precio_usd is null or p_precio_usd < 0
     or p_precio_bs is null or p_precio_bs < 0 then
    raise exception 'Los precios no pueden ser negativos.';
  end if;

  update variantes
     set precio_usd = round(p_precio_usd, 2),
         precio_bs  = round(p_precio_bs, 2)
   where color_id = p_color_id;

  get diagnostics v_tocadas = row_count;
  return v_tocadas;
end;
$$;

revoke all on function poner_precios(uuid, numeric, numeric) from public;
grant execute on function poner_precios(uuid, numeric, numeric) to authenticated;

commit;
