-- Mored Store: entrada de mercancía
--
-- Modo simple: cargan SOLO lo que llegó, sin registrar el pedido completo.
-- No hace falta que el sistema sepa qué se pidió; el stock igual queda bien.
--
-- Por debajo se arma un pedido de compra ya cerrado, para reutilizar sin
-- cambios el costeo y los movimientos de stock que ya están probados. Ellas
-- nunca ven ese pedido. Si más adelante quieren registrar pedidos completos y
-- saber qué falta, la estructura ya está lista y no hay que migrar nada.

begin;

create or replace function registrar_entrada(
  p_lineas  jsonb,   -- [{coleccion, tipo_id, detalle, color, talla, cantidad,
                     --   costo_unitario_usd, precio_venta_usd}]
  p_flete_usd numeric default 0,
  p_nota    text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido      uuid;
  v_recepcion   uuid;
  v_linea       jsonb;
  v_tipo        text;
  v_detalle     text;
  v_nombre      text;
  v_variante    uuid;
  v_pedido_lin  uuid;
  v_componente  uuid;
  v_cantidad    integer;
  v_actor       uuid := auth.uid();
begin
  if p_lineas is null or jsonb_array_length(p_lineas) = 0 then
    raise exception 'No hay prendas que registrar.';
  end if;

  insert into pedidos_compra (proveedor, fecha_pedido, estado, nota, actor_id)
  values ('shein', current_date, 'abierto', p_nota, v_actor)
  returning id into v_pedido;

  insert into recepciones (pedido_id, fecha, flete_usd, metodo_prorrateo, nota, actor_id)
  values (v_pedido, current_date, coalesce(p_flete_usd, 0), 'por_unidad', p_nota, v_actor)
  returning id into v_recepcion;

  for v_linea in select * from jsonb_array_elements(p_lineas)
  loop
    v_cantidad := greatest(coalesce((v_linea->>'cantidad')::integer, 1), 1);

    select nombre into v_tipo
      from tipos_prenda where id = (v_linea->>'tipo_id')::uuid;
    if v_tipo is null then
      raise exception 'Tipo de prenda no válido en una de las líneas.';
    end if;

    -- El nombre se arma, nadie lo escribe: "Top tirantes" o solo "Top".
    v_detalle := nullif(trim(coalesce(v_linea->>'detalle', '')), '');
    v_nombre  := v_tipo || coalesce(' ' || v_detalle, '');

    v_variante := obtener_o_crear_variante(
      v_linea->>'coleccion',
      v_nombre,
      v_linea->>'color',
      v_linea->>'talla',
      coalesce((v_linea->>'precio_venta_usd')::numeric, 0)
    );

    -- Completa los datos que obtener_o_crear_variante no conoce y refresca el
    -- precio de venta solo si esta vez lo informaron.
    update productos
       set tipo_id = (v_linea->>'tipo_id')::uuid,
           detalle = v_detalle
     where id = (select producto_id from variantes where id = v_variante)
       and tipo_id is null;

    if (v_linea->>'precio_venta_usd') is not null then
      update variantes
         set precio_usd = (v_linea->>'precio_venta_usd')::numeric
       where id = v_variante;
    end if;

    insert into pedidos_compra_lineas (
      pedido_id, titulo_crudo, color_crudo, talla_cruda,
      precio_unitario_usd, cantidad_pedida
    ) values (
      v_pedido, v_nombre, v_linea->>'color', v_linea->>'talla',
      (v_linea->>'costo_unitario_usd')::numeric, v_cantidad
    )
    returning id into v_pedido_lin;

    insert into pedidos_compra_lineas_componentes (pedido_linea_id, variante_id, piezas)
    values (v_pedido_lin, v_variante, 1)
    returning id into v_componente;

    insert into recepciones_lineas (recepcion_id, componente_id, cantidad)
    values (v_recepcion, v_componente, v_cantidad);
  end loop;

  -- Prorratea el flete si lo hay, calcula el costo landed, mueve el stock y
  -- registra el egreso del courier. Todo ya probado.
  perform cerrar_recepcion(v_recepcion);

  return v_recepcion;
end;
$$;

comment on function registrar_entrada is
  'Una sola transaccion: si algo falla, no entra ninguna prenda a medias.';

revoke all on function registrar_entrada from public;
grant execute on function registrar_entrada to authenticated;

-- Lo cargado en una entrada, para la pantalla de confirmación.
create or replace function resumen_entrada(p_recepcion_id uuid)
returns table (
  producto   text,
  color      text,
  talla      text,
  cantidad   integer,
  costo_usd  numeric
)
language sql
stable
as $$
  select p.nombre, c.nombre, v.talla, rl.cantidad, rl.costo_unitario_landed_usd
    from recepciones_lineas rl
    join pedidos_compra_lineas_componentes comp on comp.id = rl.componente_id
    join variantes v  on v.id = comp.variante_id
    join productos p  on p.id = v.producto_id
    join colores   c  on c.id = v.color_id
   where rl.recepcion_id = p_recepcion_id
   order by p.nombre, c.nombre, v.talla;
$$;

grant execute on function resumen_entrada to authenticated;

commit;
