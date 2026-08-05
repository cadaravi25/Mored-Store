-- Mored Store: permisos del depósito de fotos
--
-- Crear el bucket como "público" solo abre la LECTURA. Escribir sigue pasando
-- por RLS sobre storage.objects, y ahí no había ni una política: por eso subir
-- una foto respondía "new row violates row-level security policy".
--
-- Es el mismo error que ya cometimos con las tablas en la migración 008: los
-- permisos y las políticas son dos capas distintas, y hacen falta las dos.

begin;

-- Cualquiera puede VER las fotos: son las del catálogo público, y sin eso la
-- tienda no muestra nada.
drop policy if exists fotos_lectura on storage.objects;
create policy fotos_lectura on storage.objects
  for select
  using (bucket_id = 'fotos');

-- Solo quien tiene sesión puede subirlas, cambiarlas o borrarlas.
drop policy if exists fotos_subida on storage.objects;
create policy fotos_subida on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos');

drop policy if exists fotos_cambio on storage.objects;
create policy fotos_cambio on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos')
  with check (bucket_id = 'fotos');

drop policy if exists fotos_borrado on storage.objects;
create policy fotos_borrado on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos');

commit;
