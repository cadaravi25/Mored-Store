-- Mored Store: verificación del modelo con los datos de prueba
--
-- Una sola consulta a propósito: el editor SQL de Supabase muestra únicamente
-- el resultado de la última sentencia.
--
-- Se corre después de seed_pruebas.sql.

with totales as (
  select p.numero_externo,
         p.total_declarado_usd                              as total_shein,
         sum(l.cantidad_pedida * l.precio_unitario_usd)     as suma_lineas,
         count(*)                                           as lineas,
         sum(l.cantidad_pedida * fn_piezas_por_pack(l.id))  as prendas
    from pedidos_compra p
    join pedidos_compra_lineas l on l.pedido_id = p.id
   group by p.id, p.numero_externo, p.total_declarado_usd
),
costo_top as (
  select v.costo_promedio_usd as c
    from variantes v
    join productos pr on pr.id = v.producto_id
    join colores  col on col.id = v.color_id
   where pr.nombre = 'Top deportivo tanque'
     and col.nombre = 'Blanco'
     and v.talla = 'S'
),
costo_set as (
  select v.costo_promedio_usd as c
    from variantes v
    join productos pr on pr.id = v.producto_id
    join colores  col on col.id = v.color_id
   where pr.nombre = 'Set 3 piezas leggings 3/4'
     and col.nombre = 'Negro'
     and v.talla = 'S'
),
pendientes as (
  select coalesce(sum(piezas_faltantes), 0)   as prendas,
         coalesce(sum(monto_faltante_usd), 0) as monto
    from v_prendas_pendientes
),
courier as (
  select coalesce(sum(monto_usd), 0) as monto
    from movimientos_financieros
   where categoria = 'importacion'
),
stock as (
  select coalesce(sum(stock), 0) as total from variantes
),
resultados as (

  select 1 as n,
         'Suma de lineas = total SHEIN (' || numero_externo || ')' as prueba,
         suma_lineas::text || '  vs  ' || total_shein::text        as valor,
         case when suma_lineas = total_shein then 'OK' else 'REVISAR' end as resultado
    from totales

  union all
  select 2,
         'Lineas de compra -> prendas vendibles (' || numero_externo || ')',
         lineas::text || ' lineas  ->  ' || prendas::text || ' prendas',
         'info'
    from totales

  union all
  select 3,
         'Costo landed del top blanco S',
         coalesce((select c from costo_top), 0)::text,
         case when (select c from costo_top) = 10.69
              then 'OK' else 'REVISAR, se esperaba 10.69' end

  union all
  select 4,
         'Costo landed de una prenda del set S',
         coalesce((select c from costo_set), 0)::text,
         case when (select c from costo_set) = 7.12
              then 'OK' else 'REVISAR, se esperaba 7.12' end

  union all
  select 5,
         'Prendas en stock tras la tanda',
         (select total from stock)::text,
         case when (select total from stock) = 14
              then 'OK' else 'REVISAR, se esperaban 14' end

  union all
  select 6,
         'Pendientes por llegar',
         (select prendas from pendientes)::text || ' prendas por '
           || round((select monto from pendientes), 2)::text || ' USD',
         'info'

  union all
  select 7,
         'Courier registrado como egreso',
         (select monto from courier)::text,
         case when (select monto from courier) = 35.00
              then 'OK' else 'REVISAR, se esperaban 35.00' end
)
select n, prueba, valor, resultado
  from resultados
 order by n, prueba;
