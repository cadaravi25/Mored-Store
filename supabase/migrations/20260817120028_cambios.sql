-- Mored Store: cambios de prenda
--
-- La clienta trae una prenda de una venta anterior y se lleva otra, u otras.
-- La regla de la tienda: lo que se lleva tiene que valer igual o más que lo
-- que devuelve, y si vale más paga la diferencia. Nunca sale plata de la caja
-- por un cambio.
--
-- LA VENTA ORIGINAL NO SE TOCA
--
-- Es lo importante de todo esto. Aquella venta ocurrió, se cobró, y su día de
-- caja probablemente ya está cerrado. Reescribirla borraría lo que de verdad
-- pasó y descuadraría un arqueo firmado. El cambio es un hecho nuevo, de hoy,
-- que apunta a la venta vieja.
--
-- Así que un cambio es otra nota de entrega, con dos particularidades:
--
--   credito_cambio_usd   lo que se le abona por la prenda devuelta
--   cambio_de_venta_id   de qué venta venía esa prenda
--
-- El crédito NO es un descuento y por eso tiene columna propia. Un descuento
-- es plata que la tienda regala; un crédito es mercancía que volvió al
-- estante. Mezclarlos haría creer que se está rebajando más de lo que se rebaja.

begin;

alter table ventas
  add column if not exists cambio_de_venta_id uuid references ventas(id),
  add column if not exists credito_cambio_usd numeric(12,2) not null default 0
    check (credito_cambio_usd >= 0);

comment on column ventas.credito_cambio_usd is
  'Lo abonado por la prenda devuelta en un cambio. No es un descuento: es mercancía que volvió al inventario.';
comment on column ventas.cambio_de_venta_id is
  'La venta de donde salió la prenda devuelta. La venta original nunca se modifica.';

create index if not exists idx_ventas_cambio_de on ventas (cambio_de_venta_id)
  where cambio_de_venta_id is not null;

-- ============================================================================
-- QUÉ PIEZA SE DEVOLVIÓ Y EN QUÉ CAMBIO
-- ============================================================================

create table if not exists cambios_lineas (
  id            uuid primary key default uuid_generate_v4(),
  -- La nota de entrega nueva, la del cambio.
  venta_id      uuid not null references ventas(id) on delete cascade,
  -- La línea de la venta vieja de la que salió la prenda devuelta.
  linea_id      uuid not null references ventas_lineas(id) on delete restrict,
  variante_id   uuid not null references variantes(id) on delete restrict,
  cantidad      integer not null check (cantidad > 0),
  credito_usd   numeric(12,2) not null check (credito_usd >= 0),
  creado_at     timestamptz not null default now()
);

create index if not exists idx_cambios_lineas_linea on cambios_lineas (linea_id);
create index if not exists idx_cambios_lineas_venta on cambios_lineas (venta_id);

comment on table cambios_lineas is
  'Qué prenda volvió al inventario en cada cambio. Permite saber cuántas de una línea ya se cambiaron y no aceptar la misma dos veces.';

alter table cambios_lineas enable row level security;

drop policy if exists acceso_cambios_lineas on cambios_lineas;
create policy acceso_cambios_lineas on cambios_lineas
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on cambios_lineas to authenticated;

-- ============================================================================
-- LAS VENTAS DE UNA CLIENTA, CON SUS PIEZAS
-- ============================================================================

/**
 * Todo lo que compró una persona, pieza por pieza.
 *
 * Una fila por venta con sus líneas dentro, que es como se mira: se abre el
 * pedido y se ven las prendas. Incluye el id de cada línea porque es lo que
 * hace falta para pedir el cambio de esa pieza en concreto, y cuántas de ella
 * ya se cambiaron, para no aceptar la misma prenda dos veces.
 */
create or replace function ventas_de_cliente(p_cliente uuid)
returns table (
  venta_id     uuid,
  serie        text,
  numero       integer,
  creado_at    timestamptz,
  estado       text,
  total_usd    numeric,
  es_cambio    boolean,
  lineas       jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id, v.serie, v.numero, v.creado_at, v.estado, v.total_usd,
    v.cambio_de_venta_id is not null,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
          'linea_id', vl.id,
          'variante_id', vl.variante_id,
          'cantidad', vl.cantidad,
          'precio_unitario_usd', vl.precio_unitario_usd,
          'producto', p.nombre,
          'descripcion', p.descripcion,
          'color', c.nombre,
          'talla', vr.talla,
          'foto_url', c.foto_url,
          'ya_cambiadas', coalesce((
            select sum(cl.cantidad) from cambios_lineas cl where cl.linea_id = vl.id
          ), 0)
        ) order by p.nombre, vr.talla)
        from ventas_lineas vl
        join variantes vr on vr.id = vl.variante_id
        join productos p  on p.id = vr.producto_id
        join colores   c  on c.id = vr.color_id
       where vl.venta_id = v.id),
      '[]'::jsonb)
  from ventas v
  where v.cliente_id = p_cliente
    and v.estado <> 'anulada'
  order by v.creado_at desc;
$$;

revoke all on function ventas_de_cliente(uuid) from public;
grant execute on function ventas_de_cliente(uuid) to authenticated;

-- ============================================================================
-- REGISTRAR EL CAMBIO
-- ============================================================================

/**
 * Devuelve una prenda de una venta anterior y entrega otras en su lugar.
 *
 * Hace cuatro cosas en una sola transacción, porque a medias dejaría el
 * inventario mintiendo: la prenda vuelve al stock, las nuevas salen, se cobra
 * la diferencia si la hay, y queda anotado de qué venta salió cada cosa.
 */
create or replace function registrar_cambio(
  p_linea_id   uuid,     -- la línea de la venta vieja que se devuelve
  p_cantidad   integer,  -- cuántas de esa línea
  p_nuevas     jsonb,    -- [{"variante_id": uuid, "cantidad": int, "precio_unitario_usd": num}]
  p_pagos      jsonb    default '[]'::jsonb,
  p_tasa       numeric  default null,
  p_nota       text     default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta_vieja  uuid;
  v_variante     uuid;
  v_precio       numeric(12,2);
  v_vendidas     integer;
  v_cambiadas    integer;
  v_cliente      uuid;
  v_credito      numeric(12,2);
  v_subtotal     numeric(12,2) := 0;
  v_diferencia   numeric(12,2);
  v_pagado       numeric(12,2) := 0;
  v_venta_id     uuid;
  v_numero       integer;
  v_tasa         numeric(14,4);
  v_linea        jsonb;
  v_pago         jsonb;
  v_costo        numeric(12,2);
  v_monto_usd    numeric(12,2);
  v_actor        uuid := auth.uid();
begin
  if p_cantidad is null or p_cantidad < 1 then
    raise exception 'Hay que decir cuántas prendas se devuelven.';
  end if;
  if p_nuevas is null or jsonb_array_length(p_nuevas) = 0 then
    raise exception 'No se escogió ninguna prenda a cambio.';
  end if;

  select vl.venta_id, vl.variante_id, vl.precio_unitario_usd, vl.cantidad, v.cliente_id
    into v_venta_vieja, v_variante, v_precio, v_vendidas, v_cliente
    from ventas_lineas vl
    join ventas v on v.id = vl.venta_id
   where vl.id = p_linea_id;

  if v_venta_vieja is null then
    raise exception 'Esa prenda no existe en ninguna venta.';
  end if;

  -- Una prenda no se puede cambiar dos veces.
  select coalesce(sum(cantidad), 0) into v_cambiadas
    from cambios_lineas where linea_id = p_linea_id;

  if v_cambiadas + p_cantidad > v_vendidas then
    raise exception 'De esa prenda se vendieron % y ya se cambiaron %.',
      v_vendidas, v_cambiadas;
  end if;

  v_credito := round(p_cantidad * v_precio, 2);

  for v_linea in select * from jsonb_array_elements(p_nuevas)
  loop
    v_subtotal := v_subtotal
      + (v_linea->>'cantidad')::integer * (v_linea->>'precio_unitario_usd')::numeric;
  end loop;

  -- La regla de la tienda. Nunca sale plata de la caja por un cambio.
  if v_subtotal < v_credito then
    raise exception 'Lo que se lleva vale % y lo que devuelve vale %. Tiene que ser igual o más.',
      v_subtotal, v_credito;
  end if;

  v_diferencia := v_subtotal - v_credito;

  v_tasa := coalesce(
    p_tasa,
    (select bs_por_usd from tasas_venta order by fecha desc limit 1)
  );
  v_numero := nextval('seq_nota_entrega');

  insert into ventas (
    serie, numero, canal, tipo, cliente_id, estado,
    subtotal_usd, descuento_usd, credito_cambio_usd, total_usd,
    tasa_bs_por_usd, total_bs, cambio_de_venta_id, nota, actor_id
  ) values (
    'NE', v_numero, 'tienda', 'contado', v_cliente, 'borrador',
    v_subtotal, 0, v_credito, v_diferencia,
    v_tasa, round(v_diferencia * v_tasa, 2), v_venta_vieja,
    coalesce(p_nota, 'Cambio de la nota NE-' ||
      (select numero::text from ventas where id = v_venta_vieja)),
    v_actor
  )
  returning id into v_venta_id;

  -- La prenda devuelta vuelve al estante.
  insert into movimientos_stock (
    variante_id, tipo, cantidad, referencia_tipo, referencia_id, nota, actor_id
  ) values (
    v_variante, 'devolucion', p_cantidad, 'venta_linea', v_venta_id,
    'Cambio de la nota NE-' ||
      (select numero::text from ventas where id = v_venta_vieja),
    v_actor
  );

  insert into cambios_lineas (venta_id, linea_id, variante_id, cantidad, credito_usd)
  values (v_venta_id, p_linea_id, v_variante, p_cantidad, v_credito);

  -- Las nuevas salen, con su costo congelado como en cualquier venta.
  for v_linea in select * from jsonb_array_elements(p_nuevas)
  loop
    select costo_promedio_usd into v_costo
      from variantes where id = (v_linea->>'variante_id')::uuid for update;

    if not found then
      raise exception 'La prenda escogida ya no existe.';
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

    insert into movimientos_stock (
      variante_id, tipo, cantidad, referencia_tipo, referencia_id, actor_id
    ) values (
      (v_linea->>'variante_id')::uuid,
      'venta',
      -((v_linea->>'cantidad')::integer),
      'venta_linea', v_venta_id, v_actor
    );
  end loop;

  -- La diferencia, si la hay. Un cambio parejo no cobra nada.
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
      v_venta_id, v_pago->>'metodo', v_pago->>'moneda',
      (v_pago->>'monto')::numeric, v_monto_usd,
      case when v_pago->>'moneda' = 'BS' then v_tasa else null end,
      v_pago->>'referencia', 'verificado', v_actor, now()
    );

    v_pagado := v_pagado + v_monto_usd;

    insert into movimientos_financieros (
      tipo, concepto, monto_original, moneda, monto_usd, tasa_usada,
      cuenta, metodo_pago, origen, referencia_id, actor_id
    ) values (
      'ingreso', 'Cambio NE-' || v_numero,
      (v_pago->>'monto')::numeric, v_pago->>'moneda', v_monto_usd,
      case when v_pago->>'moneda' = 'BS' then v_tasa else null end,
      case when v_pago->>'moneda' = 'BS' then 'bs' else 'divisa' end,
      v_pago->>'metodo', 'venta', v_venta_id, v_actor
    );
  end loop;

  update ventas
     set estado = case
                    when v_pagado >= v_diferencia - 0.01 then 'entregada'
                    else 'pendiente_pago'
                  end
   where id = v_venta_id;

  return v_venta_id;
end;
$$;

revoke all on function registrar_cambio(uuid, integer, jsonb, jsonb, numeric, text) from public;
grant execute on function registrar_cambio(uuid, integer, jsonb, jsonb, numeric, text) to authenticated;

commit;
