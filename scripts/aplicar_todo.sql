-- Mored Store: las siete migraciones en un solo archivo.
-- Generado para aplicar desde el editor SQL de Supabase, sin CLI ni contrasena.
-- El orden importa: cada migracion asume el estado que dejo la anterior.

-- ============================================================================
-- 20260727120001_esquema_inicial.sql
-- ============================================================================
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


-- ============================================================================
-- 20260727120002_punto_de_venta.sql
-- ============================================================================
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
create extension if not exists unaccent;

-- ============================================================================
-- 1. BÚSQUEDA
-- ============================================================================

-- unaccent() no es inmutable de fábrica y por eso no se puede indexar directo.
-- Este wrapper la fija al diccionario por defecto para poder crear el índice.
create or replace function f_normalizar(texto text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select lower(unaccent('unaccent'::regdictionary, texto));
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


-- ============================================================================
-- 20260727120003_sets_y_cierre_de_recepcion.sql
-- ============================================================================
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


-- ============================================================================
-- 20260727120004_cierre_caja_sync_offline.sql
-- ============================================================================
-- Mored Store: cierre de caja diario, sincronización offline e identidad SHEIN
--
-- 1. Identidad estable del producto en SHEIN, para que el reorden se case solo.
-- 2. Marcas de tiempo para que la tablet cachee el catálogo y funcione sin
--    conexión en modo lectura.
-- 3. Cierre de caja diario del local de Chacaíto.

begin;

-- ============================================================================
-- 1. IDENTIDAD EXTERNA DEL PRODUCTO
-- ============================================================================

alter table productos
  add column id_externo   text,
  add column url_externa  text,
  add column titulo_completo text;

create unique index idx_productos_id_externo
  on productos (id_externo)
  where id_externo is not null;

comment on column productos.id_externo is
  'ID del producto en SHEIN, extraído del link. Es la identidad estable: con esto un reorden del mismo artículo se casa solo, sin comparar títulos truncados.';
comment on column productos.url_externa is
  'Link del producto. Se pega UNA VEZ en la vida del producto, no en cada pedido.';
comment on column productos.titulo_completo is
  'Título sin truncar, recuperado del slug del link. La captura del pedido solo trae dos renglones.';

-- ============================================================================
-- 2. SINCRONIZACIÓN PARA LECTURA OFFLINE
-- ============================================================================
-- La tablet cachea el catálogo y sincroniza solo lo que cambió desde su última
-- consulta. Sin marca de tiempo tendría que bajar todo cada vez.

alter table colores   add column actualizado_at timestamptz not null default now();
alter table variantes add column actualizado_at timestamptz not null default now();

create or replace function fn_tocar_actualizado_at()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_at := now();
  return new;
end;
$$;

create trigger tg_tocar_productos before update on productos
  for each row execute function fn_tocar_actualizado_at();
create trigger tg_tocar_colores   before update on colores
  for each row execute function fn_tocar_actualizado_at();
create trigger tg_tocar_variantes before update on variantes
  for each row execute function fn_tocar_actualizado_at();

create index on productos (actualizado_at);
create index on colores   (actualizado_at);
create index on variantes (actualizado_at);

-- El stock cambia por trigger desde movimientos_stock, así que también toca
-- la marca de tiempo de la variante y la tablet lo ve en el próximo sync.
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

  if new.cantidad > 0 and new.costo_unitario_usd is not null then
    v_denominador := greatest(v_stock_previo, 0) + new.cantidad;
    update variantes
       set stock = v_stock_previo + new.cantidad,
           costo_promedio_usd = round(
             ((greatest(v_stock_previo, 0) * v_costo_previo)
              + (new.cantidad * new.costo_unitario_usd)) / v_denominador,
             2),
           actualizado_at = now()
     where id = new.variante_id;
  else
    update variantes
       set stock = v_stock_previo + new.cantidad,
           actualizado_at = now()
     where id = new.variante_id;
  end if;

  return new;
end;
$$;

-- Lo que la tablet baja para trabajar sin conexión.
create or replace function sincronizar_catalogo(p_desde timestamptz default null)
returns table (
  variante_id     uuid,
  producto_id     uuid,
  producto_nombre text,
  coleccion       text,
  color_nombre    text,
  foto_url        text,
  talla           text,
  sku             text,
  codigo_proveedor text,
  precio_usd      numeric(12,2),
  stock           integer,
  activa          boolean,
  actualizado_at  timestamptz
)
language sql
stable
as $$
  select
    v.id, p.id, p.nombre, p.coleccion, c.nombre,
    coalesce(c.foto_url, c.foto_miniatura_url),
    v.talla, v.sku, v.codigo_proveedor, v.precio_usd, v.stock, v.activa,
    greatest(v.actualizado_at, c.actualizado_at, p.actualizado_at)
  from variantes v
  join productos p on p.id = v.producto_id
  join colores   c on c.id = v.color_id
  where p_desde is null
     or greatest(v.actualizado_at, c.actualizado_at, p.actualizado_at) > p_desde
  order by greatest(v.actualizado_at, c.actualizado_at, p.actualizado_at);
$$;

comment on function sincronizar_catalogo is
  'Sync incremental para la tablet. Sin argumento baja todo; con p_desde baja solo lo cambiado. Incluye variantes inactivas para que el dispositivo sepa retirarlas de su caché.';

grant execute on function sincronizar_catalogo to authenticated;

-- ============================================================================
-- 3. CIERRE DE CAJA DIARIO
-- ============================================================================

create table cierres_caja (
  id                      uuid primary key default uuid_generate_v4(),
  fecha                   date not null unique,
  estado                  text not null default 'abierto'
                            check (estado in ('abierto', 'cerrado')),
  -- Lo que contaron físicamente
  efectivo_usd_contado    numeric(12,2),
  efectivo_bs_contado     numeric(12,2),
  -- Lo que dice el sistema que debería haber
  efectivo_usd_esperado   numeric(12,2),
  efectivo_bs_esperado    numeric(12,2),
  -- Contado menos esperado. Negativo es faltante.
  diferencia_usd          numeric(12,2),
  diferencia_bs           numeric(12,2),
  total_ventas_usd        numeric(12,2),
  cantidad_ventas         integer,
  tasa_usada              numeric(14,4),
  nota                    text,
  actor_id                uuid references perfiles(id),
  cerrado_at              timestamptz,
  creado_at               timestamptz not null default now()
);

create table cierres_caja_detalle (
  id              uuid primary key default uuid_generate_v4(),
  cierre_id       uuid not null references cierres_caja(id) on delete cascade,
  metodo          text not null,
  moneda          text not null check (moneda in ('USD', 'BS')),
  monto           numeric(12,2) not null,
  monto_usd       numeric(12,2) not null,
  cantidad_pagos  integer not null,
  unique (cierre_id, metodo, moneda)
);

comment on table cierres_caja_detalle is
  'Desglose del día por método de cobro. Responde la pregunta de todos los días: cuánto entró en efectivo, cuánto en pago móvil, cuánto en Zelle.';

create or replace function cerrar_caja(
  p_fecha                 date,
  p_efectivo_usd_contado  numeric default null,
  p_efectivo_bs_contado   numeric default null,
  p_nota                  text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cierre_id     uuid;
  v_esperado_usd  numeric(12,2);
  v_esperado_bs   numeric(12,2);
  v_total_usd     numeric(12,2);
  v_ventas        integer;
  v_tasa          numeric(14,4);
  v_actor         uuid := auth.uid();
begin
  if exists (select 1 from cierres_caja where fecha = p_fecha and estado = 'cerrado') then
    raise exception 'La caja del % ya está cerrada.', p_fecha;
  end if;

  select bs_por_usd into v_tasa
    from tasas_venta where fecha <= p_fecha order by fecha desc limit 1;

  -- Efectivo esperado: lo que entró en efectivo menos lo que salió de la caja.
  select
    coalesce(sum(case when pg.metodo = 'efectivo_usd' then pg.monto else 0 end), 0),
    coalesce(sum(case when pg.metodo = 'efectivo_bs'  then pg.monto else 0 end), 0),
    coalesce(sum(pg.monto_usd), 0),
    count(distinct pg.venta_id)
    into v_esperado_usd, v_esperado_bs, v_total_usd, v_ventas
    from pagos pg
    join ventas vt on vt.id = pg.venta_id
   where pg.estado = 'verificado'
     and vt.estado <> 'anulada'
     and pg.creado_at::date = p_fecha;

  v_esperado_usd := v_esperado_usd - coalesce((
    select sum(monto_original) from movimientos_financieros
     where tipo = 'egreso' and metodo_pago = 'efectivo_usd'
       and ocurrido_at::date = p_fecha), 0);

  v_esperado_bs := v_esperado_bs - coalesce((
    select sum(monto_original) from movimientos_financieros
     where tipo = 'egreso' and metodo_pago = 'efectivo_bs'
       and ocurrido_at::date = p_fecha), 0);

  insert into cierres_caja (
    fecha, estado, efectivo_usd_contado, efectivo_bs_contado,
    efectivo_usd_esperado, efectivo_bs_esperado,
    diferencia_usd, diferencia_bs,
    total_ventas_usd, cantidad_ventas, tasa_usada, nota, actor_id, cerrado_at
  ) values (
    p_fecha, 'cerrado', p_efectivo_usd_contado, p_efectivo_bs_contado,
    v_esperado_usd, v_esperado_bs,
    coalesce(p_efectivo_usd_contado, v_esperado_usd) - v_esperado_usd,
    coalesce(p_efectivo_bs_contado,  v_esperado_bs)  - v_esperado_bs,
    v_total_usd, v_ventas, v_tasa, p_nota, v_actor, now()
  )
  on conflict (fecha) do update set
    estado = 'cerrado',
    efectivo_usd_contado  = excluded.efectivo_usd_contado,
    efectivo_bs_contado   = excluded.efectivo_bs_contado,
    efectivo_usd_esperado = excluded.efectivo_usd_esperado,
    efectivo_bs_esperado  = excluded.efectivo_bs_esperado,
    diferencia_usd        = excluded.diferencia_usd,
    diferencia_bs         = excluded.diferencia_bs,
    total_ventas_usd      = excluded.total_ventas_usd,
    cantidad_ventas       = excluded.cantidad_ventas,
    tasa_usada            = excluded.tasa_usada,
    nota                  = excluded.nota,
    actor_id              = excluded.actor_id,
    cerrado_at            = now()
  returning id into v_cierre_id;

  delete from cierres_caja_detalle where cierre_id = v_cierre_id;

  insert into cierres_caja_detalle (cierre_id, metodo, moneda, monto, monto_usd, cantidad_pagos)
  select v_cierre_id, pg.metodo, pg.moneda,
         sum(pg.monto), sum(pg.monto_usd), count(*)
    from pagos pg
    join ventas vt on vt.id = pg.venta_id
   where pg.estado = 'verificado'
     and vt.estado <> 'anulada'
     and pg.creado_at::date = p_fecha
   group by pg.metodo, pg.moneda;

  return v_cierre_id;
end;
$$;

comment on function cerrar_caja is
  'Recalculable: se puede volver a correr sobre el mismo día si aparece una venta rezagada.';

revoke all on function cerrar_caja from public;
grant execute on function cerrar_caja to authenticated;

-- Corte del día antes de cerrar, para ver cómo va.
create view v_movimiento_del_dia as
select
  pg.creado_at::date  as fecha,
  pg.metodo,
  pg.moneda,
  sum(pg.monto)       as monto,
  sum(pg.monto_usd)   as monto_usd,
  count(*)            as cantidad_pagos
from pagos pg
join ventas vt on vt.id = pg.venta_id
where pg.estado = 'verificado'
  and vt.estado <> 'anulada'
group by pg.creado_at::date, pg.metodo, pg.moneda;

alter table cierres_caja          enable row level security;
alter table cierres_caja_detalle  enable row level security;
create policy acceso_cierres_caja on cierres_caja
  for all to authenticated using (true) with check (true);
create policy acceso_cierres_caja_detalle on cierres_caja_detalle
  for all to authenticated using (true) with check (true);

commit;


-- ============================================================================
-- 20260727120005_link_shein.sql
-- ============================================================================
-- Mored Store: identidad de producto desde el link de SHEIN
--
-- Formato confirmado con un link real:
--
--   https://us.shein.com/Men-s-Spring-Summer-Thin-Breathable-Hip-Hop-Linen-
--   Casual-Lounge-Sports-Long-Pants-Beach-Straight-Leg-Hawaiian-Solid-Color-
--   Vacationcore-p-108962030.html?src_identifier=...&mallCode=1&...
--
--   ID:     108962030          (del patrón -p-<digitos>.html)
--   Título: el slug antes de -p-
--   Basura: todo lo que va después de "?" son parámetros de tracking
--
-- La extracción vive acá y no en el front para que la regla no se duplique:
-- pegan el link crudo y la base hace el resto.

begin;

-- ============================================================================
-- EXTRACCIÓN
-- ============================================================================

create or replace function fn_shein_id(p_url text)
returns text
language sql
immutable
as $$
  -- Cubre las dos formas: "-p-108962030.html" y "-p-12345-cat-678.html"
  select substring(p_url from '-p-([0-9]+)');
$$;

comment on function fn_shein_id is
  'El ID es global de SHEIN, no cambia entre us.shein.com y es.shein.com. Es la única parte del link en la que se puede confiar como identidad.';

create or replace function fn_shein_url_limpia(p_url text)
returns text
language sql
immutable
as $$
  select split_part(p_url, '?', 1);
$$;

comment on function fn_shein_url_limpia is
  'Descarta la cola de tracking (src_identifier, src_module, detailBusinessFrom, pageListType...). Es ruido de sesión, no identifica nada.';

create or replace function fn_shein_titulo(p_url text)
returns text
language sql
immutable
as $$
  select nullif(
    -- "Men-s-Spring-Summer-..." -> "Men's Spring Summer ..."
    replace(
      replace(
        substring(
          split_part(split_part(p_url, '?', 1), '/', -1)
          from '^(.*)-p-[0-9]+'
        ),
        '-s-', '''s '
      ),
      '-', ' '
    ),
    ''
  );
$$;

comment on function fn_shein_titulo is
  'Título aproximado, en el idioma del dominio del link. Sirve como referencia y para desempatar al hacer match; NO es el nombre que se muestra. Ese lo escriben ellas.';

-- ============================================================================
-- LLENADO AUTOMÁTICO
-- ============================================================================

create or replace function fn_procesar_url_externa()
returns trigger
language plpgsql
as $$
declare
  v_id text;
begin
  if new.url_externa is null or new.url_externa = '' then
    return new;
  end if;

  -- Si no cambió, no reprocesar (permite corregir el título a mano).
  if tg_op = 'UPDATE' and new.url_externa is not distinct from old.url_externa then
    return new;
  end if;

  v_id := fn_shein_id(new.url_externa);

  if v_id is null then
    raise exception 'No se pudo extraer el ID de SHEIN de: %. ¿Es un link de producto?', new.url_externa;
  end if;

  new.id_externo     := v_id;
  new.url_externa    := fn_shein_url_limpia(new.url_externa);
  new.titulo_completo := coalesce(new.titulo_completo, fn_shein_titulo(new.url_externa));

  return new;
end;
$$;

create trigger tg_procesar_url_externa
  before insert or update of url_externa on productos
  for each row execute function fn_procesar_url_externa();

-- ============================================================================
-- MATCH AUTOMÁTICO EN REORDENES
-- ============================================================================

-- Cuando el importador reconoce un link o un ID ya registrado, la línea de
-- compra se casa sola y nadie confirma nada.
create or replace function buscar_producto_por_link(p_url text)
returns table (
  producto_id   uuid,
  nombre        text,
  coleccion     text,
  id_externo    text
)
language sql
stable
as $$
  select p.id, p.nombre, p.coleccion, p.id_externo
    from productos p
   where p.id_externo = fn_shein_id(p_url)
     and fn_shein_id(p_url) is not null;
$$;

grant execute on function buscar_producto_por_link to authenticated;

commit;


-- ============================================================================
-- 20260727120006_recepcion_por_prenda.sql
-- ============================================================================
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


-- ============================================================================
-- 20260727120007_arranque_y_conteo.sql
-- ============================================================================
-- Mored Store: arranque de catálogo y conteo físico
--
-- Resuelve el "¿y si Fina y Treinta no dejan exportar?". La respuesta es que
-- da bastante igual, porque de todas formas hace falta un conteo físico: lo que
-- diga cualquiera de las dos apps después de meses de manejo manual no coincide
-- con lo que hay en el local. Arrancar importando ese número es heredar el
-- error, no migrarlo.
--
-- Este mismo módulo sirve después para los conteos periódicos.

begin;

-- ============================================================================
-- 1. ALTA RÁPIDA DE VARIANTES
-- ============================================================================
-- La usa tanto la pantalla de conteo (recorriendo el local) como el importador
-- de pedidos cuando aparece un producto nuevo.

create sequence seq_sku start with 1;

create or replace function obtener_o_crear_variante(
  p_coleccion        text,
  p_producto_nombre  text,
  p_color            text,
  p_talla            text,
  p_precio_usd       numeric default 0,
  p_id_externo       text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto_id uuid;
  v_color_id    uuid;
  v_variante_id uuid;
  v_talla       text;
  v_sku         text;
begin
  if p_coleccion not in ('active', 'swim') then
    raise exception 'Colección inválida: %', p_coleccion;
  end if;

  v_talla := coalesce(
    (select talla from equivalencias_talla where origen = p_talla),
    upper(trim(p_talla))
  );

  -- Prioridad: ID de SHEIN, después nombre + colección.
  select id into v_producto_id
    from productos
   where (p_id_externo is not null and id_externo = p_id_externo)
      or (p_id_externo is null
          and coleccion = p_coleccion
          and f_normalizar(nombre) = f_normalizar(p_producto_nombre))
   limit 1;

  if v_producto_id is null then
    insert into productos (coleccion, nombre, id_externo)
    values (p_coleccion, trim(p_producto_nombre), p_id_externo)
    returning id into v_producto_id;
  end if;

  select id into v_color_id
    from colores
   where producto_id = v_producto_id
     and f_normalizar(nombre) = f_normalizar(p_color);

  if v_color_id is null then
    insert into colores (producto_id, nombre)
    values (v_producto_id, trim(p_color))
    returning id into v_color_id;
  end if;

  select id into v_variante_id
    from variantes
   where producto_id = v_producto_id
     and color_id = v_color_id
     and talla = v_talla;

  if v_variante_id is null then
    v_sku := case p_coleccion when 'active' then 'MA-' else 'MS-' end
             || lpad(nextval('seq_sku')::text, 6, '0');

    insert into variantes (producto_id, color_id, talla, talla_origen, sku, precio_usd)
    values (v_producto_id, v_color_id, v_talla,
            nullif(p_talla, v_talla), v_sku, coalesce(p_precio_usd, 0))
    returning id into v_variante_id;
  end if;

  return v_variante_id;
end;
$$;

comment on function obtener_o_crear_variante is
  'Idempotente: llamarla dos veces con los mismos datos devuelve la misma variante. Así la pantalla de conteo no duplica productos si se equivocan y vuelven a cargar.';

grant execute on function obtener_o_crear_variante to authenticated;

-- ============================================================================
-- 2. CONTEO FÍSICO
-- ============================================================================

create table conteos_inventario (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text not null,
  tipo        text not null default 'periodico'
                check (tipo in ('inicial', 'periodico')),
  estado      text not null default 'abierto'
                check (estado in ('abierto', 'aplicado', 'anulado')),
  fecha       date not null default current_date,
  nota        text,
  actor_id    uuid references perfiles(id),
  aplicado_at timestamptz,
  creado_at   timestamptz not null default now()
);

comment on column conteos_inventario.tipo is
  'inicial: el arranque del sistema, todo el stock entra desde cero. periodico: la revisión de rutina contra lo que dice el sistema.';

create table conteos_lineas (
  id                  uuid primary key default uuid_generate_v4(),
  conteo_id           uuid not null references conteos_inventario(id) on delete cascade,
  variante_id         uuid not null references variantes(id) on delete restrict,
  cantidad_contada    integer not null check (cantidad_contada >= 0),
  -- Necesario en el conteo inicial: el sistema no tiene de dónde sacar el costo
  -- de mercancía que compraron antes de existir.
  costo_unitario_usd  numeric(12,2) check (costo_unitario_usd >= 0),
  -- Se congelan al aplicar, para que el conteo quede como evidencia.
  cantidad_sistema    integer,
  diferencia          integer,
  creado_at           timestamptz not null default now(),
  unique (conteo_id, variante_id)
);

create index on conteos_lineas (conteo_id);

-- Vista previa antes de aplicar: qué va a cambiar y en cuánto.
create view v_conteo_diferencias as
select
  cl.conteo_id,
  cl.id                     as linea_id,
  cl.variante_id,
  p.nombre                  as producto,
  col.nombre                as color,
  v.talla,
  v.sku,
  v.stock                   as stock_sistema,
  cl.cantidad_contada,
  cl.cantidad_contada - v.stock as diferencia,
  abs(cl.cantidad_contada - v.stock)
    * coalesce(cl.costo_unitario_usd, v.costo_promedio_usd) as impacto_usd
from conteos_lineas cl
join variantes v  on v.id = cl.variante_id
join productos p  on p.id = v.producto_id
join colores col  on col.id = v.color_id
join conteos_inventario ci on ci.id = cl.conteo_id
where ci.estado = 'abierto';

comment on view v_conteo_diferencias is
  'Se revisa antes de aplicar. En un conteo periódico, una diferencia grande casi siempre es un error de conteo, no un robo: conviene recontar antes de ajustar.';

-- Aplica el conteo: genera un ajuste por cada diferencia y congela la evidencia.
create or replace function aplicar_conteo(p_conteo_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conteo    conteos_inventario%rowtype;
  v_fila      record;
  v_ajustes   integer := 0;
  v_costo     numeric(12,2);
  v_actor     uuid := auth.uid();
begin
  select * into v_conteo from conteos_inventario where id = p_conteo_id for update;
  if not found then
    raise exception 'Conteo % no existe.', p_conteo_id;
  end if;
  if v_conteo.estado <> 'abierto' then
    raise exception 'El conteo % ya fue % .', p_conteo_id, v_conteo.estado;
  end if;

  -- Sin costo no se puede valorar mercancía que entra, y sin valor el margen
  -- de esos productos queda inventado.
  if exists (
    select 1
      from conteos_lineas cl
      join variantes v on v.id = cl.variante_id
     where cl.conteo_id = p_conteo_id
       and cl.cantidad_contada > v.stock
       and coalesce(cl.costo_unitario_usd, nullif(v.costo_promedio_usd, 0)) is null
  ) then
    raise exception 'Hay líneas que suman stock sin costo unitario. Complétalas antes de aplicar.';
  end if;

  for v_fila in
    select cl.id, cl.variante_id, cl.cantidad_contada, cl.costo_unitario_usd,
           v.stock, v.costo_promedio_usd
      from conteos_lineas cl
      join variantes v on v.id = cl.variante_id
     where cl.conteo_id = p_conteo_id
     for update of cl
  loop
    update conteos_lineas
       set cantidad_sistema = v_fila.stock,
           diferencia       = v_fila.cantidad_contada - v_fila.stock
     where id = v_fila.id;

    continue when v_fila.cantidad_contada = v_fila.stock;

    v_costo := case
      when v_fila.cantidad_contada > v_fila.stock
        then coalesce(v_fila.costo_unitario_usd, nullif(v_fila.costo_promedio_usd, 0))
      else null   -- las salidas no recalculan el costo promedio
    end;

    insert into movimientos_stock (
      variante_id, tipo, cantidad, costo_unitario_usd,
      referencia_tipo, referencia_id, nota, actor_id
    ) values (
      v_fila.variante_id,
      'ajuste',
      v_fila.cantidad_contada - v_fila.stock,
      v_costo,
      'manual', p_conteo_id,
      v_conteo.nombre,
      v_actor
    );

    v_ajustes := v_ajustes + 1;
  end loop;

  update conteos_inventario
     set estado = 'aplicado', aplicado_at = now()
   where id = p_conteo_id;

  return v_ajustes;
end;
$$;

comment on function aplicar_conteo is
  'Los ajustes quedan como movimientos de stock normales, así que la diferencia siempre se puede rastrear hasta el conteo que la originó.';

revoke all on function aplicar_conteo from public;
grant execute on function aplicar_conteo to authenticated;

alter table conteos_inventario enable row level security;
alter table conteos_lineas     enable row level security;
create policy acceso_conteos_inventario on conteos_inventario
  for all to authenticated using (true) with check (true);
create policy acceso_conteos_lineas on conteos_lineas
  for all to authenticated using (true) with check (true);

commit;



