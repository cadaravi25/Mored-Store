-- Mored Store: esquema inicial
-- Postgres 15+ / Supabase
--
-- Convención: identificadores en español. El dominio es español (apartado, nota
-- de entrega, tanda) y lo van a leer personas que hablan español. El módulo de
-- finanzas portado desde Con Alma Clinic se renombra para que todo sea coherente.
--
-- Dinero: numeric(12,2). Tasas: numeric(14,4). Nunca float.
-- Moneda ancla: USD. Cada monto guarda su valor original + moneda + tasa usada.

begin;

create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. USUARIOS
-- ============================================================================

create table perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  rol         text not null default 'admin' check (rol in ('admin', 'operador')),
  activo      boolean not null default true,
  creado_at   timestamptz not null default now()
);

comment on table perfiles is 'Usuarios del sistema. Hoy son las dos socias, ambas admin. El rol "operador" queda listo para cuando contraten.';

-- ============================================================================
-- 2. CATÁLOGO
-- ============================================================================

create table categorias (
  id          uuid primary key default uuid_generate_v4(),
  coleccion   text not null check (coleccion in ('active', 'swim')),
  nombre      text not null,
  orden       integer not null default 0,
  unique (coleccion, nombre)
);

create table productos (
  id                uuid primary key default uuid_generate_v4(),
  coleccion         text not null check (coleccion in ('active', 'swim')),
  categoria_id      uuid references categorias(id) on delete set null,
  nombre            text not null,
  descripcion       text,
  -- Vendedor dentro de SHEIN (ZJ.WANGWANG, agile...). Sirve para el match
  -- automático al importar pedidos futuros del mismo proveedor.
  vendedor_externo  text,
  activo            boolean not null default true,
  creado_at         timestamptz not null default now(),
  actualizado_at    timestamptz not null default now()
);

create index on productos (coleccion) where activo;
create index on productos (categoria_id);

comment on column productos.nombre is 'Nombre corto propio, editable. NO el título SEO de SHEIN, que además viene truncado en las capturas.';

-- La foto vive a nivel de color, no de variante: 4 tallas x 3 colores son
-- 12 variantes pero solo 3 fotos.
create table colores (
  id                uuid primary key default uuid_generate_v4(),
  producto_id       uuid not null references productos(id) on delete cascade,
  nombre            text not null,
  foto_url          text,
  foto_miniatura_url text,
  orden             integer not null default 0,
  unique (producto_id, nombre)
);

comment on column colores.foto_miniatura_url is 'Recorte de la captura del pedido de SHEIN (~100x100). Suficiente para la pantalla de recepción.';
comment on column colores.foto_url is 'Foto en buena resolución para el catálogo público. Se carga aparte, en fase 3.';

create table variantes (
  id                    uuid primary key default uuid_generate_v4(),
  producto_id           uuid not null references productos(id) on delete cascade,
  color_id              uuid not null references colores(id) on delete cascade,
  talla                 text not null,
  -- Lo que dijo SHEIN literalmente: "2(XS)", "4(S)". Se guarda para auditoría
  -- y para mejorar la tabla de equivalencias cuando aparezca un formato nuevo.
  talla_origen          text,
  sku                   text not null unique,
  -- Código impreso en la etiqueta de la bolsita de SHEIN. Habilita el escaneo
  -- o la lectura con cámara en la recepción.
  codigo_proveedor      text,
  precio_usd            numeric(12,2) not null default 0 check (precio_usd >= 0),
  -- Mantenidos por trigger desde movimientos_stock. Nunca escribir a mano.
  stock                 integer not null default 0,
  costo_promedio_usd    numeric(12,2) not null default 0 check (costo_promedio_usd >= 0),
  activa                boolean not null default true,
  creado_at             timestamptz not null default now(),
  unique (producto_id, color_id, talla)
);

create index on variantes (codigo_proveedor) where codigo_proveedor is not null;
create index on variantes (producto_id);
create index on variantes (stock) where activa;

comment on column variantes.stock is 'Denormalizado. La fuente de verdad es movimientos_stock; este campo lo mantiene un trigger.';
comment on column variantes.costo_promedio_usd is 'Costo landed por promedio ponderado móvil, actualizado en cada entrada.';

-- Equivalencias de talla. Se consulta al importar; si aparece un formato
-- desconocido el importador lo deja crudo y pide confirmación.
create table equivalencias_talla (
  origen  text primary key,
  talla   text not null
);

insert into equivalencias_talla (origen, talla) values
  ('2(XS)', 'XS'), ('4(S)', 'S'),  ('6(M)', 'M'),
  ('8(L)',  'L'),  ('10(XL)', 'XL'), ('12(XXL)', 'XXL'),
  ('XS', 'XS'), ('S', 'S'), ('M', 'M'), ('L', 'L'), ('XL', 'XL'), ('XXL', 'XXL');

-- ============================================================================
-- 3. STOCK (libro mayor)
-- ============================================================================

create table movimientos_stock (
  id                  uuid primary key default uuid_generate_v4(),
  variante_id         uuid not null references variantes(id) on delete restrict,
  tipo                text not null check (tipo in (
                        'entrada_pedido', 'venta', 'devolucion', 'ajuste', 'merma'
                      )),
  -- Positivo entra, negativo sale.
  cantidad            integer not null check (cantidad <> 0),
  -- Solo en entradas: alimenta el promedio ponderado.
  costo_unitario_usd  numeric(12,2) check (costo_unitario_usd >= 0),
  referencia_tipo     text check (referencia_tipo in ('recepcion_linea', 'venta_linea', 'manual')),
  referencia_id       uuid,
  nota                text,
  actor_id            uuid references perfiles(id),
  creado_at           timestamptz not null default now()
);

create index on movimientos_stock (variante_id, creado_at desc);
create index on movimientos_stock (referencia_tipo, referencia_id);

-- Actualiza stock y costo promedio ponderado móvil.
create or replace function fn_aplicar_movimiento_stock()
returns trigger
language plpgsql
as $$
declare
  v_stock_previo  integer;
  v_costo_previo  numeric(12,2);
  v_denominador   integer;
begin
  select stock, costo_promedio_usd
    into v_stock_previo, v_costo_previo
    from variantes
   where id = new.variante_id
   for update;

  -- El costo solo se recalcula en entradas con costo informado.
  if new.cantidad > 0 and new.costo_unitario_usd is not null then
    v_denominador := greatest(v_stock_previo, 0) + new.cantidad;
    update variantes
       set stock = v_stock_previo + new.cantidad,
           costo_promedio_usd = round(
             ((greatest(v_stock_previo, 0) * v_costo_previo)
              + (new.cantidad * new.costo_unitario_usd)) / v_denominador,
             2)
     where id = new.variante_id;
  else
    update variantes
       set stock = v_stock_previo + new.cantidad
     where id = new.variante_id;
  end if;

  return new;
end;
$$;

create trigger tg_aplicar_movimiento_stock
  after insert on movimientos_stock
  for each row execute function fn_aplicar_movimiento_stock();

comment on function fn_aplicar_movimiento_stock is
  'Los movimientos son inmutables: para corregir se inserta un movimiento contrario, nunca se edita ni se borra.';

-- ============================================================================
-- 4. PEDIDOS A PROVEEDOR Y RECEPCIÓN POR TANDAS
-- ============================================================================

create table pedidos_compra (
  id                    uuid primary key default uuid_generate_v4(),
  proveedor             text not null check (proveedor in ('shein', 'alibaba', 'otro')),
  numero_externo        text,
  fecha_pedido          date not null,
  -- Lo que dice el pedido. En los dos pedidos analizados la suma de líneas
  -- cuadra exacto con el total, o sea que SHEIN no cobró envío aparte.
  total_declarado_usd   numeric(12,2) check (total_declarado_usd >= 0),
  estado                text not null default 'abierto'
                          check (estado in ('abierto', 'completo', 'cerrado')),
  nota                  text,
  actor_id              uuid references perfiles(id),
  creado_at             timestamptz not null default now(),
  unique (proveedor, numero_externo)
);

create index on pedidos_compra (estado) where estado = 'abierto';

comment on column pedidos_compra.estado is
  'abierto: espera tandas. completo: todo llegó. cerrado: se cerró a mano dando algo por perdido.';

create table pedidos_compra_lineas (
  id                  uuid primary key default uuid_generate_v4(),
  pedido_id           uuid not null references pedidos_compra(id) on delete cascade,
  -- Nulo mientras no se confirme contra qué variante del catálogo va.
  -- El importador propone, la persona confirma.
  variante_id         uuid references variantes(id) on delete restrict,
  -- Datos crudos del importador, para auditar el match y para reintentarlo.
  titulo_crudo        text,
  color_crudo         text,
  talla_cruda         text,
  vendedor_crudo      text,
  foto_recorte_url    text,
  precio_unitario_usd numeric(12,2) not null check (precio_unitario_usd >= 0),
  cantidad_pedida     integer not null check (cantidad_pedida > 0),
  cantidad_recibida   integer not null default 0 check (cantidad_recibida >= 0),
  creado_at           timestamptz not null default now(),
  check (cantidad_recibida <= cantidad_pedida)
);

create index on pedidos_compra_lineas (pedido_id);
create index on pedidos_compra_lineas (variante_id);

comment on table pedidos_compra_lineas is
  'En SHEIN cada línea es cantidad 1 y las repetidas salen como líneas separadas. El importador las consolida en cantidad_pedida.';

-- Estado derivado, para la vista "Por llegar".
create view v_lineas_pendientes as
select
  l.id,
  l.pedido_id,
  p.proveedor,
  p.numero_externo,
  p.fecha_pedido,
  l.variante_id,
  coalesce(l.titulo_crudo, pr.nombre) as descripcion,
  l.color_crudo,
  l.talla_cruda,
  l.foto_recorte_url,
  l.precio_unitario_usd,
  l.cantidad_pedida,
  l.cantidad_recibida,
  l.cantidad_pedida - l.cantidad_recibida        as cantidad_faltante,
  (l.cantidad_pedida - l.cantidad_recibida)
    * l.precio_unitario_usd                      as monto_faltante_usd,
  current_date - p.fecha_pedido                  as dias_esperando
from pedidos_compra_lineas l
join pedidos_compra p on p.id = l.pedido_id
left join variantes v  on v.id = l.variante_id
left join productos pr on pr.id = v.producto_id
where p.estado = 'abierto'
  and l.cantidad_recibida < l.cantidad_pedida;

comment on view v_lineas_pendientes is
  'La pantalla "Por llegar": qué falta de todos los pedidos abiertos, ordenable por dias_esperando.';

-- Cada paquete que llega es una tanda.
create table recepciones (
  id                  uuid primary key default uuid_generate_v4(),
  pedido_id           uuid not null references pedidos_compra(id) on delete cascade,
  fecha               date not null default current_date,
  tracking            text,
  -- Courier a Venezuela. Se cobra por caja, así que se prorratea por tanda.
  flete_usd           numeric(12,2) not null default 0 check (flete_usd >= 0),
  otros_costos_usd    numeric(12,2) not null default 0 check (otros_costos_usd >= 0),
  metodo_prorrateo    text not null default 'por_unidad'
                        check (metodo_prorrateo in ('por_unidad', 'por_valor')),
  nota                text,
  actor_id            uuid references perfiles(id),
  creado_at           timestamptz not null default now()
);

create index on recepciones (pedido_id);

create table recepciones_lineas (
  id                        uuid primary key default uuid_generate_v4(),
  recepcion_id              uuid not null references recepciones(id) on delete cascade,
  pedido_linea_id           uuid not null references pedidos_compra_lineas(id) on delete restrict,
  cantidad                  integer not null check (cantidad > 0),
  -- precio del artículo + su parte del flete de ESTA tanda
  costo_unitario_landed_usd numeric(12,2) not null check (costo_unitario_landed_usd >= 0),
  creado_at                 timestamptz not null default now(),
  unique (recepcion_id, pedido_linea_id)
);

-- Al registrar una línea recibida: sube el acumulado del pedido y genera el
-- movimiento de stock con el costo landed.
create or replace function fn_aplicar_recepcion_linea()
returns trigger
language plpgsql
as $$
declare
  v_variante_id uuid;
begin
  update pedidos_compra_lineas
     set cantidad_recibida = cantidad_recibida + new.cantidad
   where id = new.pedido_linea_id
  returning variante_id into v_variante_id;

  if v_variante_id is null then
    raise exception 'La línea % no tiene variante asignada. Confirma el match contra el catálogo antes de recibirla.', new.pedido_linea_id;
  end if;

  insert into movimientos_stock (
    variante_id, tipo, cantidad, costo_unitario_usd,
    referencia_tipo, referencia_id
  ) values (
    v_variante_id, 'entrada_pedido', new.cantidad, new.costo_unitario_landed_usd,
    'recepcion_linea', new.id
  );

  return new;
end;
$$;

create trigger tg_aplicar_recepcion_linea
  after insert on recepciones_lineas
  for each row execute function fn_aplicar_recepcion_linea();

-- Cierra el pedido cuando ya no queda nada pendiente.
create or replace function fn_actualizar_estado_pedido()
returns trigger
language plpgsql
as $$
declare
  v_pedido_id uuid;
  v_pendientes integer;
begin
  select pedido_id into v_pedido_id
    from pedidos_compra_lineas where id = new.pedido_linea_id;

  select count(*) into v_pendientes
    from pedidos_compra_lineas
   where pedido_id = v_pedido_id
     and cantidad_recibida < cantidad_pedida;

  if v_pendientes = 0 then
    update pedidos_compra set estado = 'completo'
     where id = v_pedido_id and estado = 'abierto';
  end if;

  return new;
end;
$$;

create trigger tg_actualizar_estado_pedido
  after insert on recepciones_lineas
  for each row execute function fn_actualizar_estado_pedido();

-- ============================================================================
-- 5. TASAS
-- ============================================================================

create table tasas_bcv (
  fecha         date primary key,
  bs_por_usd    numeric(14,4) check (bs_por_usd > 0),
  bs_por_eur    numeric(14,4) check (bs_por_eur > 0),
  fuente        text not null default 've.dolarapi.com',
  obtenido_at   timestamptz not null default now()
);

comment on table tasas_bcv is
  'El BCV publica a las 4 p.m. la tasa del día siguiente. Se guarda por fecha efectiva: la vigente hoy no se mueve cuando llega la pre-publicada.';

-- Mored vende convirtiendo a bolívares con la tasa BCV del EURO. Esta tabla
-- deja registro de qué tasa rigió cada día, por si cambian de criterio.
create table tasas_venta (
  fecha           date primary key,
  bs_por_usd      numeric(14,4) not null check (bs_por_usd > 0),
  base            text not null default 'bcv_eur'
                    check (base in ('bcv_eur', 'bcv_usd', 'manual')),
  actor_id        uuid references perfiles(id),
  creado_at       timestamptz not null default now()
);

comment on column tasas_venta.base is
  'bcv_eur: se cobra en Bs usando la tasa del euro del BCV, que es la práctica actual de Mored.';

-- ============================================================================
-- 6. CLIENTES Y VENTAS
-- ============================================================================

create table clientes (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text not null,
  telefono    text,
  instagram   text,
  cedula      text,
  direccion   text,
  nota        text,
  creado_at   timestamptz not null default now()
);

create index on clientes (telefono);

create table ventas (
  id                uuid primary key default uuid_generate_v4(),
  serie             text not null default 'NE',
  numero            integer not null,
  -- 'tienda' cubre el local de Chacaíto. Sin esto no se puede saber
  -- qué vende el local y qué vende el online.
  canal             text not null check (canal in ('tienda', 'whatsapp', 'instagram', 'catalogo')),
  tipo              text not null default 'contado' check (tipo in ('contado', 'apartado')),
  cliente_id        uuid references clientes(id) on delete set null,
  estado            text not null default 'borrador' check (estado in (
                      'borrador', 'pendiente_pago', 'verificando_pago',
                      'pagada', 'entregada', 'anulada'
                    )),
  subtotal_usd      numeric(12,2) not null default 0 check (subtotal_usd >= 0),
  descuento_usd     numeric(12,2) not null default 0 check (descuento_usd >= 0),
  total_usd         numeric(12,2) not null default 0 check (total_usd >= 0),
  -- Snapshot de la tasa al momento de la venta. Auditable para siempre.
  tasa_bs_por_usd   numeric(14,4),
  total_bs          numeric(12,2),
  nota              text,
  actor_id          uuid references perfiles(id),
  creado_at         timestamptz not null default now(),
  unique (serie, numero)
);

create index on ventas (estado);
create index on ventas (creado_at desc);
create index on ventas (cliente_id);

comment on column ventas.serie is
  'Correlativo propio para notas de entrega no fiscales. El día que salga el RIF se agrega la serie fiscal sin tocar el modelo.';

create table ventas_lineas (
  id                  uuid primary key default uuid_generate_v4(),
  venta_id            uuid not null references ventas(id) on delete cascade,
  variante_id         uuid not null references variantes(id) on delete restrict,
  cantidad            integer not null check (cantidad > 0),
  precio_unitario_usd numeric(12,2) not null check (precio_unitario_usd >= 0),
  -- Snapshot del costo al vender: sin esto el margen histórico se distorsiona
  -- cada vez que entra mercancía a otro costo.
  costo_unitario_usd  numeric(12,2) not null default 0,
  creado_at           timestamptz not null default now()
);

create index on ventas_lineas (venta_id);
create index on ventas_lineas (variante_id);

create table pagos (
  id              uuid primary key default uuid_generate_v4(),
  venta_id        uuid not null references ventas(id) on delete cascade,
  metodo          text not null check (metodo in (
                    'efectivo_usd', 'zelle', 'binance', 'zinli',
                    'efectivo_bs', 'pago_movil', 'transferencia', 'punto'
                  )),
  moneda          text not null check (moneda in ('USD', 'BS')),
  monto           numeric(12,2) not null check (monto > 0),
  monto_usd       numeric(12,2) not null check (monto_usd > 0),
  tasa_usada      numeric(14,4),
  referencia      text,
  estado          text not null default 'reportado'
                    check (estado in ('reportado', 'verificado', 'rechazado')),
  verificado_por  uuid references perfiles(id),
  verificado_at   timestamptz,
  creado_at       timestamptz not null default now()
);

create index on pagos (venta_id);
create index on pagos (estado) where estado = 'reportado';

comment on table pagos is
  'Un apartado son varios pagos parciales sobre la misma venta. La verificación es manual hoy; el estado ya está listo para automatizarla después.';

-- Reserva de stock mientras se verifica el pago o mientras dura un apartado.
create table reservas_stock (
  id          uuid primary key default uuid_generate_v4(),
  venta_id    uuid not null references ventas(id) on delete cascade,
  variante_id uuid not null references variantes(id) on delete restrict,
  cantidad    integer not null check (cantidad > 0),
  vence_at    timestamptz,
  creado_at   timestamptz not null default now()
);

create index on reservas_stock (variante_id);

-- Stock realmente vendible: descuenta lo reservado y no vencido.
create view v_stock_disponible as
select
  v.id as variante_id,
  v.sku,
  v.stock,
  coalesce(sum(r.cantidad) filter (
    where r.vence_at is null or r.vence_at > now()
  ), 0)::integer as reservado,
  v.stock - coalesce(sum(r.cantidad) filter (
    where r.vence_at is null or r.vence_at > now()
  ), 0)::integer as disponible
from variantes v
left join reservas_stock r on r.variante_id = v.id
group by v.id, v.sku, v.stock;

-- ============================================================================
-- 7. FINANZAS
-- ============================================================================

create table movimientos_financieros (
  id              uuid primary key default uuid_generate_v4(),
  tipo            text not null check (tipo in ('ingreso', 'egreso', 'cambio')),
  ocurrido_at     timestamptz not null default now(),
  concepto        text not null,
  categoria       text,
  monto_original  numeric(12,2) not null check (monto_original > 0),
  moneda          text not null check (moneda in ('USD', 'BS')),
  monto_usd       numeric(12,2) not null check (monto_usd > 0),
  tasa_usada      numeric(14,4),
  cuenta          text not null check (cuenta in ('divisa', 'bs')),
  metodo_pago     text,
  origen          text not null default 'manual'
                    check (origen in ('manual', 'venta', 'compra')),
  referencia_id   uuid,
  actor_id        uuid references perfiles(id),
  creado_at       timestamptz not null default now()
);

create index on movimientos_financieros (ocurrido_at desc);
create index on movimientos_financieros (tipo, cuenta);

comment on column movimientos_financieros.tipo is
  'Los cambios de divisa mueven saldo entre cuentas pero NO cuentan como ingreso. Es el error contable clásico de este tipo de negocio.';

-- ============================================================================
-- 8. RLS
-- ============================================================================
-- Hoy son dos socias y ambas ven todo. Se activa RLS igualmente para que la
-- base no quede abierta y para no tener que retrofitearlo después.

do $$
declare t text;
begin
  foreach t in array array[
    'perfiles','categorias','productos','colores','variantes',
    'movimientos_stock','pedidos_compra','pedidos_compra_lineas',
    'recepciones','recepciones_lineas','tasas_bcv','tasas_venta',
    'clientes','ventas','ventas_lineas','pagos','reservas_stock',
    'movimientos_financieros'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      'acceso_' || t, t);
  end loop;
end $$;

-- El catálogo público (fase 3) necesita lectura anónima.
create policy catalogo_publico_productos on productos
  for select to anon using (activo);
create policy catalogo_publico_colores on colores
  for select to anon using (true);
create policy catalogo_publico_variantes on variantes
  for select to anon using (activa);

commit;
