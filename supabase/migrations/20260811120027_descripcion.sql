-- Mored Store: la descripción distingue, el nombre agrupa
--
-- Dos trikinis distintos se llaman los dos "Trikini". No se diferencian por el
-- nombre, se diferencian por lo que son: "arriba triángulo, x atrás" contra
-- otra cosa. El nombre sirve para juntar, no para separar.
--
-- De ahí la regla: dos prendas con el mismo nombre Y la misma descripción son
-- la misma prenda en otro color, y salen en una sola tarjeta con sus colores
-- dentro. Si la descripción cambia, son prendas distintas aunque se llamen
-- igual, y van separadas.
--
-- Para que la tienda pueda aplicar esa regla necesita leer la descripción, que
-- hasta ahora se quedaba en el panel.

begin;

-- Cambia la lista de columnas, así que hay que soltarla.
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
    -- La suya si la tiene; si no, la primera del producto.
    coalesce(c.foto_url, respaldo.url),
    -- La principal primero y después las demás, sin repetirla.
    coalesce(c.foto_url, respaldo.url) || coalesce(galeria.urls, '{}'::text[]),
    v.id, v.talla, v.precio_usd, d.disponible, p.destacado
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
    -- Sin ninguna foto, ni suya ni prestada, no sale: un recuadro gris da la
    -- impresión de que la tienda está rota.
    and coalesce(c.foto_url, respaldo.url) is not null
    -- Sin saber las tallas tampoco. Que la clienta no la vea es mejor que
    -- verla, pedirla, y que después haya que decirle que no estaba en su talla.
    and v.talla <> 'POR DEFINIR'
    and (p_producto is null or p.id = p_producto)
  order by p.nombre, p.descripcion, c.nombre,
           array_position(array['XS','S','M','L','XL','XXL'], v.talla), v.talla;
$$;

comment on function catalogo_publico is
  'Lo único que ve el público. Las columnas van escritas una por una a propósito: si mañana alguien agrega el costo a variantes, no sale por accidente.';

revoke all on function catalogo_publico(uuid) from public;
grant execute on function catalogo_publico(uuid) to anon, authenticated;

commit;
