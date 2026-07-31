-- Mored Store: el cierre de caja cuenta el día de Caracas, no el de Londres
--
-- `creado_at::date` devuelve la fecha en UTC. Venezuela está en UTC-4, así que
-- toda venta hecha después de las 8:00 pm de Caracas ya cayó en el día
-- siguiente para Postgres. El local de Chacaíto cierra a las 8:00 pm: las
-- ventas de la última hora se le habrían sumado al día siguiente y el cierre
-- habría dado faltante todas las noches, sin que nadie entendiera por qué.
--
-- Aquí se corrige eso, se agrega el corte previo que la pantalla necesita para
-- mostrar cómo va el día antes de cerrar, y se hace verdad el comentario que
-- decía que el cierre es recalculable (el código lo impedía).

begin;

-- ============================================================================
-- 1. LÍMITES DEL DÍA LOCAL
-- ============================================================================
-- Se compara por rango y no por `f(creado_at) = fecha` a propósito: envolver
-- la columna en una función deja inservible el índice sobre creado_at.

create or replace function f_inicio_del_dia(p_fecha date)
returns timestamptz
language sql
stable
as $$
  select p_fecha::timestamp at time zone 'America/Caracas';
$$;

create or replace function f_fin_del_dia(p_fecha date)
returns timestamptz
language sql
stable
as $$
  select (p_fecha + 1)::timestamp at time zone 'America/Caracas';
$$;

comment on function f_inicio_del_dia is
  'Medianoche de Caracas en hora absoluta. Un día del negocio va de f_inicio_del_dia(d) inclusive a f_fin_del_dia(d) exclusive.';

grant execute on function f_inicio_del_dia to authenticated;
grant execute on function f_fin_del_dia   to authenticated;

-- ============================================================================
-- 2. CORTE DEL DÍA
-- ============================================================================
-- Lo que la pantalla muestra antes de cerrar. Devuelve exactamente los mismos
-- números que va a guardar el cierre: si el cálculo viviera en la aplicación,
-- tarde o temprano diría una cosa la pantalla y otra el registro.

create or replace function resumen_caja(p_fecha date)
returns jsonb
language sql
stable
as $$
  with limites as (
    select f_inicio_del_dia(p_fecha) as desde, f_fin_del_dia(p_fecha) as hasta
  ),
  cobrado as (
    select pg.metodo, pg.moneda,
           sum(pg.monto)     as monto,
           sum(pg.monto_usd) as monto_usd,
           count(*)          as cantidad
      from pagos pg
      join ventas vt on vt.id = pg.venta_id
     cross join limites l
     where pg.estado = 'verificado'
       and vt.estado <> 'anulada'
       and pg.creado_at >= l.desde and pg.creado_at < l.hasta
     group by pg.metodo, pg.moneda
  ),
  ventas_dia as (
    select count(distinct pg.venta_id) as cantidad,
           coalesce(sum(pg.monto_usd), 0) as total_usd
      from pagos pg
      join ventas vt on vt.id = pg.venta_id
     cross join limites l
     where pg.estado = 'verificado'
       and vt.estado <> 'anulada'
       and pg.creado_at >= l.desde and pg.creado_at < l.hasta
  ),
  -- Movimientos de caja hechos a mano: sacar plata para un mandado, meter un
  -- vuelto. Los de origen 'venta' ya están contados arriba, en los pagos.
  caja_manual as (
    select
      coalesce(sum(case when mf.tipo = 'ingreso' and mf.metodo_pago = 'efectivo_usd'
                        then mf.monto_original else 0 end), 0)
      - coalesce(sum(case when mf.tipo = 'egreso' and mf.metodo_pago = 'efectivo_usd'
                        then mf.monto_original else 0 end), 0) as neto_usd,
      coalesce(sum(case when mf.tipo = 'ingreso' and mf.metodo_pago = 'efectivo_bs'
                        then mf.monto_original else 0 end), 0)
      - coalesce(sum(case when mf.tipo = 'egreso' and mf.metodo_pago = 'efectivo_bs'
                        then mf.monto_original else 0 end), 0) as neto_bs
      from movimientos_financieros mf
     cross join limites l
     where mf.origen = 'manual'
       and mf.ocurrido_at >= l.desde and mf.ocurrido_at < l.hasta
  ),
  -- Un pago reportado y todavía sin verificar no entra en el arqueo. Si no se
  -- avisa, la diferencia aparece sin explicación.
  por_verificar as (
    select count(*) as cantidad, coalesce(sum(pg.monto_usd), 0) as monto_usd
      from pagos pg
      join ventas vt on vt.id = pg.venta_id
     cross join limites l
     where pg.estado = 'reportado'
       and vt.estado <> 'anulada'
       and pg.creado_at >= l.desde and pg.creado_at < l.hasta
  )
  select jsonb_build_object(
    'fecha', p_fecha,
    'cantidad_ventas', (select cantidad from ventas_dia),
    'total_ventas_usd', (select total_usd from ventas_dia),
    'efectivo_usd_esperado',
      coalesce((select sum(monto) from cobrado where metodo = 'efectivo_usd'), 0)
      + (select neto_usd from caja_manual),
    'efectivo_bs_esperado',
      coalesce((select sum(monto) from cobrado where metodo = 'efectivo_bs'), 0)
      + (select neto_bs from caja_manual),
    'movimientos_usd', (select neto_usd from caja_manual),
    'movimientos_bs',  (select neto_bs  from caja_manual),
    'tasa', (select bs_por_usd from tasas_venta
              where fecha <= p_fecha order by fecha desc limit 1),
    'por_verificar', (select jsonb_build_object(
                        'cantidad', cantidad, 'monto_usd', monto_usd)
                        from por_verificar),
    'detalle', coalesce((
      select jsonb_agg(jsonb_build_object(
               'metodo', metodo, 'moneda', moneda,
               'monto', monto, 'monto_usd', monto_usd, 'cantidad', cantidad)
             order by monto_usd desc)
        from cobrado), '[]'::jsonb),
    'cierre', (select to_jsonb(cc) from cierres_caja cc where cc.fecha = p_fecha)
  );
$$;

comment on function resumen_caja is
  'Corte del día para la pantalla de caja. Calcula lo mismo que cerrar_caja, para que lo que se ve antes de cerrar sea lo que queda guardado.';

revoke all on function resumen_caja from public;
grant execute on function resumen_caja to authenticated;

-- ============================================================================
-- 3. EL CIERRE, SOBRE EL DÍA LOCAL
-- ============================================================================
-- Cambia la firma (entra p_recalcular), y `create or replace` no puede alterar
-- los parámetros de una función existente.

drop function if exists cerrar_caja(date, numeric, numeric, text);

create function cerrar_caja(
  p_fecha                 date,
  p_efectivo_usd_contado  numeric default null,
  p_efectivo_bs_contado   numeric default null,
  p_nota                  text    default null,
  p_recalcular            boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cierre_id  uuid;
  v_resumen    jsonb;
  v_desde      timestamptz := f_inicio_del_dia(p_fecha);
  v_hasta      timestamptz := f_fin_del_dia(p_fecha);
  v_esperado_usd numeric(12,2);
  v_esperado_bs  numeric(12,2);
begin
  -- Un día ya cerrado no se pisa por accidente. Rehacerlo porque apareció una
  -- venta rezagada es válido, pero tiene que ser una decisión, no un descuido.
  if not p_recalcular
     and exists (select 1 from cierres_caja where fecha = p_fecha and estado = 'cerrado') then
    raise exception 'La caja del % ya está cerrada.', p_fecha
      using hint = 'Para rehacerla, vuelve a cerrar indicando que quieres recalcular.';
  end if;

  if p_fecha > (now() at time zone 'America/Caracas')::date then
    raise exception 'No se puede cerrar la caja de un día que todavía no llega.';
  end if;

  v_resumen := resumen_caja(p_fecha);
  v_esperado_usd := (v_resumen->>'efectivo_usd_esperado')::numeric;
  v_esperado_bs  := (v_resumen->>'efectivo_bs_esperado')::numeric;

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
    (v_resumen->>'total_ventas_usd')::numeric,
    (v_resumen->>'cantidad_ventas')::integer,
    (v_resumen->>'tasa')::numeric,
    p_nota, auth.uid(), now()
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
     and pg.creado_at >= v_desde and pg.creado_at < v_hasta
   group by pg.metodo, pg.moneda;

  return v_cierre_id;
end;
$$;

comment on function cerrar_caja is
  'Cierra el día de Caracas. Recalculable con p_recalcular, para cuando aparece una venta rezagada.';

revoke all on function cerrar_caja from public;
grant execute on function cerrar_caja to authenticated;

-- ============================================================================
-- 4. LA VISTA DEL DÍA, TAMBIÉN EN HORA DE CARACAS
-- ============================================================================

drop view if exists v_movimiento_del_dia;

create view v_movimiento_del_dia as
select
  (pg.creado_at at time zone 'America/Caracas')::date as fecha,
  pg.metodo,
  pg.moneda,
  sum(pg.monto)     as monto,
  sum(pg.monto_usd) as monto_usd,
  count(*)          as cantidad_pagos
from pagos pg
join ventas vt on vt.id = pg.venta_id
where pg.estado = 'verificado'
  and vt.estado <> 'anulada'
group by 1, 2, 3;

alter view v_movimiento_del_dia set (security_invoker = true);
grant select on v_movimiento_del_dia to authenticated;

-- ============================================================================
-- 5. EL REPORTE DE FINANZAS, SOBRE LOS MISMOS DÍAS
-- ============================================================================
-- Arrastraba el mismo `::date` en UTC. Corregir solo la caja habría dejado dos
-- pantallas dando cifras distintas del mismo día, que es peor que tener las dos
-- mal: nadie sabría a cuál creerle.

create or replace function reporte_finanzas(
  p_desde date default (current_date - 29),
  p_hasta date default current_date
)
returns table (
  ventas_usd          numeric,
  unidades            integer,
  ventas_cantidad     integer,
  ticket_promedio_usd numeric,
  costo_vendido_usd   numeric,
  utilidad_bruta_usd  numeric,
  margen_pct          numeric,
  egresos_usd         numeric,
  utilidad_neta_usd   numeric,
  cobrado_divisa_usd  numeric,
  cobrado_bs_usd      numeric
)
language sql
stable
as $$
  with rango as (
    select f_inicio_del_dia(p_desde) as desde, f_fin_del_dia(p_hasta) as hasta
  ),
  lineas as (
    select vl.cantidad,
           vl.cantidad * vl.precio_unitario_usd as venta,
           vl.cantidad * vl.costo_unitario_usd  as costo
      from ventas_lineas vl
      join ventas v on v.id = vl.venta_id
     cross join rango r
     where v.estado <> 'anulada'
       and v.creado_at >= r.desde and v.creado_at < r.hasta
  ),
  ventas_periodo as (
    select count(*) as n
      from ventas v
     cross join rango r
     where v.estado <> 'anulada'
       and v.creado_at >= r.desde and v.creado_at < r.hasta
  ),
  gastos as (
    select coalesce(sum(monto_usd), 0) as total
      from movimientos_financieros mf
     cross join rango r
     where mf.tipo = 'egreso'
       and mf.ocurrido_at >= r.desde and mf.ocurrido_at < r.hasta
  ),
  cobros as (
    select
      coalesce(sum(pg.monto_usd) filter (where pg.moneda = 'USD'), 0) as divisa,
      coalesce(sum(pg.monto_usd) filter (where pg.moneda = 'BS'), 0)  as bolivares
      from pagos pg
      join ventas v on v.id = pg.venta_id
     cross join rango r
     where pg.estado = 'verificado'
       and v.estado <> 'anulada'
       and pg.creado_at >= r.desde and pg.creado_at < r.hasta
  )
  select
    round(coalesce(sum(l.venta), 0), 2),
    coalesce(sum(l.cantidad), 0)::integer,
    (select n from ventas_periodo)::integer,
    case when (select n from ventas_periodo) > 0
         then round(coalesce(sum(l.venta), 0) / (select n from ventas_periodo), 2)
         else 0 end,
    round(coalesce(sum(l.costo), 0), 2),
    round(coalesce(sum(l.venta), 0) - coalesce(sum(l.costo), 0), 2),
    case when coalesce(sum(l.venta), 0) > 0
         then round(((sum(l.venta) - sum(l.costo)) / sum(l.venta)) * 100, 1)
         else 0 end,
    round((select total from gastos), 2),
    round(coalesce(sum(l.venta), 0) - coalesce(sum(l.costo), 0)
          - (select total from gastos), 2),
    round((select divisa from cobros), 2),
    round((select bolivares from cobros), 2)
  from lineas l;
$$;

grant execute on function reporte_finanzas to authenticated;

create or replace function ventas_por_dia(
  p_desde date default (current_date - 29),
  p_hasta date default current_date
)
returns table (dia date, ventas integer, unidades integer, monto_usd numeric)
language sql
stable
as $$
  select d::date,
         count(distinct v.id)::integer,
         coalesce(sum(vl.cantidad), 0)::integer,
         round(coalesce(sum(vl.cantidad * vl.precio_unitario_usd), 0), 2)
    from generate_series(p_desde, p_hasta, interval '1 day') d
    left join ventas v
           on v.creado_at >= f_inicio_del_dia(d::date)
          and v.creado_at <  f_fin_del_dia(d::date)
          and v.estado <> 'anulada'
    left join ventas_lineas vl on vl.venta_id = v.id
   group by d
   order by d;
$$;

grant execute on function ventas_por_dia to authenticated;

commit;
