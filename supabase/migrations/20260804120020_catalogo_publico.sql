-- Mored Store: la ventana pública
--
-- Hasta ahora la base estaba cerrada por completo: el rol anónimo no tenía
-- ningún permiso y todo pasaba por sesión iniciada. La tienda obliga a abrir
-- una ventana, y una ventana mal hecha es por donde se ve el costo de cada
-- prenda y el margen del negocio.
--
-- Por eso se abre UNA vista y nada más. No se le dan permisos a ninguna tabla:
-- si mañana alguien agrega una columna con el costo a `variantes`, no aparece
-- acá por accidente, porque las columnas de esta vista están escritas una por
-- una.
--
-- La vista corre con los permisos de quien la creó, NO con los de quien la
-- consulta. Es lo contrario de lo que hicimos con todas las demás vistas en la
-- migración 008, y acá es a propósito: el visitante no tiene sesión, así que no
-- hay política de RLS que pueda dejarlo pasar. Lo que lo protege es que la
-- vista solo expone lo vendible.

begin;

create or replace view v_catalogo as
select
  p.id              as producto_id,
  p.nombre          as producto,
  p.coleccion,
  t.nombre          as tipo,
  p.detalle         as estilo,
  c.id              as color_id,
  c.nombre          as color,
  cc.hex,
  c.foto_url,
  v.id              as variante_id,
  v.talla,
  v.precio_usd,
  d.disponible
from variantes v
join productos p            on p.id = v.producto_id
join colores   c            on c.id = v.color_id
join v_stock_disponible d   on d.variante_id = v.id
left join tipos_prenda t    on t.id = p.tipo_id
left join colores_catalogo cc
       on public.f_normalizar(cc.nombre) = public.f_normalizar(c.nombre)
where p.activo
  and v.activa
  and v.precio_usd > 0
  -- Sin foto no sale a la calle. Un recuadro gris en una tienda no vende: da
  -- la impresión de que está rota.
  and c.foto_url is not null;

comment on view v_catalogo is
  'Lo único que ve el público. Nunca debe incluir costo, margen, proveedor ni nada de clientes.';

alter view v_catalogo set (security_invoker = false);

grant select on v_catalogo to anon, authenticated;

commit;
