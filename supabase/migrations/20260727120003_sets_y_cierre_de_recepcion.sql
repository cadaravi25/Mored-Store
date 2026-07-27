-- Mored Store: sets multi-pieza y cierre de recepción
--
-- Dos correcciones al modelo de compras:
--
-- 1. SHEIN vende packs. "Set de 3 piezas Mujeres Leggings... Multicolor / 2(XS)"
--    es UNA línea a 13,85 USD que contiene TRES prendas, y en la miniatura se ve
--    que son tres COLORES distintos (negro, rosado, blanco). Mored las vende por
--    separado. Entonces una línea de compra explota en N variantes vendibles.
--    "Multicolor" no es un color: es la señal de que el pack trae varios.
--
-- 2. El flete no se conoce cuando se está desempacando. Antes el stock entraba
--    en el insert de cada línea, lo que obligaba a saber el costo del courier
--    antes de empezar a marcar. Ahora se marca todo y se cierra la tanda al
--    final, con la factura del courier en la mano.

begin;

-- ============================================================================
-- 1. COMPOSICIÓN DE LA LÍNEA DE COMPRA
-- ============================================================================

create table pedidos_compra_lineas_componentes (
  id                uuid primary key default uuid_generate_v4(),
  pedido_linea_id   uuid not null references pedidos_compra_lineas(id) on delete cascade,
  variante_id       uuid not null references variantes(id) on delete restrict,
  -- Cuántas prendas de ESTA variante trae cada pack comprado.
  -- Set de 3 colores distintos: 3 filas con piezas = 1 cada una.
  -- Pack de 2 iguales:          1 fila con piezas = 2.
  -- Artículo suelto:            1 fila con piezas = 1.
  piezas            integer not null default 1 check (piezas > 0),
  unique (pedido_linea_id, variante_id)
);

create index on pedidos_compra_lineas_componentes (variante_id);

comment on table pedidos_compra_lineas_componentes is
  'Traduce lo que se compra (packs) a lo que se vende (prendas sueltas). Siempre hay al menos una fila, también para artículos individuales: un solo camino de código.';

-- Migra el modelo viejo de una variante por línea.
insert into pedidos_compra_lineas_componentes (pedido_linea_id, variante_id, piezas)
select id, variante_id, 1
  from pedidos_compra_lineas
 where variante_id is not null;

-- La vista de la 001 lee variante_id, así que hay que soltarla antes de borrar
-- la columna. Se recrea más abajo, ya sin esa dependencia.
drop view if exists v_lineas_pendientes;

alter table pedidos_compra_lineas drop column variante_id;

-- Piezas vendibles por pack comprado.
create or replace function fn_piezas_por_pack(p_linea_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(sum(piezas), 0)::integer
    from pedidos_compra_lineas_componentes
   where pedido_linea_id = p_linea_id;
$$;

-- ============================================================================
-- 2. VISTA "POR LLEGAR", ACTUALIZADA
-- ============================================================================

drop view if exists v_lineas_pendientes;

create view v_lineas_pendientes as
select
  l.id,
  l.pedido_id,
  p.proveedor,
  p.numero_externo,
  p.fecha_pedido,
  l.titulo_crudo                                  as descripcion,
  l.color_crudo,
  l.talla_cruda,
  l.foto_recorte_url,
  l.precio_unitario_usd,
  l.cantidad_pedida,
  l.cantidad_recibida,
  l.cantidad_pedida - l.cantidad_recibida         as packs_faltantes,
  fn_piezas_por_pack(l.id)                        as piezas_por_pack,
  (l.cantidad_pedida - l.cantidad_recibida)
    * fn_piezas_por_pack(l.id)                    as prendas_faltantes,
  (l.cantidad_pedida - l.cantidad_recibida)
    * l.precio_unitario_usd                       as monto_faltante_usd,
  current_date - p.fecha_pedido                   as dias_esperando,
  exists (
    select 1 from pedidos_compra_lineas_componentes c
     where c.pedido_linea_id = l.id
  )                                               as tiene_match
from pedidos_compra_lineas l
join pedidos_compra p on p.id = l.pedido_id
where p.estado = 'abierto'
  and l.cantidad_recibida < l.cantidad_pedida;

comment on view v_lineas_pendientes is
  'Cantidades en PACKS (que es como llegan) y también en prendas sueltas (que es como se venden). tiene_match avisa si falta confirmar contra el catálogo.';

-- ============================================================================
-- 3. RECEPCIÓN: MARCAR PRIMERO, CERRAR DESPUÉS
-- ============================================================================

drop trigger if exists tg_aplicar_recepcion_linea on recepciones_lineas;
drop trigger if exists tg_actualizar_estado_pedido on recepciones_lineas;
drop function if exists fn_aplicar_recepcion_linea();
drop function if exists fn_actualizar_estado_pedido();

alter table recepciones
  add column estado text not null default 'abierta'
    check (estado in ('abierta', 'cerrada')),
  add column cerrada_at timestamptz;

-- El costo se calcula al cerrar, cuando ya se conoce el flete del courier.
alter table recepciones_lineas
  alter column costo_unitario_landed_usd drop not null;

comment on column recepciones_lineas.costo_unitario_landed_usd is
  'Costo de UN PACK con su parte del flete. Se llena al cerrar la recepción. El costo por prenda es este valor dividido entre las piezas del pack.';

-- Cierra la tanda: prorratea el flete, calcula el costo landed por prenda,
-- genera los movimientos de stock y actualiza el pedido.
create or replace function cerrar_recepcion(p_recepcion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec             recepciones%rowtype;
  v_costos_extra    numeric(12,2);
  v_total_piezas    integer;
  v_total_valor     numeric(12,2);
  v_linea           record;
  v_comp            record;
  v_piezas_linea    integer;
  v_flete_linea     numeric(12,2);
  v_costo_pack      numeric(12,2);
  v_costo_prenda    numeric(12,2);
  v_actor           uuid := auth.uid();
begin
  select * into v_rec from recepciones where id = p_recepcion_id for update;
  if not found then
    raise exception 'Recepción % no existe.', p_recepcion_id;
  end if;
  if v_rec.estado = 'cerrada' then
    raise exception 'La recepción % ya está cerrada.', p_recepcion_id;
  end if;

  -- Toda línea recibida tiene que estar casada contra el catálogo. Es mejor
  -- fallar acá que meter stock huérfano que después nadie sabe qué es.
  if exists (
    select 1
      from recepciones_lineas rl
     where rl.recepcion_id = p_recepcion_id
       and fn_piezas_por_pack(rl.pedido_linea_id) = 0
  ) then
    raise exception 'Hay líneas sin variantes asignadas. Confirma el match contra el catálogo antes de cerrar.';
  end if;

  v_costos_extra := v_rec.flete_usd + v_rec.otros_costos_usd;

  -- El courier cobra por peso, y un pack de 3 pesa como 3 prendas. Por eso el
  -- prorrateo por unidad se hace por PRENDA, no por pack.
  select
    coalesce(sum(rl.cantidad * fn_piezas_por_pack(rl.pedido_linea_id)), 0),
    coalesce(sum(rl.cantidad * pl.precio_unitario_usd), 0)
    into v_total_piezas, v_total_valor
    from recepciones_lineas rl
    join pedidos_compra_lineas pl on pl.id = rl.pedido_linea_id
   where rl.recepcion_id = p_recepcion_id;

  if v_total_piezas = 0 then
    raise exception 'La recepción % no tiene líneas.', p_recepcion_id;
  end if;

  for v_linea in
    select rl.id, rl.cantidad, rl.pedido_linea_id,
           pl.precio_unitario_usd, pl.pedido_id
      from recepciones_lineas rl
      join pedidos_compra_lineas pl on pl.id = rl.pedido_linea_id
     where rl.recepcion_id = p_recepcion_id
  loop
    v_piezas_linea := v_linea.cantidad * fn_piezas_por_pack(v_linea.pedido_linea_id);

    v_flete_linea := case v_rec.metodo_prorrateo
      when 'por_valor' then
        case when v_total_valor > 0
          then v_costos_extra * (v_linea.cantidad * v_linea.precio_unitario_usd) / v_total_valor
          else 0 end
      else
        v_costos_extra * v_piezas_linea::numeric / v_total_piezas
    end;

    -- Costo de un pack, con su flete
    v_costo_pack := round(
      v_linea.precio_unitario_usd + (v_flete_linea / v_linea.cantidad), 2);

    -- Costo de una prenda suelta
    v_costo_prenda := round(
      v_costo_pack / fn_piezas_por_pack(v_linea.pedido_linea_id), 2);

    update recepciones_lineas
       set costo_unitario_landed_usd = v_costo_pack
     where id = v_linea.id;

    -- Un pack de 3 colores genera 3 movimientos de stock, uno por variante.
    for v_comp in
      select variante_id, piezas
        from pedidos_compra_lineas_componentes
       where pedido_linea_id = v_linea.pedido_linea_id
    loop
      insert into movimientos_stock (
        variante_id, tipo, cantidad, costo_unitario_usd,
        referencia_tipo, referencia_id, actor_id
      ) values (
        v_comp.variante_id,
        'entrada_pedido',
        v_linea.cantidad * v_comp.piezas,
        v_costo_prenda,
        'recepcion_linea', v_linea.id, v_actor
      );
    end loop;

    update pedidos_compra_lineas
       set cantidad_recibida = cantidad_recibida + v_linea.cantidad
     where id = v_linea.pedido_linea_id;
  end loop;

  update recepciones
     set estado = 'cerrada', cerrada_at = now()
   where id = p_recepcion_id;

  -- Cierra el pedido si ya no queda nada pendiente.
  update pedidos_compra p
     set estado = 'completo'
   where p.id = v_rec.pedido_id
     and p.estado = 'abierto'
     and not exists (
       select 1 from pedidos_compra_lineas l
        where l.pedido_id = p.id
          and l.cantidad_recibida < l.cantidad_pedida
     );

  -- El courier es un egreso real del negocio.
  if v_costos_extra > 0 then
    insert into movimientos_financieros (
      tipo, concepto, categoria, monto_original, moneda, monto_usd,
      cuenta, origen, referencia_id, actor_id
    ) values (
      'egreso',
      'Flete y courier, recepción del ' || to_char(v_rec.fecha, 'DD/MM/YYYY'),
      'importacion',
      v_costos_extra, 'USD', v_costos_extra,
      'divisa', 'compra', p_recepcion_id, v_actor
    );
  end if;
end;
$$;

comment on function cerrar_recepcion is
  'Marcar la tanda y cerrarla son dos momentos distintos: se marca mientras se desempaca, se cierra cuando se sabe cuánto cobró el courier.';

revoke all on function cerrar_recepcion from public;
grant execute on function cerrar_recepcion to authenticated;

alter table pedidos_compra_lineas_componentes enable row level security;
create policy acceso_pedidos_compra_lineas_componentes
  on pedidos_compra_lineas_componentes
  for all to authenticated using (true) with check (true);

commit;
