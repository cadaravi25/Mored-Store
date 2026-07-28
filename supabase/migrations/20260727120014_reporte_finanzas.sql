-- Mored Store: reporte de finanzas
--
-- Dos números que suelen confundirse y aquí se separan:
--
--   UTILIDAD BRUTA = lo vendido menos lo que costó esa mercancía. Sale de
--   ventas_lineas, que congela el costo al momento de vender. Sin ese congelado
--   el margen histórico se movería cada vez que entra mercancía a otro precio.
--
--   UTILIDAD NETA = la bruta menos los gastos del período (courier, alquiler,
--   lo que sea). Es lo que de verdad les queda.
--
-- Los cambios de divisa NO cuentan como ingreso ni como gasto: mueven saldo
-- entre cuentas. Es el error contable clásico de este tipo de negocio.

begin;

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
    select p_desde as desde, p_hasta as hasta
  ),
  lineas as (
    select vl.cantidad,
           vl.cantidad * vl.precio_unitario_usd as venta,
           vl.cantidad * vl.costo_unitario_usd  as costo
      from ventas_lineas vl
      join ventas v on v.id = vl.venta_id
     where v.estado <> 'anulada'
       and v.creado_at::date between (select desde from rango)
                                 and (select hasta from rango)
  ),
  ventas_periodo as (
    select count(*) as n
      from ventas v
     where v.estado <> 'anulada'
       and v.creado_at::date between (select desde from rango)
                                 and (select hasta from rango)
  ),
  gastos as (
    select coalesce(sum(monto_usd), 0) as total
      from movimientos_financieros
     where tipo = 'egreso'
       and ocurrido_at::date between (select desde from rango)
                                 and (select hasta from rango)
  ),
  cobros as (
    select
      coalesce(sum(pg.monto_usd) filter (where pg.moneda = 'USD'), 0) as divisa,
      coalesce(sum(pg.monto_usd) filter (where pg.moneda = 'BS'), 0)  as bolivares
      from pagos pg
      join ventas v on v.id = pg.venta_id
     where pg.estado = 'verificado'
       and v.estado <> 'anulada'
       and pg.creado_at::date between (select desde from rango)
                                  and (select hasta from rango)
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

-- Ventas por día, para la gráfica del panel y el reporte.
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
           on v.creado_at::date = d::date and v.estado <> 'anulada'
    left join ventas_lineas vl on vl.venta_id = v.id
   group by d
   order by d;
$$;

grant execute on function ventas_por_dia to authenticated;

commit;
