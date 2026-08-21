-- Las órdenes que llegan desde la tienda.
--
-- EL PROBLEMA
--
-- Hasta ahora pedir por la web no guardaba nada: se armaba el mensaje, se abría
-- WhatsApp y se acabó. A ellas les llegaba "chaqueta negro talla s" y tenían
-- que adivinar cuál de las siete chaquetas negras era.
--
-- NO HACE FALTA UNA TABLA NUEVA
--
-- Una orden de la web es una venta que todavía no se cobró. Y `ventas` ya venía
-- preparada para esto desde el esquema inicial: `canal` acepta 'catalogo' y
-- `estado` acepta 'borrador'. Nadie más deja una venta en borrador, porque
-- registrar_venta_mostrador la pasa a 'entregada' antes de terminar, así que
-- `canal = 'catalogo' and estado = 'borrador'` señala exactamente las órdenes
-- sin atender y nada más.
--
-- Hacerlo así tiene una ventaja que una tabla aparte no tendría: la orden ya
-- nace dentro de la contabilidad, con su número de nota y sus líneas, y al
-- cobrarla no hay que copiar nada de un sitio a otro.
--
-- LOS PRECIOS NO LOS PONE EL NAVEGADOR
--
-- crear_orden recibe qué prenda y cuántas, nada más. El precio lo lee de la
-- base. Si viniera del navegador, cualquiera podría pedir la chaqueta de 18
-- euros por uno.

begin;

-- ---------------------------------------------------------------------------
-- Un estado más: la orden que ya se atendió
-- ---------------------------------------------------------------------------

-- Al cobrarla deja de estar pendiente pero no se borra ni se anula: queda
-- marcada como atendida, para poder saber después qué se pidió por la web.
alter table ventas drop constraint if exists ventas_estado_check;
alter table ventas add constraint ventas_estado_check check (estado in (
  'borrador', 'pendiente_pago', 'verificando_pago',
  'pagada', 'entregada', 'anulada', 'atendida'
));

comment on column ventas.canal is
  'De dónde salió. ''catalogo'' es la tienda web: si además está en borrador, es una orden que nadie ha atendido.';

-- ---------------------------------------------------------------------------
-- Crear una orden desde la tienda
-- ---------------------------------------------------------------------------

create or replace function crear_orden(p_lineas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funcion$
declare
  v_venta    uuid;
  v_numero   integer;
  v_linea    jsonb;
  v_precio   numeric(12,2);
  v_base_bs  numeric(12,2);
  v_costo    numeric(12,2);
  v_cant     integer;
  v_sub      numeric(12,2) := 0;
  v_sub_bs   numeric(12,2) := 0;
  v_tasa     numeric(14,4);
begin
  if p_lineas is null or jsonb_array_length(p_lineas) = 0 then
    raise exception 'La orden no tiene prendas.';
  end if;

  -- Un tope por si alguien llama esto desde fuera de la tienda. Nadie pide
  -- treinta prendas distintas por WhatsApp.
  if jsonb_array_length(p_lineas) > 30 then
    raise exception 'Demasiadas prendas en una sola orden.';
  end if;

  v_tasa := (select bs_por_usd from tasas_venta order by fecha desc limit 1);
  v_numero := nextval('seq_nota_entrega');

  insert into ventas (
    serie, numero, canal, tipo, estado,
    subtotal_usd, descuento_usd, total_usd, tasa_bs_por_usd
  ) values (
    'NE', v_numero, 'catalogo', 'contado', 'borrador',
    0, 0, 0, v_tasa
  )
  returning id into v_venta;

  for v_linea in select * from jsonb_array_elements(p_lineas)
  loop
    v_cant := least(greatest(coalesce((v_linea->>'cantidad')::integer, 1), 1), 10);

    -- El precio y el costo salen de aquí, no de quien llama.
    select precio_usd,
           case when precio_bs > 0 then precio_bs else precio_usd end,
           coalesce(costo_promedio_usd, 0)
      into v_precio, v_base_bs, v_costo
      from variantes
     where id = (v_linea->>'variante_id')::uuid
       and activa;

    -- Una prenda que ya no existe o se desactivó no tumba la orden entera: se
    -- salta. Que llegue incompleta y ellas lo vean es mejor que perderla.
    if not found then
      continue;
    end if;

    insert into ventas_lineas (
      venta_id, variante_id, cantidad, precio_unitario_usd, costo_unitario_usd
    ) values (v_venta, (v_linea->>'variante_id')::uuid, v_cant, v_precio, v_costo);

    v_sub    := v_sub + v_cant * v_precio;
    v_sub_bs := v_sub_bs + v_cant * v_base_bs;
  end loop;

  if not exists (select 1 from ventas_lineas where venta_id = v_venta) then
    delete from ventas where id = v_venta;
    raise exception 'Ninguna de esas prendas está disponible.';
  end if;

  -- No se descuenta stock ni se reserva. La prenda sigue vendible en el local
  -- hasta que alguien cobre: bloquear inventario por una orden que quizá no se
  -- concreta es peor que la carrera, y ellas hablan por WhatsApp de todos modos.
  --
  -- El total en bolívares NO es el de divisas por la tasa. Son dos precios que
  -- ellas fijan por separado, así que se suman las bases de bolívares aparte y
  -- esa suma es la que se multiplica.
  update ventas
     set subtotal_usd = v_sub,
         total_usd    = v_sub,
         total_bs     = round(v_sub_bs * coalesce(v_tasa, 0), 2)
   where id = v_venta;

  return jsonb_build_object('id', v_venta, 'numero', v_numero);
end;
$funcion$;

comment on function crear_orden is
  'Registra un pedido hecho desde la tienda web. Los precios los pone la base, nunca quien llama.';

revoke all on function crear_orden(jsonb) from public;
grant execute on function crear_orden(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Las órdenes, para el panel
-- ---------------------------------------------------------------------------

-- Una fila por prenda pedida, con todo resuelto. La foto viene heredada igual
-- que en la tienda, porque un color sin foto propia toma la primera de su
-- producto, y en el panel hace falta reconocer la prenda de un vistazo: para
-- eso es toda esta pantalla.
create or replace function ordenes_del_catalogo(p_dias integer default 30)
returns table (
  venta_id     uuid,
  numero       integer,
  estado       text,
  creado_at    timestamptz,
  total_usd    numeric,
  total_bs     numeric,
  linea_id     uuid,
  variante_id  uuid,
  producto_id  uuid,
  producto     text,
  descripcion  text,
  coleccion    text,
  color        text,
  hex          text,
  talla        text,
  cantidad     integer,
  precio_usd   numeric,
  precio_bs    numeric,
  foto_url     text,
  disponible   integer
)
language sql
stable
security definer
set search_path = public
as $funcion$
  select
    v.id, v.numero, v.estado, v.creado_at, v.total_usd, v.total_bs,
    l.id, l.variante_id, p.id,
    p.nombre, p.descripcion, p.coleccion,
    c.nombre, cc.hex, va.talla, l.cantidad,
    l.precio_unitario_usd,
    case when va.precio_bs > 0 then va.precio_bs else l.precio_unitario_usd end,
    coalesce(c.foto_url, respaldo.foto_url),
    greatest(va.stock, 0)
  from ventas v
  join ventas_lineas l on l.venta_id = v.id
  join variantes va    on va.id = l.variante_id
  join productos p     on p.id = va.producto_id
  join colores c       on c.id = va.color_id
  left join colores_catalogo cc on lower(cc.nombre) = lower(c.nombre)
  left join lateral (
    select c2.foto_url
      from colores c2
     where c2.producto_id = p.id and c2.foto_url is not null
     order by c2.orden
     limit 1
  ) respaldo on true
  where v.canal = 'catalogo'
    and v.creado_at >= now() - make_interval(days => greatest(p_dias, 1))
  order by v.creado_at desc, l.creado_at;
$funcion$;

revoke all on function ordenes_del_catalogo(integer) from public;
grant execute on function ordenes_del_catalogo(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancelar
-- ---------------------------------------------------------------------------

create or replace function cancelar_orden(p_venta_id uuid, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = public
as $funcion$
begin
  update ventas
     set estado = 'anulada',
         nota   = coalesce(p_nota, nota)
   where id = p_venta_id
     and canal = 'catalogo'
     and estado = 'borrador';

  if not found then
    raise exception 'Esa orden ya no está pendiente.';
  end if;
end;
$funcion$;

revoke all on function cancelar_orden(uuid, text) from public;
grant execute on function cancelar_orden(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Marcarla como atendida al cobrarla
-- ---------------------------------------------------------------------------

-- El cobro se hace en Vender, con el punto de venta de siempre: ahí están los
-- métodos de pago, la tasa, el cliente y el arqueo. Duplicar todo eso en la
-- pantalla de órdenes sería mantener dos veces lo mismo. Así que la orden solo
-- se marca, y la venta de verdad la registra el punto de venta.
create or replace function marcar_orden_atendida(p_venta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funcion$
begin
  update ventas
     set estado = 'atendida'
   where id = p_venta_id
     and canal = 'catalogo'
     and estado = 'borrador';
end;
$funcion$;

revoke all on function marcar_orden_atendida(uuid) from public;
grant execute on function marcar_orden_atendida(uuid) to authenticated;

commit;
