-- Mored Store: identidad de producto desde el link de SHEIN
--
-- Formato confirmado con un link real:
--
--   https://us.shein.com/Men-s-Spring-Summer-Thin-Breathable-Hip-Hop-Linen-
--   Casual-Lounge-Sports-Long-Pants-Beach-Straight-Leg-Hawaiian-Solid-Color-
--   Vacationcore-p-108962030.html?src_identifier=...&mallCode=1&...
--
--   ID:     108962030          (del patrón -p-<digitos>.html)
--   Título: el slug antes de -p-
--   Basura: todo lo que va después de "?" son parámetros de tracking
--
-- La extracción vive acá y no en el front para que la regla no se duplique:
-- pegan el link crudo y la base hace el resto.

begin;

-- ============================================================================
-- EXTRACCIÓN
-- ============================================================================

create or replace function fn_shein_id(p_url text)
returns text
language sql
immutable
as $$
  -- Cubre las dos formas: "-p-108962030.html" y "-p-12345-cat-678.html"
  select substring(p_url from '-p-([0-9]+)');
$$;

comment on function fn_shein_id is
  'El ID es global de SHEIN, no cambia entre us.shein.com y es.shein.com. Es la única parte del link en la que se puede confiar como identidad.';

create or replace function fn_shein_url_limpia(p_url text)
returns text
language sql
immutable
as $$
  select split_part(p_url, '?', 1);
$$;

comment on function fn_shein_url_limpia is
  'Descarta la cola de tracking (src_identifier, src_module, detailBusinessFrom, pageListType...). Es ruido de sesión, no identifica nada.';

create or replace function fn_shein_titulo(p_url text)
returns text
language sql
immutable
as $$
  select nullif(
    -- "Men-s-Spring-Summer-..." -> "Men's Spring Summer ..."
    replace(
      replace(
        substring(
          split_part(split_part(p_url, '?', 1), '/', -1)
          from '^(.*)-p-[0-9]+'
        ),
        '-s-', '''s '
      ),
      '-', ' '
    ),
    ''
  );
$$;

comment on function fn_shein_titulo is
  'Título aproximado, en el idioma del dominio del link. Sirve como referencia y para desempatar al hacer match; NO es el nombre que se muestra. Ese lo escriben ellas.';

-- ============================================================================
-- LLENADO AUTOMÁTICO
-- ============================================================================

create or replace function fn_procesar_url_externa()
returns trigger
language plpgsql
as $$
declare
  v_id text;
begin
  if new.url_externa is null or new.url_externa = '' then
    return new;
  end if;

  -- Si no cambió, no reprocesar (permite corregir el título a mano).
  if tg_op = 'UPDATE' and new.url_externa is not distinct from old.url_externa then
    return new;
  end if;

  v_id := fn_shein_id(new.url_externa);

  if v_id is null then
    raise exception 'No se pudo extraer el ID de SHEIN de: %. ¿Es un link de producto?', new.url_externa;
  end if;

  new.id_externo     := v_id;
  new.url_externa    := fn_shein_url_limpia(new.url_externa);
  new.titulo_completo := coalesce(new.titulo_completo, fn_shein_titulo(new.url_externa));

  return new;
end;
$$;

create trigger tg_procesar_url_externa
  before insert or update of url_externa on productos
  for each row execute function fn_procesar_url_externa();

-- ============================================================================
-- MATCH AUTOMÁTICO EN REORDENES
-- ============================================================================

-- Cuando el importador reconoce un link o un ID ya registrado, la línea de
-- compra se casa sola y nadie confirma nada.
create or replace function buscar_producto_por_link(p_url text)
returns table (
  producto_id   uuid,
  nombre        text,
  coleccion     text,
  id_externo    text
)
language sql
stable
as $$
  select p.id, p.nombre, p.coleccion, p.id_externo
    from productos p
   where p.id_externo = fn_shein_id(p_url)
     and fn_shein_id(p_url) is not null;
$$;

grant execute on function buscar_producto_por_link to authenticated;

commit;
