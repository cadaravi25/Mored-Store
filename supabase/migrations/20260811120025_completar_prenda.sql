-- Mored Store: prendas a medio definir
--
-- El catálogo de Treinta guarda un solo número de stock por producto y mete
-- las tallas dentro del texto de la descripción: "Ref 24€/ verde S y M,
-- naranja M y azul S" con stock 2. Son cuatro combinaciones y dos prendas, y
-- no hay forma de saber cuáles. Eso no lo resuelve ningún programa: hay que
-- contarlas.
--
-- Así que al importar, lo que se sabe entra completo y lo que no queda
-- marcado. Dos marcas, y son cosas distintas:
--
--   ÚNICA        el accesorio no tiene talla y nunca la va a tener.
--                Lentes, sombreros, bolsos. Está terminado.
--
--   POR DEFINIR  la prenda sí tiene tallas pero todavía no se sabe cuántas
--                de cada una. Está a medias y hay que ir al panel.
--
-- Lo que está POR DEFINIR no sale a la tienda. Es preferible que la clienta
-- no vea la prenda a que la vea, la pida y después haya que escribirle que no
-- estaba en su talla.

begin;

-- ============================================================================
-- COMPLETAR UNA PRENDA
-- ============================================================================

/**
 * Le pone color y tallas a una prenda que entró a medias.
 *
 * Es un reconteo, no una suma: las cantidades que llegan son las que hay, y la
 * diferencia contra lo que decía el sistema se registra como ajuste. Es la
 * operación honesta, porque quien está completando la prenda la tiene en la
 * mano y la está contando.
 *
 * El stock nunca se escribe a mano: se mueve por el libro de movimientos y el
 * disparador actualiza la columna. Si se escribiera directo, el libro y el
 * inventario dirían cosas distintas.
 */
create or replace function completar_prenda(
  p_color_id uuid,
  p_color    text,
  p_tallas   jsonb   -- [{"talla": "S", "cantidad": 2}, ...]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto_id uuid;
  v_coleccion   text;
  v_nombre_hoy  text;
  v_nombre      text;
  v_precio      numeric;
  v_linea       jsonb;
  v_talla       text;
  v_cantidad    integer;
  v_variante    uuid;
  v_stock       integer;
  v_sku         text;
  v_creadas     integer := 0;
  v_movidas     integer := 0;
  v_repartidas  integer := 0;
  v_marcadas    integer := 0;
begin
  select c.producto_id, c.nombre, p.coleccion
    into v_producto_id, v_nombre_hoy, v_coleccion
    from colores c
    join productos p on p.id = c.producto_id
   where c.id = p_color_id;

  if v_producto_id is null then
    raise exception 'Ese color ya no existe.';
  end if;

  v_nombre := nullif(trim(coalesce(p_color, '')), '');
  if v_nombre is null then
    raise exception 'Falta el color.';
  end if;

  if p_tallas is null or jsonb_array_length(p_tallas) = 0 then
    raise exception 'No hay tallas que guardar.';
  end if;

  -- El precio sale de lo que ya tenía la prenda: quien completa está contando
  -- unidades, no poniendo precios, y no tiene por qué volver a escribirlo.
  select max(precio_usd) into v_precio
    from variantes where color_id = p_color_id;

  -- ---------------------------------------------------------------- el color
  if f_normalizar(v_nombre) <> f_normalizar(v_nombre_hoy) then
    if exists (
      select 1 from colores
       where producto_id = v_producto_id
         and id <> p_color_id
         and f_normalizar(nombre) = f_normalizar(v_nombre)
    ) then
      raise exception 'Esta prenda ya tiene un color %. Si son el mismo, hay que unirlos, no repetirlos.', v_nombre;
    end if;

    update colores set nombre = v_nombre where id = p_color_id;
  end if;

  -- --------------------------------------------------------------- las tallas
  for v_linea in select * from jsonb_array_elements(p_tallas)
  loop
    v_talla := upper(trim(coalesce(v_linea->>'talla', '')));
    v_cantidad := coalesce((v_linea->>'cantidad')::integer, 0);

    if v_talla = '' then
      raise exception 'Hay una talla en blanco.';
    end if;
    if v_talla = 'POR DEFINIR' then
      raise exception 'POR DEFINIR no es una talla: es lo que hay que reemplazar.';
    end if;
    if v_cantidad < 0 then
      raise exception 'La cantidad de la talla % no puede ser negativa.', v_talla;
    end if;

    select id, stock into v_variante, v_stock
      from variantes
     where producto_id = v_producto_id
       and color_id = p_color_id
       and talla = v_talla;

    if v_variante is null then
      v_sku := case v_coleccion when 'active' then 'MA-' else 'MS-' end
               || lpad(nextval('seq_sku')::text, 6, '0');

      insert into variantes (producto_id, color_id, talla, sku, precio_usd)
      values (v_producto_id, p_color_id, v_talla, v_sku, coalesce(v_precio, 0))
      returning id into v_variante;

      v_stock := 0;
      v_creadas := v_creadas + 1;
    else
      update variantes set activa = true where id = v_variante;
    end if;

    v_repartidas := v_repartidas + v_cantidad;

    if v_cantidad <> v_stock then
      insert into movimientos_stock (
        variante_id, tipo, cantidad, referencia_tipo, nota, actor_id
      ) values (
        v_variante, 'ajuste', v_cantidad - v_stock, 'manual',
        'Conteo al completar la prenda', auth.uid()
      );
      v_movidas := v_movidas + 1;
    end if;
  end loop;

  -- ------------------------------------------------------- vaciar la marca
  -- La marca se descuenta entera y se retira. Lo que tenía menos lo que se
  -- repartió es la diferencia entre lo que decía el catálogo de Treinta y lo
  -- que apareció al contar. No es un error: es el dato que hacía falta, y
  -- queda en el libro como ajuste.
  for v_variante, v_stock in
    select id, stock from variantes
     where producto_id = v_producto_id
       and color_id = p_color_id
       and talla = 'POR DEFINIR'
  loop
    if v_stock <> 0 then
      insert into movimientos_stock (
        variante_id, tipo, cantidad, referencia_tipo, nota, actor_id
      ) values (
        v_variante, 'ajuste', -v_stock, 'manual',
        'Repartido en tallas al completar la prenda', auth.uid()
      );
      v_marcadas := v_marcadas + v_stock;
    end if;

    update variantes set activa = false where id = v_variante;
  end loop;

  return jsonb_build_object(
    'color', v_nombre,
    'tallas_creadas', v_creadas,
    'tallas_ajustadas', v_movidas,
    'repartidas', v_repartidas,
    'decia_el_catalogo', v_marcadas,
    -- Positivo: el catálogo decía de más. Negativo: aparecieron prendas que
    -- no estaban contadas.
    'diferencia', v_marcadas - v_repartidas
  );
end;
$$;

comment on function completar_prenda is
  'Le pone color y tallas a una prenda importada a medias. Las cantidades son un reconteo, no una suma.';

revoke all on function completar_prenda(uuid, text, jsonb) from public;
grant execute on function completar_prenda(uuid, text, jsonb) to authenticated;

-- ============================================================================
-- EL PANEL NECESITA EL ID DEL COLOR
-- ============================================================================

-- Es lo que recibe completar_prenda. Buscarlo por producto y nombre funciona
-- hasta el primer color que se renombre a mitad de la operación, así que va
-- por su identificador y no por su etiqueta.
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

grant execute on function buscar_variantes(text, integer) to authenticated;

-- ============================================================================
-- LO QUE ESTÁ A MEDIAS NO SALE A LA CALLE
-- ============================================================================

-- Misma lista de columnas que antes, así que basta con reemplazarla.
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
    -- Sin saber las tallas tampoco. Que la clienta no la vea es mejor que
    -- verla, pedirla, y que después haya que decirle que no estaba en su talla.
    and v.talla <> 'POR DEFINIR'
    and (p_producto is null or p.id = p_producto)
  order by p.nombre, c.nombre,
           array_position(array['XS','S','M','L','XL','XXL'], v.talla), v.talla;
$$;

revoke all on function catalogo_publico(uuid) from public;
grant execute on function catalogo_publico(uuid) to anon, authenticated;

commit;
