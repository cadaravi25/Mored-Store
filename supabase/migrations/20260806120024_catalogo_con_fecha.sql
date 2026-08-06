-- Mored Store: el catálogo público dice cuándo entró cada prenda
--
-- La tienda necesita una sección de "lo nuevo", y para eso hay que saber qué
-- es nuevo. Se expone la fecha de alta de la variante, que es cuando entró al
-- inventario.
--
-- Es un dato inofensivo: cuándo llegó una prenda no le dice nada a la
-- competencia que no vea entrando a la tienda. El costo y el proveedor siguen
-- fuera, que es lo que importa.

begin;

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
  entro_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.nombre, p.coleccion, t.nombre, p.detalle,
    c.id, c.nombre, cc.hex, c.foto_url,
    v.id, v.talla, v.precio_usd, d.disponible, v.creado_at
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
