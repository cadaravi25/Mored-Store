-- Mored Store: que el teléfono avise cuando entra una orden por la web
--
-- Hasta ahora la única forma de enterarse de un pedido era abrir el panel a
-- ver. Una clienta que pide a las once de la noche se queda sin respuesta
-- hasta que alguien se acuerda de mirar.
--
-- El aviso lo dispara la base, no la aplicación: la orden se crea con
-- crear_orden, que es una función, y si el aviso viviera en la tienda habría
-- que acordarse de llamarlo en cada sitio que registre una venta del catálogo.
-- Colgado de la tabla no hay forma de que se olvide.

begin;

-- ============================================================================
-- 1. LOS TELÉFONOS QUE QUIEREN QUE LES AVISEN
-- ============================================================================
-- Una fila por dispositivo, no por persona: Yolima con el teléfono y con la
-- tablet son dos suscripciones, y las dos tienen que sonar.

create table if not exists suscripciones_push (
  id          uuid primary key default uuid_generate_v4(),
  perfil_id   uuid not null references perfiles(id) on delete cascade,
  -- La dirección que da el navegador para empujarle avisos. Es única por
  -- dispositivo y cambia si se reinstala.
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  -- Para poder decir "este es tu teléfono" en una lista de tres.
  agente      text,
  creado_at   timestamptz not null default now(),
  usado_at    timestamptz
);

comment on table suscripciones_push is
  'Dispositivos que pidieron recibir avisos de órdenes. Se borran solos cuando el navegador contesta que la suscripción caducó.';

alter table suscripciones_push enable row level security;

-- Cada quien maneja las suyas. Nadie tiene por qué ver el endpoint del
-- teléfono de otra: es una dirección a la que se le pueden mandar avisos.
drop policy if exists suscripciones_push_propias on suscripciones_push;
create policy suscripciones_push_propias on suscripciones_push
  for all to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());

-- ============================================================================
-- 2. AVISAR CUANDO ENTRA UNA ORDEN DEL CATÁLOGO
-- ============================================================================
-- Se usa la extensión http, la misma del cron de la tasa. pg_net serviría
-- también, pero es asíncrona y aquí no hace falta esperar respuesta: si el
-- envío falla, el pedido igual quedó guardado y se ve en el panel.

create table if not exists ajustes_avisos (
  clave  text primary key,
  valor  text not null
);

comment on table ajustes_avisos is
  'Dónde llamar para mandar los avisos y con qué secreto. Aparte del código para poder cambiar el dominio sin desplegar.';

alter table ajustes_avisos enable row level security;
-- Nadie la lee desde el cliente. Solo la función, que es security definer.

create or replace function avisar_orden_nueva()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url     text;
  v_secreto text;
  v_piezas  bigint;
begin
  -- Solo las que entran por la tienda. Una venta del mostrador la está
  -- haciendo alguien que ya está delante de la caja.
  if new.canal is distinct from 'catalogo' or new.estado is distinct from 'borrador' then
    return new;
  end if;

  -- Cuelga del update y no del insert porque crear_orden inserta la venta
  -- vacía, mete las líneas y solo al final escribe los totales. En el insert
  -- el pedido todavía no tiene ni prendas ni monto, y el aviso diría cero.
  if new.total_usd is null or new.total_usd <= 0 or coalesce(old.total_usd, 0) > 0 then
    return new;
  end if;

  select valor into v_url     from ajustes_avisos where clave = 'url_envio';
  select valor into v_secreto from ajustes_avisos where clave = 'secreto';
  if v_url is null or v_secreto is null then
    return new;
  end if;

  select coalesce(sum(cantidad), 0) into v_piezas
    from ventas_lineas where venta_id = new.id;

  -- El resumen viaja en la llamada, no se busca del otro lado. Esto corre
  -- dentro de la transacción que todavía no ha cerrado: si la tienda tuviera
  -- que consultar la venta, no la encontraría.
  begin
    perform http((
      'POST',
      v_url,
      array[http_header('x-mored-secreto', v_secreto)],
      'application/json',
      json_build_object(
        'venta_id',  new.id,
        'numero',    new.numero,
        'piezas',    v_piezas,
        'total_usd', new.total_usd
      )::text
    )::http_request);
  exception when others then
    -- Si el aviso falla, la orden no se pierde: ya está guardada y el panel la
    -- enseña igual. Avisar es un extra, no parte de la venta.
    raise warning 'No se pudo avisar de la orden %: %', new.numero, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_avisar_orden_nueva on ventas;

create trigger trg_avisar_orden_nueva
  after update on ventas
  for each row
  execute function avisar_orden_nueva();

comment on function avisar_orden_nueva is
  'Le pide a la tienda que mande el aviso al teléfono cuando entra una orden del catálogo.';

commit;
