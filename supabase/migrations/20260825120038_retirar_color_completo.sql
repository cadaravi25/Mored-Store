-- Mored Store: que quitar un color funcione también con lo que vino de un pedido
--
-- La primera versión solo miraba las ventas y el stock, y se rompía con una
-- prenda que hubiera entrado por un pedido de compra: la línea del pedido
-- sigue apuntando a la variante y la base no deja borrarla. Justo el caso de
-- las prendas de prueba, que nacieron de un pedido de prueba.
--
-- DÓNDE ESTÁ LA FRONTERA
--
-- No se borra nada de lo que dejó rastro de dinero o de mercancía: si de ese
-- color salió una venta, o si llegó en una recepción, se desactiva. Desaparece
-- de la tienda y del inventario, pero Caja, Finanzas y el historial de
-- entradas siguen cuadrando.
--
-- Solo se borra de verdad lo que nunca se vendió ni se recibió: una prenda
-- cargada por error. De esa sí se limpia el rastro entero, incluido el enlace
-- con la línea del pedido de compra. La línea en sí se queda con su texto
-- crudo, que es lo que cuenta qué se le pidió al proveedor.

begin;

create or replace function retirar_color(p_color_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto  uuid;
  v_vendidas  integer;
  v_variantes integer;
  v_borrado   boolean;
  v_quedan    integer;
begin
  select producto_id into v_producto from colores where id = p_color_id;
  if v_producto is null then
    raise exception 'Ese color ya no existe.';
  end if;

  select count(*) into v_vendidas
    from ventas_lineas vl
    join variantes v on v.id = vl.variante_id
   where v.color_id = p_color_id;

  select count(*) into v_variantes from variantes where color_id = p_color_id;

  -- Una recepción cerrada dice que esa mercancía llegó de verdad. Cuenta igual
  -- que una venta: es historial y no se toca.
  select v_vendidas + count(*) into v_vendidas
    from recepciones_lineas rl
    join pedidos_compra_lineas_componentes pc on pc.id = rl.componente_id
    join variantes v on v.id = pc.variante_id
   where v.color_id = p_color_id;

  if v_vendidas > 0 then
    update variantes set activa = false where color_id = p_color_id;
    v_borrado := false;
  else
    -- El enlace con el pedido de compra, no el pedido. La línea se queda con
    -- su texto crudo, que es lo que de verdad cuenta lo que se pidió.
    delete from pedidos_compra_lineas_componentes
     where variante_id in (select id from variantes where color_id = p_color_id);
    delete from conteos_lineas
     where variante_id in (select id from variantes where color_id = p_color_id);
    delete from movimientos_stock
     where variante_id in (select id from variantes where color_id = p_color_id);
    delete from reservas_stock
     where variante_id in (select id from variantes where color_id = p_color_id);
    delete from variantes where color_id = p_color_id;
    delete from fotos_color where color_id = p_color_id;
    delete from colores where id = p_color_id;
    v_borrado := true;
  end if;

  select count(*) into v_quedan
    from variantes where producto_id = v_producto and activa;

  if v_quedan = 0 then
    update productos set activo = false where id = v_producto;
  end if;

  return jsonb_build_object(
    'borrado', v_borrado,
    'con_historial', v_vendidas,
    'variantes', v_variantes,
    'prenda_retirada', v_quedan = 0
  );
end;
$$;

revoke all on function retirar_color(uuid) from public;
grant execute on function retirar_color(uuid) to authenticated;

commit;
