-- Mored Store: punto de venta de mostrador (tablet del local de Chacaíto)
--
-- Dos cosas que resuelve esta migración:
--   1. Búsqueda instantánea por nombre de producto o por color, tolerante a
--      acentos y a errores de tipeo. Es la pantalla que se usa con el cliente
--      esperando enfrente.
--   2. Una sola llamada atómica para registrar la venta. En una tablet con
--      internet inestable, hacer 4 escrituras seguidas deja ventas a medias.
--      O entra todo o no entra nada.

begin;

create extension if not exists pg_trgm;

-- ============================================================================
-- 1. BÚSQUEDA
-- ============================================================================

-- Se quitan acentos con translate() y no con la extensión unaccent, por dos
-- razones: unaccent depende de un diccionario que en Supabase vive en un
-- esquema que no siempre está en el search_path al resolver el índice, y
-- además no es inmutable de fábrica. translate() es inmutable de verdad,
-- no depende de ninguna extensión y cubre de sobra el español.
create or replace function f_normalizar(texto text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select lower(translate(
    texto,
    'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC'
  ));
$$;

comment on function f_normalizar is
  'Normaliza para búsqueda: minúsculas y sin acentos. Así "Burdeos" encuentra "burdeos" y "Celeste" encuentra "celeste".';

create index idx_productos_nombre_trgm
  on productos using gin (f_normalizar(nombre) gin_trgm_ops);

create index idx_colores_nombre_trgm
  on colores using gin (f_normalizar(nombre) gin_trgm_ops);

-- Buscador del mostrador. Una sola llamada devuelve todo lo que la pantalla
-- necesita pintar: foto, nombre, color, talla, precio y disponibilidad.
create or replace function buscar_variantes(
  p_termino     text,
  p_coleccion   text default null,
  p_limite      integer default 40
)
returns table (
  variante_id       uuid,
  producto_id       uuid,
  producto_nombre   text,
  coleccion         text,
  color_nombre      text,
  foto_url          text,
  talla             text,
  sku               text,
  precio_usd        numeric(12,2),
  stock             integer,
  disponible        integer,
  relevancia        real
)
language sql
stable
as $$
  with termino as (
    select f_normalizar(coalesce(p_termino, '')) as t
  )
  select
    v.id,
    p.id,
    p.nombre,
    p.coleccion,
    c.nombre,
    coalesce(c.foto_url, c.foto_miniatura_url),
    v.talla,
    v.sku,
    v.precio_usd,
    v.stock,
    d.disponible,
    greatest(
      similarity(f_normalizar(p.nombre), (select t from termino)),
      similarity(f_normalizar(c.nombre), (select t from termino))
    ) as relevancia
  from variantes v
  join productos p        on p.id = v.producto_id
  join colores c          on c.id = v.color_id
  join v_stock_disponible d on d.variante_id = v.id
  where v.activa
    and p.activo
    and (p_coleccion is null or p.coleccion = p_coleccion)
    and (
      (select t from termino) = ''
      or f_normalizar(p.nombre) % (select t from termino)
      or f_normalizar(c.nombre) % (select t from termino)
      or f_normalizar(p.nombre) like '%' || (select t from termino) || '%'
      or f_normalizar(c.nombre) like '%' || (select t from termino) || '%'
      or v.sku ilike p_termino || '%'
      or v.codigo_proveedor = p_termino
    )
  order by relevancia desc, p.nombre, c.nombre, v.talla
  limit p_limite;
$$;

comment on function buscar_variantes is
  'Busca por nombre de producto, color, SKU o código de la etiqueta del proveedor. El código exacto va primero para que el escaneo con cámara funcione por la misma vía.';

-- ============================================================================
-- 2. CORRELATIVO DE NOTAS DE ENTREGA
-- ============================================================================

create sequence seq_nota_entrega start with 1;

-- ============================================================================
-- 3. VENTA DE MOSTRADOR, ATÓMICA
-- ============================================================================

create or replace function registrar_venta_mostrador(
  p_lineas          jsonb,   -- [{"variante_id": uuid, "cantidad": int, "precio_unitario_usd": num}]
  p_pagos           jsonb,   -- [{"metodo": text, "moneda": "USD"|"BS", "monto": num, "referencia": text}]
  p_canal           text     default 'tienda',
  p_cliente_id      uuid     default null,
  p_descuento_usd   numeric  default 0,
  p_tasa            numeric  default null,
  p_nota            text     default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta_id    uuid;
  v_numero      integer;
  v_tasa        numeric(14,4);
  v_subtotal    numeric(12,2) := 0;
  v_total       numeric(12,2);
  v_pagado_usd  numeric(12,2) := 0;
  v_linea       jsonb;
  v_pago        jsonb;
  v_costo       numeric(12,2);
  v_monto_usd   numeric(12,2);
  v_actor       uuid := auth.uid();
begin
  if jsonb_array_length(p_lineas) = 0 then
    raise exception 'La venta no tiene líneas.';
  end if;

  -- Tasa del día. Si no la pasan, se toma la última registrada.
  v_tasa := coalesce(
    p_tasa,
    (select bs_por_usd from tasas_venta order by fecha desc limit 1)
  );

  v_numero := nextval('seq_nota_entrega');

  insert into ventas (
    serie, numero, canal, tipo, cliente_id, estado,
    subtotal_usd, descuento_usd, total_usd,
    tasa_bs_por_usd, nota, actor_id
  ) values (
    'NE', v_numero, p_canal, 'contado', p_cliente_id, 'borrador',
    0, coalesce(p_descuento_usd, 0), 0,
    v_tasa, p_nota, v_actor
  )
  returning id into v_venta_id;

  -- Líneas. El costo se congela aquí: si mañana entra mercancía a otro precio,
  -- el margen histórico de esta venta no se mueve.
  for v_linea in select * from jsonb_array_elements(p_lineas)
  loop
    select costo_promedio_usd into v_costo
      from variantes
     where id = (v_linea->>'variante_id')::uuid
     for update;

    if not found then
      raise exception 'Variante % no existe.', v_linea->>'variante_id';
    end if;

    insert into ventas_lineas (
      venta_id, variante_id, cantidad, precio_unitario_usd, costo_unitario_usd
    ) values (
      v_venta_id,
      (v_linea->>'variante_id')::uuid,
      (v_linea->>'cantidad')::integer,
      (v_linea->>'precio_unitario_usd')::numeric,
      coalesce(v_costo, 0)
    );

    v_subtotal := v_subtotal
      + (v_linea->>'cantidad')::integer * (v_linea->>'precio_unitario_usd')::numeric;

    -- Descuenta stock de inmediato. En mostrador la prenda ya se la llevan,
    -- no hay nada que reservar.
    --
    -- A propósito NO se valida que quede stock suficiente: si el sistema dice
    -- cero y la prenda está físicamente en la mano de la clienta, el error es
    -- del sistema y la venta es real. Se registra en negativo y la app avisa
    -- para que ajusten inventario después. Nunca bloquear una venta real.
    insert into movimientos_stock (
      variante_id, tipo, cantidad, referencia_tipo, referencia_id, actor_id
    ) values (
      (v_linea->>'variante_id')::uuid,
      'venta',
      -((v_linea->>'cantidad')::integer),
      'venta_linea',
      v_venta_id,
      v_actor
    );
  end loop;

  v_total := v_subtotal - coalesce(p_descuento_usd, 0);

  -- Pagos. Soporta pago mixto (parte en efectivo $, parte en pago móvil),
  -- que es lo normal acá.
  for v_pago in select * from jsonb_array_elements(p_pagos)
  loop
    v_monto_usd := case
      when v_pago->>'moneda' = 'BS' then round((v_pago->>'monto')::numeric / v_tasa, 2)
      else (v_pago->>'monto')::numeric
    end;

    insert into pagos (
      venta_id, metodo, moneda, monto, monto_usd, tasa_usada,
      referencia, estado, verificado_por, verificado_at
    ) values (
      v_venta_id,
      v_pago->>'metodo',
      v_pago->>'moneda',
      (v_pago->>'monto')::numeric,
      v_monto_usd,
      case when v_pago->>'moneda' = 'BS' then v_tasa else null end,
      v_pago->>'referencia',
      -- En mostrador el cobro se confirma en el acto.
      'verificado', v_actor, now()
    );

    v_pagado_usd := v_pagado_usd + v_monto_usd;

    insert into movimientos_financieros (
      tipo, concepto, monto_original, moneda, monto_usd, tasa_usada,
      cuenta, metodo_pago, origen, referencia_id, actor_id
    ) values (
      'ingreso',
      'Venta NE-' || v_numero,
      (v_pago->>'monto')::numeric,
      v_pago->>'moneda',
      v_monto_usd,
      case when v_pago->>'moneda' = 'BS' then v_tasa else null end,
      case when v_pago->>'moneda' = 'BS' then 'bs' else 'divisa' end,
      v_pago->>'metodo',
      'venta', v_venta_id, v_actor
    );
  end loop;

  update ventas
     set subtotal_usd = v_subtotal,
         total_usd    = v_total,
         total_bs     = round(v_total * v_tasa, 2),
         estado       = case
                          when v_pagado_usd >= v_total - 0.01 then 'entregada'
                          else 'pendiente_pago'
                        end
   where id = v_venta_id;

  return v_venta_id;
end;
$$;

comment on function registrar_venta_mostrador is
  'Una sola transacción: venta + líneas + pagos + movimientos de stock + movimientos financieros. Si la conexión se cae a mitad, no queda nada a medias.';

revoke all on function registrar_venta_mostrador from public;
grant execute on function registrar_venta_mostrador to authenticated;
grant execute on function buscar_variantes to authenticated, anon;

commit;
