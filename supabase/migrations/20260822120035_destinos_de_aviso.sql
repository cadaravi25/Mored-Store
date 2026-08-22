-- Mored Store: lo justo para poder mandar el aviso, sin la llave maestra
--
-- La tienda desplegada necesita dos cosas para avisar de un pedido: a qué
-- teléfonos y qué decirles. Lo fácil sería darle la clave de servicio, pero esa
-- se salta todas las reglas de la base y quedaría guardada en el alojamiento.
--
-- En vez de eso, dos funciones que solo devuelven eso y que piden el mismo
-- secreto compartido con el que la base llama a la tienda. Quien tenga el
-- secreto puede mandar avisos, que es exactamente el permiso que hace falta, y
-- ninguno más.

begin;

create or replace function destinos_de_aviso(p_secreto text)
returns table (
  endpoint   text,
  p256dh     text,
  auth       text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esperado text;
begin
  select valor into v_esperado from ajustes_avisos where clave = 'secreto';
  if v_esperado is null or p_secreto is distinct from v_esperado then
    raise exception 'No' using errcode = '42501';
  end if;

  -- Solo las direcciones. El resumen del pedido llega en la llamada, porque el
  -- aviso se dispara dentro de la transacción que aún no ha cerrado y la venta
  -- todavía no se ve desde fuera.
  return query
  select s.endpoint, s.p256dh, s.auth from suscripciones_push s;
end;
$$;

comment on function destinos_de_aviso is
  'Los teléfonos apuntados. Pide el secreto compartido: es el permiso de mandar avisos y nada más.';

revoke all on function destinos_de_aviso from public;
grant execute on function destinos_de_aviso to anon, authenticated;

-- Un teléfono al que el navegador ya no sabe llegar. Sin limpiarlos, la lista
-- se llena de direcciones muertas y cada aviso tarda más en salir.
create or replace function olvidar_suscripciones(p_secreto text, p_endpoints text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esperado text;
  v_borradas integer;
begin
  select valor into v_esperado from ajustes_avisos where clave = 'secreto';
  if v_esperado is null or p_secreto is distinct from v_esperado then
    raise exception 'No' using errcode = '42501';
  end if;

  delete from suscripciones_push where endpoint = any(p_endpoints);
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

revoke all on function olvidar_suscripciones from public;
grant execute on function olvidar_suscripciones to anon, authenticated;

commit;
