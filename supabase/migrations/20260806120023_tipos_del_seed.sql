-- Mored Store: asignarle tipo a los productos que entraron sin él
--
-- Los once productos activos salieron de las capturas de SHEIN, antes de que
-- existiera el vocabulario de tipos. Ocho quedaron sin tipo asignado, y eso se
-- ve en la tienda: la sección de categorías desaparece, el filtro por tipo sale
-- vacío, y los accesos de la portada no filtran nada.
--
-- Se asignan por el nombre, que es de donde se puede deducir sin inventar. Solo
-- toca los que NO tienen tipo: lo que ya se cargó bien desde la pantalla de
-- recibir no se pisa.
--
-- REVISA EL RESULTADO. Esto adivina a partir de un título de SHEIN, y un título
-- de SHEIN puede decir cualquier cosa. Al final hay una consulta que muestra
-- cómo quedó cada uno.

begin;

with reglas as (
  select * from (values
    -- El orden importa: gana la primera regla que calce.
    ('%legging%',   'Leggin'),
    ('%licra%',     'Leggin'),
    ('%short%',     'Short'),
    ('%pantalon%',  'Leggin'),
    ('%top%',       'Top'),
    ('%bra%',       'Top'),
    ('%sujetador%', 'Top'),
    ('%enterizo%',  'Enterizo'),
    ('%body%',      'Enterizo'),
    ('%chaqueta%',  'Chaqueta'),
    ('%sueter%',    'Suéter'),
    ('%bañador%',   'Bañador'),
    ('%traje de baño%', 'Traje de baño')
  ) as r(patron, tipo)
),
propuesta as (
  select
    p.id,
    p.nombre,
    (
      select t.id
        from reglas rg
        join tipos_prenda t
          on public.f_normalizar(t.nombre) = public.f_normalizar(rg.tipo)
         and t.coleccion = p.coleccion
       where public.f_normalizar(p.nombre) like public.f_normalizar(rg.patron)
       limit 1
    ) as tipo_id
  from productos p
  where p.tipo_id is null
)
update productos p
   set tipo_id = pr.tipo_id
  from propuesta pr
 where p.id = pr.id
   and pr.tipo_id is not null;

commit;

-- Cómo quedó. Lo que salga con tipo vacío hay que asignarlo a mano desde el
-- panel: el nombre no daba para deducirlo.
select
  p.nombre,
  coalesce(t.nombre, '— sin tipo —') as tipo,
  p.coleccion
from productos p
left join tipos_prenda t on t.id = p.tipo_id
where p.activo
order by t.nombre nulls first, p.nombre;
