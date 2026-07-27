-- Mored Store: recepción por prenda, no por pack
--
-- Cada prenda viene en su propia bolsita (confirmado con foto de las etiquetas),
-- así que un set de 3 llega como 3 bolsitas y puede llegar incompleto. Recibir
-- por pack no puede representar eso.
--
-- El cambio de fondo: lo pendiente se lleva a nivel de COMPONENTE (variante),
-- no de línea de compra. Así "falta el rosado talla M" es una fila real, que es
-- justo lo que hace útil la pantalla de "Por llegar".

begin;

-- ============================================================================
-- 1. LO RECIBIDO SE LLEVA POR COMPONENTE
-- ============================================================================

alter table pedidos_compra_lineas_componentes
  add column piezas_recibidas integer not null default 0
    check (piezas_recibidas >= 0);

comment on column pedidos_compra_lineas_componentes.piezas_recibidas is
  'Prendas de esta variante ya recibidas. Esperadas = linea.cantidad_pedida * piezas.';

-- cantidad_recibida en la línea queda como dato derivado y deja de escribirse.
alter table pedidos_compra_lineas
  drop constraint if exists pedidos_compra_lineas_check;

comment on column pedidos_compra_lineas.cantidad_recibida is
  'OBSOLETO desde 006. Lo recibido se lleva en pedidos_compra_lineas_componentes.piezas_recibidas.';

-- ============================================================================
-- 2. LÍNEAS DE RECEPCIÓN A NIVEL DE PRENDA
-- ============================================================================

drop table if exists recepciones_lineas;

create table recepciones_lineas (
  id                        uuid primary key default uuid_generate_v4(),
  recepcion_id              uuid not null references recepciones(id) on delete cascade,
  componente_id             uuid not null references pedidos_compra_lineas_componentes(id) on delete restrict,
  -- En PRENDAS de esa variante, no en packs.
  cantidad                  integer not null check (cantidad > 0),
  -- Costo de UNA PRENDA con su parte del flete. Se llena al cerrar la tanda.
  costo_unitario_landed_usd numeric(12,2) check (costo_unitario_landed_usd >= 0),
  creado_at                 timestamptz not null default now(),
  unique (recepcion_id, componente_id)
);

create index on recepciones_lineas (componente_id);

-- ============================================================================
-- 3. "POR LLEGAR", AHORA POR PRENDA
-- ============================================================================

drop view if exists v_lineas_pendientes;

create view v_prendas_pendientes as
select
  c.id                                    as componente_id,
  l.id                                    as pedido_linea_id,
  p.id                                    as pedido_id,
  p.proveedor,
  p.numero_externo,
  p.fecha_pedido,
  c.variante_id,
  pr.nombre                               as producto,
  col.nombre                              as color,
  v.talla,
  coalesce(col.foto_miniatura_url, col.foto_url, l.foto_recorte_url) as foto_url,
  l.cantidad_pedida * c.piezas            as piezas_esperadas,
  c.piezas_recibidas,
  l.cantidad_pedida * c.piezas - c.piezas_recibidas as piezas_faltantes,
  -- Costo del artículo por prenda, sin flete todavía.
  round(l.precio_unitario_usd / nullif(fn_piezas_por_pack(l.id), 0), 2) as costo_prenda_usd,
  (l.cantidad_pedida * c.piezas - c.piezas_recibidas)
    * round(l.precio_unitario_usd / nullif(fn_piezas_por_pack(l.id), 0), 2) as monto_faltante_usd,
  current_date - p.fecha_pedido           as dias_esperando
from pedidos_compra_lineas_componentes c
join pedidos_compra_lineas l on l.id = c.pedido_linea_id
join pedidos_compra p        on p.id = l.pedido_id
join variantes v             on v.id = c.variante_id
join productos pr            on pr.id = v.producto_id
join colores col             on col.id = v.color_id
where p.estado = 'abierto'
  and c.piezas_recibidas < l.cantidad_pedida * c.piezas;

comment on view v_prendas_pendientes is
  'Una fila por prenda pendiente: producto, color, talla, foto y días esperando. Es la pantalla "Por llegar".';

-- Líneas del pedido que todavía no se casaron contra el catálogo. No pueden
-- recibirse hasta resolverse.
create view v_lineas_sin_match as
select l.id, l.pedido_id, l.titulo_crudo, l.color_crudo, l.talla_cruda,
       l.foto_recorte_url, l.cantidad_pedida, l.precio_unitario_usd
  from pedidos_compra_lineas l
  join pedidos_compra p on p.id = l.pedido_id
 where p.estado = 'abierto'
   and not exists (
     select 1 from pedidos_compra_lineas_componentes c
      where c.pedido_linea_id = l.id
   );

-- ============================================================================
-- 4. CIERRE DE TANDA, RECALCULADO POR PRENDA
-- ============================================================================

create or replace function cerrar_recepcion(p_recepcion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec           recepciones%rowtype;
  v_costos_extra  numeric(12,2);
  v_total_piezas  integer;
  v_total_valor   numeric(12,2);
  v_fila          record;
  v_costo_articulo numeric(12,2);
  v_flete_prenda  numeric(12,2);
  v_costo_prenda  numeric(12,2);
  v_actor         uuid := auth.uid();
begin
  select * into v_rec from recepciones where id = p_recepcion_id for update;
  if not found then
    raise exception 'Recepción % no existe.', p_recepcion_id;
  end if;
  if v_rec.estado = 'cerrada' then
    raise exception 'La recepción % ya está cerrada.', p_recepcion_id;
  end if;

  v_costos_extra := v_rec.flete_usd + v_rec.otros_costos_usd;

  -- Total de prendas y de valor en ESTA tanda, para prorratear el courier.
  select
    coalesce(sum(rl.cantidad), 0),
    coalesce(sum(rl.cantidad
      * round(l.precio_unitario_usd / nullif(fn_piezas_por_pack(l.id), 0), 2)), 0)
    into v_total_piezas, v_total_valor
    from recepciones_lineas rl
    join pedidos_compra_lineas_componentes c on c.id = rl.componente_id
    join pedidos_compra_lineas l             on l.id = c.pedido_linea_id
   where rl.recepcion_id = p_recepcion_id;

  if v_total_piezas = 0 then
    raise exception 'La recepción % no tiene prendas.', p_recepcion_id;
  end if;

  for v_fila in
    select rl.id, rl.cantidad, rl.componente_id,
           c.variante_id, c.pedido_linea_id,
           l.precio_unitario_usd, l.pedido_id,
           fn_piezas_por_pack(l.id) as piezas_pack
      from recepciones_lineas rl
      join pedidos_compra_lineas_componentes c on c.id = rl.componente_id
      join pedidos_compra_lineas l             on l.id = c.pedido_linea_id
     where rl.recepcion_id = p_recepcion_id
  loop
    v_costo_articulo := round(v_fila.precio_unitario_usd / v_fila.piezas_pack, 2);

    -- El courier cobra por peso, así que el prorrateo por unidad va por prenda.
    v_flete_prenda := case v_rec.metodo_prorrateo
      when 'por_valor' then
        case when v_total_valor > 0
          then round(v_costos_extra * v_costo_articulo / v_total_valor, 2)
          else 0 end
      else
        round(v_costos_extra / v_total_piezas, 2)
    end;

    v_costo_prenda := v_costo_articulo + v_flete_prenda;

    update recepciones_lineas
       set costo_unitario_landed_usd = v_costo_prenda
     where id = v_fila.id;

    insert into movimientos_stock (
      variante_id, tipo, cantidad, costo_unitario_usd,
      referencia_tipo, referencia_id, actor_id
    ) values (
      v_fila.variante_id, 'entrada_pedido', v_fila.cantidad, v_costo_prenda,
      'recepcion_linea', v_fila.id, v_actor
    );

    update pedidos_compra_lineas_componentes
       set piezas_recibidas = piezas_recibidas + v_fila.cantidad
     where id = v_fila.componente_id;
  end loop;

  update recepciones
     set estado = 'cerrada', cerrada_at = now()
   where id = p_recepcion_id;

  -- El pedido se completa cuando no queda ninguna prenda pendiente.
  update pedidos_compra p
     set estado = 'completo'
   where p.id = v_rec.pedido_id
     and p.estado = 'abierto'
     and not exists (
       select 1
         from pedidos_compra_lineas_componentes c
         join pedidos_compra_lineas l on l.id = c.pedido_linea_id
        where l.pedido_id = p.id
          and c.piezas_recibidas < l.cantidad_pedida * c.piezas
     );

  if v_costos_extra > 0 then
    insert into movimientos_financieros (
      tipo, concepto, categoria, monto_original, moneda, monto_usd,
      cuenta, origen, referencia_id, actor_id
    ) values (
      'egreso',
      'Flete y courier, recepción del ' || to_char(v_rec.fecha, 'DD/MM/YYYY'),
      'importacion', v_costos_extra, 'USD', v_costos_extra,
      'divisa', 'compra', p_recepcion_id, v_actor
    );
  end if;
end;
$$;

revoke all on function cerrar_recepcion from public;
grant execute on function cerrar_recepcion to authenticated;

commit;
