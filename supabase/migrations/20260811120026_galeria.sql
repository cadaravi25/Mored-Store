-- Mored Store: más de una foto por prenda
--
-- Hasta ahora cada color tenía una foto y punto. Treinta guarda varias por
-- producto y las enseña en una tira de miniaturas, y eso es lo que la clienta
-- espera: ver la prenda de frente, de espaldas y estirada antes de pedirla.
--
-- Las fotos siguen colgando del color y no del producto. Es lo correcto: en un
-- bikini que viene en marrón y en azul, la foto del marrón no le sirve a quien
-- está mirando el azul. Cuando el producto tiene un solo color, todas sus
-- fotos son de ese color y el resultado es el mismo.
--
-- Un color puede quedarse sin foto propia. Pasa cuando la descripción nombra
-- un color que nunca fotografiaron. Antes eso lo dejaba fuera de la tienda;
-- ahora hereda la primera foto del producto, que enseña el modelo aunque no el
-- tono. Es mejor que no exista: la prenda está y se puede pedir.

begin;

create table fotos_color (
  id         uuid primary key default uuid_generate_v4(),
  color_id   uuid not null references colores(id) on delete cascade,
  url        text not null,
  orden      integer not null default 0,
  creado_at  timestamptz not null default now(),
  unique (color_id, url)
);

create index on fotos_color (color_id, orden);

comment on table fotos_color is
  'Las demás fotos de un color. La principal sigue en colores.foto_url: es la que sale en el catálogo y no puede depender de un join.';

alter table fotos_color enable row level security;

create policy acceso_fotos_color on fotos_color
  for all to authenticated using (true) with check (true);

-- La migración 008 ya reparte permisos por defecto a las tablas nuevas, pero
-- eso depende de con qué rol se corra. Explícito no estorba.
grant select, insert, update, delete on fotos_color to authenticated;

-- ============================================================================
-- EL CATÁLOGO PÚBLICO LAS DEVUELVE
-- ============================================================================

-- Cambia la lista de columnas, así que hay que soltarla.
drop function if exists catalogo_publico(uuid);

create function catalogo_publico(p_producto uuid default null)
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
    p.id, p.nombre, p.coleccion, t.nombre, p.detalle,
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
  order by p.nombre, c.nombre,
           array_position(array['XS','S','M','L','XL','XXL'], v.talla), v.talla;
$$;

comment on function catalogo_publico is
  'Lo único que ve el público. Las columnas van escritas una por una a propósito: si mañana alguien agrega el costo a variantes, no sale por accidente.';

revoke all on function catalogo_publico(uuid) from public;
grant execute on function catalogo_publico(uuid) to anon, authenticated;

commit;
