-- Mored Store: la prenda se llama leggin
--
-- Un "Set 3 piezas leggings 3/4" con negro, blanco y rosa no es un producto:
-- son tres leggins sueltos que se venden por separado. Cargado bien queda:
--
--   tipo    Leggin
--   estilo  3/4
--   piezas  3
--   colores negro, blanco, rosa
--
--   -> Leggin 3/4 · negro   (1)
--      Leggin 3/4 · blanco  (1)
--      Leggin 3/4 · rosa    (1)
--
-- Yo había puesto "Licra" en la lista de tipos. La palabra que usan ellas es
-- leggin, y de las dos hay que dejar una sola: con las dos, la misma prenda se
-- carga de dos maneras y el buscador deja de servir.

begin;

insert into tipos_prenda (coleccion, nombre, orden)
values ('active', 'Leggin', 45)
on conflict do nothing;

-- "Licra" solo se retira si nadie la usó. Si algún producto ya la tiene, se
-- queda: cambiarla dejaría ese producto con un nombre que nadie reconoce.
update tipos_prenda
   set activo = false
 where public.f_normalizar(nombre) = 'licra'
   and not exists (
     select 1 from productos p where p.tipo_id = tipos_prenda.id
   );

delete from tipos_prenda
 where public.f_normalizar(nombre) = 'licra'
   and not exists (
     select 1 from productos p where p.tipo_id = tipos_prenda.id
   );

-- El largo del leggin es un estilo, como "corto" o "largo", que ya estaban.
insert into estilos (nombre, orden) values ('3/4', 145)
on conflict do nothing;

commit;
