-- Que la tasa se actualice sola, sin que nadie abra el panel.
--
-- EL PROBLEMA
--
-- Hasta ahora la tasa solo se refrescaba cuando alguien entraba a Finanzas: es
-- la ruta /api/bcv la que sale a buscarla, y exige sesión. Si nadie entra en
-- todo el día, la tienda sigue enseñando precios en bolívares con la tasa de
-- hace tres días, y una compra de madrugada se cobra a la de anteayer.
--
-- POR QUÉ AQUÍ Y NO EN EL HOSTING
--
-- Escribir la tasa pide permiso de escritura. Hacerlo desde una función
-- programada de Netlify obligaría a cargar allí la clave `service_role`, que se
-- salta todas las reglas de la base. Dentro de Postgres no hace falta ninguna
-- clave, y además sigue funcionando aunque el sitio esté caído o un despliegue
-- falle.
--
-- POR QUÉ `http` Y NO `pg_net`
--
-- `pg_net` es asíncrono: la petición devuelve un número y la respuesta aparece
-- más tarde en otra tabla, así que harían falta dos trabajos encadenados y
-- adivinar cuánto esperar entre ellos. `http` responde en el momento: una
-- función, un trabajo.
--
-- POR QUÉ LA API Y NO EL SITIO DEL BCV
--
-- La aplicación raspa el HTML del BCV porque de ahí saca la fecha valor, que
-- dice desde cuándo rige. Aquí no hace falta esa finura y sí hace falta que no
-- se rompa: leer un JSON aguanta, raspar HTML se cae el día que el BCV cambie
-- su página. Esto no sustituye a aquello, se suma.
--
-- ESTO NO PISA LO QUE ELLAS DECIDAN
--
-- La tasa de venta solo se escribe si ese día no tiene ninguna. Si la pusieron
-- a mano en el panel, se queda la de ellas.

begin;

create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

create or replace function refrescar_tasa_bcv()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $funcion$
declare
  v_respuesta  jsonb;
  v_eur        numeric;
  v_usd        numeric;
  v_fecha      date;
  v_hoy        date := (now() at time zone 'America/Caracas')::date;
begin
  -- Diez segundos y ni uno más: esto corre solo y nadie lo está mirando.
  perform http_set_curlopt('CURLOPT_TIMEOUT', '10');

  begin
    select content::jsonb into v_respuesta
      from http_get('https://ve.dolarapi.com/v1/euros/oficial');
  exception when others then
    return 'sin conexión con la fuente del euro';
  end;

  v_eur := nullif(v_respuesta->>'promedio', '')::numeric;
  if v_eur is null or v_eur <= 0 then
    return 'la fuente no devolvió una tasa del euro utilizable';
  end if;

  -- La fecha efectiva es el día de Caracas en que la fuente la actualizó, que
  -- es el mismo criterio que usa la aplicación para el respaldo.
  v_fecha := coalesce(
    ((v_respuesta->>'fechaActualizacion')::timestamptz at time zone 'America/Caracas')::date,
    v_hoy);

  -- El dólar se guarda solo de referencia: Mored cobra con la del euro.
  begin
    select content::jsonb into v_respuesta
      from http_get('https://ve.dolarapi.com/v1/dolares/oficial');
    v_usd := nullif(v_respuesta->>'promedio', '')::numeric;
  exception when others then
    v_usd := null;
  end;

  insert into tasas_bcv (fecha, bs_por_usd, bs_por_eur, fuente, obtenido_at)
  values (v_fecha, v_usd, v_eur, 'dolarapi.com (automático)', now())
  on conflict (fecha) do update
    set bs_por_usd  = coalesce(excluded.bs_por_usd, tasas_bcv.bs_por_usd),
        bs_por_eur  = excluded.bs_por_eur,
        fuente      = excluded.fuente,
        obtenido_at = excluded.obtenido_at;

  -- La tasa con la que se cobra, solo si hoy no tiene una. Si la pusieron a
  -- mano, manda la de ellas.
  insert into tasas_venta (fecha, bs_por_usd, base)
  values (v_hoy, v_eur, 'bcv_eur')
  on conflict (fecha) do nothing;

  return format('tasa del %s guardada: %s Bs por euro', v_fecha, v_eur);
end;
$funcion$;

-- Solo la corre el programador. No hay motivo para que nadie más pueda
-- dispararla desde fuera.
revoke all on function refrescar_tasa_bcv() from public;

-- Tres veces al día y no una. Con una sola, un fallo de red deja la tienda
-- cobrando con la tasa de ayer durante veinticuatro horas.
--
-- Las horas van en UTC, que es lo que entiende el programador. Caracas está en
-- UTC-4, así que esto es medianoche, ocho de la mañana y cinco de la tarde:
-- la medianoche que pidió Carlos, la mañana por si esa falló y hay que abrir
-- el local, y las cinco porque el BCV publica a las cuatro.
select cron.unschedule('tasa-bcv-madrugada')
  where exists (select 1 from cron.job where jobname = 'tasa-bcv-madrugada');
select cron.unschedule('tasa-bcv-manana')
  where exists (select 1 from cron.job where jobname = 'tasa-bcv-manana');
select cron.unschedule('tasa-bcv-tarde')
  where exists (select 1 from cron.job where jobname = 'tasa-bcv-tarde');

select cron.schedule('tasa-bcv-madrugada', '5 4 * * *',  'select refrescar_tasa_bcv()');
select cron.schedule('tasa-bcv-manana',    '5 12 * * *', 'select refrescar_tasa_bcv()');
select cron.schedule('tasa-bcv-tarde',     '5 21 * * *', 'select refrescar_tasa_bcv()');

commit;

-- Para comprobarlo sin esperar a mañana:
--
--   select refrescar_tasa_bcv();
--   select fecha, bs_por_eur, fuente, obtenido_at from tasas_bcv order by fecha desc limit 3;
--
-- Y para ver que los trabajos quedaron puestos:
--
--   select jobname, schedule, active from cron.job where jobname like 'tasa-bcv%';
--
-- Si alguno falla, queda registrado:
--
--   select jobname, status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 10;
