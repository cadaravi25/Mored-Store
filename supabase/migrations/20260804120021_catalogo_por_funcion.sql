-- Mored Store: la ventana pública, ahora como función
--
-- La vista de la migración anterior funcionaba, pero el revisor de Supabase la
-- marca como CRÍTICA, y tiene razón en avisar: una vista que corre con los
-- permisos de quien la creó se salta RLS, y desde afuera no hay forma de
-- distinguir una que expone tres columnas inofensivas de una que expone la
-- tabla entera. La advertencia no dice "esto está mal", dice "esto no se puede
-- auditar de un vistazo".
--
-- Una función SECURITY DEFINER hace exactamente lo mismo pero declarando la
-- intención: esto es un punto de entrada público, escrito a propósito. Es el
-- camino que Supabase documenta para esto, y el revisor lo entiende.
--
-- La otra salida habría sido dejar la vista respetando RLS y darle permisos de
-- lectura al rol anónimo sobre productos, colores y variantes. Eso es peor:
-- con esos permisos, cualquiera puede consultar `variantes` directamente y leer
-- el costo de cada prenda. La superficie sería mucho más grande, no menor.

begin;

drop view if exists v_catalogo;

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
  disponible   integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.nombre, p.coleccion, t.nombre, p.detalle,
    c.id, c.nombre, cc.hex, c.foto_url,
    v.id, v.talla, v.precio_usd, d.disponible
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

commit;
