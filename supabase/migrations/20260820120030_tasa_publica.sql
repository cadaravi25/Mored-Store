-- La tienda necesita leer la tasa del día. Hoy no puede.
--
-- EL SÍNTOMA
--
-- El interruptor de EUR/Bs no aparecía en el catálogo publicado. No es un
-- problema de la pantalla: el componente devuelve nada cuando no tiene tasa, y
-- no la tenía. La base respondía a la tienda:
--
--   42501 · permission denied for table tasas_bcv
--
-- POR QUÉ NO SE VIO ANTES
--
-- En local la prueba se hizo con la sesión del panel abierta, así que esa
-- consulta corría como usuaria autenticada, que sí tiene permiso desde el
-- esquema inicial. Una clienta cualquiera entra sin sesión, como `anon`, y a
-- ese rol nunca se le concedió nada sobre esta tabla.
--
-- Es el mismo trato que ya tienen productos, colores y variantes: leer y nada
-- más. La tasa del BCV es un dato público que publica el banco central, así
-- que no hay nada que proteger; lo que había era un olvido.

begin;

grant select on tasas_bcv to anon;

drop policy if exists catalogo_publico_tasas on tasas_bcv;
create policy catalogo_publico_tasas on tasas_bcv
  for select to anon using (true);

commit;
