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
