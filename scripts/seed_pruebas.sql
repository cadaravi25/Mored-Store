-- Mored Store: datos de prueba con los dos pedidos reales de SHEIN
--
-- NO es una migración: vive fuera de supabase/migrations/ a propósito, para que
-- nunca se aplique sola sobre datos reales.
--
-- El objetivo es validar la ARITMÉTICA del modelo, no cargar catálogo real:
--   - Un pack de 3 se convierte en 3 variantes vendibles
--   - El costo por prenda sale de dividir el pack, no del precio de la línea
--   - El flete del courier se prorratea por prenda recibida
--   - La suma de las líneas cuadra con el total del pedido
--
-- Los COLORES de los sets son supuestos, leídos de miniaturas de 100 px. En
-- producción los confirma una persona; acá solo hacen falta para que el modelo
-- tenga tres variantes distintas por pack.
--
-- Limpieza: al final hay un bloque comentado para borrar todo.

begin;

do $$
declare
  -- Pedido 1: GSU18F02U00NEJJ, 5 artículos, 65,14 USD
  v_p1  uuid;
  -- Pedido 2: GSU18F02U00NESW, 15 artículos, 144,27 USD
  v_p2  uuid;
  v_l   uuid;
  v_rec uuid;
begin
  -- ==========================================================================
  -- PEDIDO 1
  -- ==========================================================================
  insert into pedidos_compra (proveedor, numero_externo, fecha_pedido, total_declarado_usd, estado)
  values ('shein', 'GSU18F02U00NEJJ', current_date - 30, 65.14, 'abierto')
  returning id into v_p1;

  -- Set de 3 piezas leggings 3/4, XS, 14.34
  insert into pedidos_compra_lineas
    (pedido_id, titulo_crudo, color_crudo, talla_cruda, vendedor_crudo, precio_unitario_usd, cantidad_pedida)
  values (v_p1, 'Set de 3 piezas Mujeres Leggings ce ñidos de cintura alta 3/4, Shorts de y',
          'Multicolor', '2(XS)', 'ZJ.WANGWANG', 14.34, 1)
  returning id into v_l;
  insert into pedidos_compra_lineas_componentes (pedido_linea_id, variante_id, piezas) values
    (v_l, obtener_o_crear_variante('active','Set 3 piezas leggings 3/4','Negro','2(XS)',18.00), 1),
    (v_l, obtener_o_crear_variante('active','Set 3 piezas leggings 3/4','Rosado','2(XS)',18.00), 1),
    (v_l, obtener_o_crear_variante('active','Set 3 piezas leggings 3/4','Blanco','2(XS)',18.00), 1);

  -- 3 piezas shorts levanta cola, XS, 14.03
  insert into pedidos_compra_lineas
    (pedido_id, titulo_crudo, color_crudo, talla_cruda, vendedor_crudo, precio_unitario_usd, cantidad_pedida)
  values (v_p1, '3 piezas Pantalones cortos deportivo s de cintura alta delgada que levanta',
          'Multicolor', '2(XS)', 'ZJ.WANGWANG', 14.03, 1)
  returning id into v_l;
  insert into pedidos_compra_lineas_componentes (pedido_linea_id, variante_id, piezas) values
    (v_l, obtener_o_crear_variante('active','Shorts deportivos levanta','Verde claro','2(XS)',17.00), 1),
    (v_l, obtener_o_crear_variante('active','Shorts deportivos levanta','Menta','2(XS)',17.00), 1),
    (v_l, obtener_o_crear_variante('active','Shorts deportivos levanta','Verde oscuro','2(XS)',17.00), 1);

  -- 3 piezas shorts ajustados, S, 14.19
  insert into pedidos_compra_lineas
    (pedido_id, titulo_crudo, color_crudo, talla_cruda, vendedor_crudo, precio_unitario_usd, cantidad_pedida)
  values (v_p1, '3 piezas Mujeres Pantalones cortos d eportivos de cintura alta ajustados, S',
          'Multicolor', '4(S)', 'ZJ.WANGWANG', 14.19, 1)
  returning id into v_l;
  insert into pedidos_compra_lineas_componentes (pedido_linea_id, variante_id, piezas) values
    (v_l, obtener_o_crear_variante('active','Shorts deportivos ajustados','Negro','4(S)',17.00), 1),
    (v_l, obtener_o_crear_variante('active','Shorts deportivos ajustados','Blanco','4(S)',17.00), 1),
    (v_l, obtener_o_crear_variante('active','Shorts deportivos ajustados','Gris','4(S)',17.00), 1);

  -- 3 piezas shorts levanta cola (otro surtido), XS, 14.11
  insert into pedidos_compra_lineas
    (pedido_id, titulo_crudo, color_crudo, talla_cruda, vendedor_crudo, precio_unitario_usd, cantidad_pedida)
  values (v_p1, '3 piezas Pantalones cortos deportivo s de cintura alta delgada que levanta',
          'Multicolor', '2(XS)', 'ZJ.WANGWANG', 14.11, 1)
  returning id into v_l;
  insert into pedidos_compra_lineas_componentes (pedido_linea_id, variante_id, piezas) values
    (v_l, obtener_o_crear_variante('active','Shorts deportivos levanta pastel','Rosado','2(XS)',17.00), 1),
    (v_l, obtener_o_crear_variante('active','Shorts deportivos levanta pastel','Amarillo','2(XS)',17.00), 1),
    (v_l, obtener_o_crear_variante('active','Shorts deportivos levanta pastel','Lila','2(XS)',17.00), 1);

  -- Top blanco S suelto, 8.47
  insert into pedidos_compra_lineas
    (pedido_id, titulo_crudo, color_crudo, talla_cruda, vendedor_crudo, precio_unitario_usd, cantidad_pedida)
  values (v_p1, 'Top corto sin mangas de activewear deportivo de yoga para mujer, tanque',
          'Blanco', '4(S)', 'agile', 8.47, 1)
  returning id into v_l;
  insert into pedidos_compra_lineas_componentes (pedido_linea_id, variante_id, piezas) values
    (v_l, obtener_o_crear_variante('active','Top deportivo tanque','Blanco','4(S)',14.00), 1);

  -- ==========================================================================
  -- PEDIDO 2
  -- ==========================================================================
  insert into pedidos_compra (proveedor, numero_externo, fecha_pedido, total_declarado_usd, estado)
  values ('shein', 'GSU18F02U00NESW', current_date - 23, 144.27, 'abierto')
  returning id into v_p2;

  -- 2 packs iguales en S (SHEIN los lista como 2 líneas; el importador consolida)
  insert into pedidos_compra_lineas
    (pedido_id, titulo_crudo, color_crudo, talla_cruda, vendedor_crudo, precio_unitario_usd, cantidad_pedida)
  values (v_p2, 'Set de 3 piezas Mujeres Leggings ce ñidos de cintura alta 3/4, Shorts de y',
          'Multicolor', '4(S)', 'ZJ.WANGWANG', 13.85, 2)
  returning id into v_l;
  insert into pedidos_compra_lineas_componentes (pedido_linea_id, variante_id, piezas) values
    (v_l, obtener_o_crear_variante('active','Set 3 piezas leggings 3/4','Negro','4(S)',18.00), 1),
    (v_l, obtener_o_crear_variante('active','Set 3 piezas leggings 3/4','Rosado','4(S)',18.00), 1),
    (v_l, obtener_o_crear_variante('active','Set 3 piezas leggings 3/4','Blanco','4(S)',18.00), 1);

  -- 2 packs iguales en M
  insert into pedidos_compra_lineas
    (pedido_id, titulo_crudo, color_crudo, talla_cruda, vendedor_crudo, precio_unitario_usd, cantidad_pedida)
  values (v_p2, 'Set de 3 piezas Mujeres Leggings ce ñidos de cintura alta 3/4, Shorts de y',
          'Multicolor', '6(M)', 'ZJ.WANGWANG', 13.85, 2)
  returning id into v_l;
  insert into pedidos_compra_lineas_componentes (pedido_linea_id, variante_id, piezas) values
    (v_l, obtener_o_crear_variante('active','Set 3 piezas leggings 3/4','Negro','6(M)',18.00), 1),
    (v_l, obtener_o_crear_variante('active','Set 3 piezas leggings 3/4','Rosado','6(M)',18.00), 1),
    (v_l, obtener_o_crear_variante('active','Set 3 piezas leggings 3/4','Blanco','6(M)',18.00), 1);

  -- 11 tops sueltos de agile
  declare
    v_tops text[][] := array[
      ['Top yoga camiseta', 'Morado',  '4(S)', '7.69'],
      ['Top yoga camiseta', 'Morado',  '6(M)', '7.69'],
      ['Top fitness tanque','Negro',   '4(S)', '8.54'],
      ['Top fitness tanque','Negro',   '6(M)', '8.54'],
      ['Top deportivo camisa','Celeste','4(S)', '7.77'],
      ['Top deportivo camisa','Celeste','6(M)', '7.77'],
      ['Top deportivo tanque','Burdeos','4(S)', '8.15'],
      ['Top deportivo tanque','Burdeos','6(M)', '8.15'],
      ['Top deportivo tanque','Blanco', '6(M)', '8.19']
    ];
    v_i integer;
  begin
    -- El blanco talla S vino repetido: 2 unidades en una sola línea
    insert into pedidos_compra_lineas
      (pedido_id, titulo_crudo, color_crudo, talla_cruda, vendedor_crudo, precio_unitario_usd, cantidad_pedida)
    values (v_p2, 'Top corto sin mangas de activewear deportivo de yoga para mujer, tanque',
            'Blanco', '4(S)', 'agile', 8.19, 2)
    returning id into v_l;
    insert into pedidos_compra_lineas_componentes (pedido_linea_id, variante_id, piezas) values
      (v_l, obtener_o_crear_variante('active','Top deportivo tanque','Blanco','4(S)',14.00), 1);

    for v_i in 1 .. array_length(v_tops, 1) loop
      insert into pedidos_compra_lineas
        (pedido_id, titulo_crudo, color_crudo, talla_cruda, vendedor_crudo, precio_unitario_usd, cantidad_pedida)
      values (v_p2, v_tops[v_i][1], v_tops[v_i][2], v_tops[v_i][3], 'agile',
              v_tops[v_i][4]::numeric, 1)
      returning id into v_l;
      insert into pedidos_compra_lineas_componentes (pedido_linea_id, variante_id, piezas) values
        (v_l, obtener_o_crear_variante('active', v_tops[v_i][1], v_tops[v_i][2], v_tops[v_i][3], 14.00), 1);
    end loop;
  end;

  -- ==========================================================================
  -- TANDA 1 DEL PEDIDO 2
  -- Llegan los 11 tops sueltos + un pack completo en S (3 prendas) = 14 prendas.
  -- Courier: 35 USD  ->  35 / 14 = 2,50 por prenda.
  -- ==========================================================================
  insert into recepciones (pedido_id, fecha, tracking, flete_usd, metodo_prorrateo)
  values (v_p2, current_date - 5, 'TANDA-1', 35.00, 'por_unidad')
  returning id into v_rec;

  -- Todos los tops del pedido 2
  insert into recepciones_lineas (recepcion_id, componente_id, cantidad)
  select v_rec, c.id, l.cantidad_pedida * c.piezas
    from pedidos_compra_lineas l
    join pedidos_compra_lineas_componentes c on c.pedido_linea_id = l.id
   where l.pedido_id = v_p2
     and l.titulo_crudo like 'Top%';

  -- Un solo pack en S: una prenda de cada color
  insert into recepciones_lineas (recepcion_id, componente_id, cantidad)
  select v_rec, c.id, 1
    from pedidos_compra_lineas l
    join pedidos_compra_lineas_componentes c on c.pedido_linea_id = l.id
   where l.pedido_id = v_p2
     and l.titulo_crudo like 'Set de 3%'
     and l.talla_cruda = '4(S)';

  perform cerrar_recepcion(v_rec);
end $$;

commit;

-- ============================================================================
