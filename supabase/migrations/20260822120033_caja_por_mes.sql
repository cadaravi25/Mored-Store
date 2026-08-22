-- Mored Store: la caja se cierra por mes, no por día
--
-- Yolima y Sara hacen el cierre mensual, no diario. La pantalla pedía cuadrar
-- el efectivo cada noche, y como nadie lo hacía, la caja acumulaba días
-- abiertos y el arqueo no servía para nada.
--
-- El corte por día no se tira: sigue existiendo para mirar cómo va hoy. Lo que
-- cambia es que el cierre, el que deja constancia de lo contado, ahora abarca
-- un rango. Un mes es un rango; un día también, así que el cálculo es uno solo
-- y las dos pantallas no pueden decir cifras distintas.

begin;

-- ============================================================================
-- 1. UN CIERRE ABARCA UN RANGO
-- ============================================================================
-- `fecha` pasa a ser el primer día del período y `hasta` el último. Los
-- cierres diarios que ya existan son rangos de un día, así que se rellenan
-- solos y nada de lo cerrado se pierde.

alter table cierres_caja
  add column if not exists hasta date;

update cierres_caja set hasta = fecha where hasta is null;

alter table cierres_caja
  alter column hasta set not null;

-- El único sobre `fecha` sola impediría cerrar agosto entero si alguien cerró
-- el 1 de agosto suelto. Son dos cosas distintas y las dos tienen que caber.
alter table cierres_caja drop constraint if exists cierres_caja_fecha_key;

create unique index if not exists idx_cierres_caja_periodo
  on cierres_caja (fecha, hasta);

alter table cierres_caja
  add constraint cierres_caja_rango_valido check (hasta >= fecha);

comment on column cierres_caja.fecha is
  'Primer día del período cerrado. En los cierres diarios de antes, el día.';
comment on column cierres_caja.hasta is
  'Último día del período, inclusive. Igual a fecha cuando el cierre es de un día.';

-- ============================================================================
-- 2. EL CORTE, SOBRE UN RANGO
-- ============================================================================
-- Es el de antes con dos fechas en vez de una, más el desglose por día para
-- poder mirar el mes por dentro sin tener que cerrar nada.

create or replace function resumen_caja_rango(p_desde date, p_hasta date)
returns jsonb
language sql
stable
as $$
  with limites as (
    select f_inicio_del_dia(p_desde) as desde, f_fin_del_dia(p_hasta) as hasta
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
  ventas_periodo as (
    select count(distinct pg.venta_id) as cantidad,
           coalesce(sum(pg.monto_usd), 0) as total_usd
      from pagos pg
      join ventas vt on vt.id = pg.venta_id
     cross join limites l
     where pg.estado = 'verificado'
       and vt.estado <> 'anulada'
       and pg.creado_at >= l.desde and pg.creado_at < l.hasta
  ),
  -- Cómo se repartió el mes por días. No decide nada del cierre: está para
  -- que al cuadrar se pueda ver qué día se salió de lo normal.
  por_dia as (
    select (pg.creado_at at time zone 'America/Caracas')::date as dia,
           count(distinct pg.venta_id)    as ventas,
           coalesce(sum(pg.monto_usd), 0) as total_usd
      from pagos pg
      join ventas vt on vt.id = pg.venta_id
     cross join limites l
     where pg.estado = 'verificado'
       and vt.estado <> 'anulada'
       and pg.creado_at >= l.desde and pg.creado_at < l.hasta
     group by 1
  ),
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
    'fecha', p_desde,
    'desde', p_desde,
    'hasta', p_hasta,
    'cantidad_ventas', (select cantidad from ventas_periodo),
    'total_ventas_usd', (select total_usd from ventas_periodo),
    'efectivo_usd_esperado',
      coalesce((select sum(monto) from cobrado where metodo = 'efectivo_usd'), 0)
      + (select neto_usd from caja_manual),
    'efectivo_bs_esperado',
      coalesce((select sum(monto) from cobrado where metodo = 'efectivo_bs'), 0)
      + (select neto_bs from caja_manual),
    'movimientos_usd', (select neto_usd from caja_manual),
    'movimientos_bs',  (select neto_bs  from caja_manual),
    'tasa', (select bs_por_usd from tasas_venta
              where fecha <= p_hasta order by fecha desc limit 1),
    'por_verificar', (select jsonb_build_object(
                        'cantidad', cantidad, 'monto_usd', monto_usd)
                        from por_verificar),
    'detalle', coalesce((
      select jsonb_agg(jsonb_build_object(
               'metodo', metodo, 'moneda', moneda,
               'monto', monto, 'monto_usd', monto_usd, 'cantidad', cantidad)
             order by monto_usd desc)
        from cobrado), '[]'::jsonb),
    'dias', coalesce((
      select jsonb_agg(jsonb_build_object(
               'dia', dia, 'ventas', ventas, 'total_usd', total_usd)
             order by dia)
        from por_dia), '[]'::jsonb),
    'cierre', (select to_jsonb(cc) from cierres_caja cc
                where cc.fecha = p_desde and cc.hasta = p_hasta)
  );
$$;

comment on function resumen_caja_rango is
  'Corte de un período para la pantalla de caja. Calcula lo mismo que cerrar_caja_rango, para que lo que se ve antes de cerrar sea lo que queda guardado.';

revoke all on function resumen_caja_rango from public;
grant execute on function resumen_caja_rango to authenticated;

-- El corte de un día es el de un rango de un día. Se deja como envoltorio para
-- no tener dos cálculos que puedan separarse con el tiempo.
create or replace function resumen_caja(p_fecha date)
returns jsonb
language sql
stable
as $$
  select resumen_caja_rango(p_fecha, p_fecha);
$$;

revoke all on function resumen_caja from public;
grant execute on function resumen_caja to authenticated;

-- ============================================================================
-- 3. EL CIERRE, SOBRE UN RANGO
-- ============================================================================

create or replace function cerrar_caja_rango(
  p_desde                 date,
  p_hasta                 date,
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
  v_cierre_id    uuid;
  v_resumen      jsonb;
  v_desde        timestamptz := f_inicio_del_dia(p_desde);
  v_hasta        timestamptz := f_fin_del_dia(p_hasta);
  v_esperado_usd numeric(12,2);
  v_esperado_bs  numeric(12,2);
begin
  if p_hasta < p_desde then
    raise exception 'El período termina antes de empezar.';
  end if;

  -- Un período ya cerrado no se pisa por accidente. Rehacerlo porque apareció
  -- una venta rezagada es válido, pero tiene que ser una decisión.
  if not p_recalcular
     and exists (select 1 from cierres_caja
                  where fecha = p_desde and hasta = p_hasta and estado = 'cerrado') then
    raise exception 'Esa caja ya está cerrada.'
      using hint = 'Para rehacerla, vuelve a cerrar indicando que quieres recalcular.';
  end if;

  if p_desde > (now() at time zone 'America/Caracas')::date then
    raise exception 'No se puede cerrar una caja que todavía no empieza.';
  end if;

  v_resumen := resumen_caja_rango(p_desde, p_hasta);
  v_esperado_usd := (v_resumen->>'efectivo_usd_esperado')::numeric;
  v_esperado_bs  := (v_resumen->>'efectivo_bs_esperado')::numeric;

  insert into cierres_caja (
    fecha, hasta, estado, efectivo_usd_contado, efectivo_bs_contado,
    efectivo_usd_esperado, efectivo_bs_esperado,
    diferencia_usd, diferencia_bs,
    total_ventas_usd, cantidad_ventas, tasa_usada, nota, actor_id, cerrado_at
  ) values (
    p_desde, p_hasta, 'cerrado', p_efectivo_usd_contado, p_efectivo_bs_contado,
    v_esperado_usd, v_esperado_bs,
    coalesce(p_efectivo_usd_contado, v_esperado_usd) - v_esperado_usd,
    coalesce(p_efectivo_bs_contado,  v_esperado_bs)  - v_esperado_bs,
    (v_resumen->>'total_ventas_usd')::numeric,
    (v_resumen->>'cantidad_ventas')::integer,
    (v_resumen->>'tasa')::numeric,
    p_nota, auth.uid(), now()
  )
  on conflict (fecha, hasta) do update set
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

comment on function cerrar_caja_rango is
  'Cierra la caja de un período de días de Caracas. Recalculable, para cuando aparece una venta rezagada.';

revoke all on function cerrar_caja_rango from public;
grant execute on function cerrar_caja_rango to authenticated;

-- El cierre de un día pasa por el mismo sitio.
drop function if exists cerrar_caja(date, numeric, numeric, text, boolean);

create function cerrar_caja(
  p_fecha                 date,
  p_efectivo_usd_contado  numeric default null,
  p_efectivo_bs_contado   numeric default null,
  p_nota                  text    default null,
  p_recalcular            boolean default false
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select cerrar_caja_rango(
    p_fecha, p_fecha, p_efectivo_usd_contado, p_efectivo_bs_contado,
    p_nota, p_recalcular
  );
$$;

revoke all on function cerrar_caja from public;
grant execute on function cerrar_caja to authenticated;

-- ============================================================================
-- 4. LOS MESES QUE TIENEN ALGO QUE CERRAR
-- ============================================================================
-- Para que el selector no ofrezca meses vacíos ni obligue a nadie a acordarse
-- de desde cuándo hay ventas.

create or replace function meses_de_caja()
returns table (mes date, ventas bigint, total_usd numeric, cerrado boolean)
language sql
stable
as $$
  with movidos as (
    select date_trunc('month', (pg.creado_at at time zone 'America/Caracas'))::date as mes,
           count(distinct pg.venta_id) as ventas,
           coalesce(sum(pg.monto_usd), 0) as total_usd
      from pagos pg
      join ventas vt on vt.id = pg.venta_id
     where pg.estado = 'verificado'
       and vt.estado <> 'anulada'
     group by 1
  ),
  -- El mes en curso sale siempre, aunque todavía no haya vendido nada: es el
  -- que van a mirar al entrar.
  todos as (
    select mes, ventas, total_usd from movidos
    union
    select date_trunc('month', (now() at time zone 'America/Caracas'))::date, 0, 0
    where not exists (
      select 1 from movidos
       where mes = date_trunc('month', (now() at time zone 'America/Caracas'))::date
    )
  )
  select t.mes, t.ventas, t.total_usd,
         exists (
           select 1 from cierres_caja cc
            where cc.fecha = t.mes
              and cc.hasta = (t.mes + interval '1 month - 1 day')::date
              and cc.estado = 'cerrado'
         ) as cerrado
    from todos t
   order by t.mes desc;
$$;

revoke all on function meses_de_caja from public;
grant execute on function meses_de_caja to authenticated;

commit;
