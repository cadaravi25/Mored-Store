-- Mored Store: clientes
--
-- La tabla existía desde el principio pero nadie la llenaba: el punto de venta
-- nunca preguntaba por el cliente. Aquí se le da uso.
--
-- Lo que de verdad necesitan saber cuando un cliente escribe por Instagram no
-- es cuánto gastó: es QUÉ TALLA USA y qué se llevó la última vez. Eso hoy vive
-- en la memoria de las dos socias y en conversaciones de WhatsApp de hace tres
-- meses. Por eso la ficha arranca por ahí y no por el total.

begin;

-- ============================================================================
-- 1. IDENTIDAD DEL CLIENTE
-- ============================================================================
-- El teléfono es lo único que de verdad identifica a una persona acá: los
-- nombres se repiten y se escriben de diez maneras. Se guarda como lo
-- escriban, pero se compara por sus dígitos, para que 0414-1234567,
-- 04141234567 y +58 414 123 4567 sean el mismo cliente.
--
-- Todo lo que se llame desde acá va con el esquema por delante
-- (public.f_...): al construir un índice, Postgres resuelve la función con el
-- search_path de la sesión, que en el editor de Supabase no es el que uno
-- supone. Sin calificar, falla con "la función no existe" aunque exista.

create or replace function f_digitos(texto text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(regexp_replace(coalesce(texto, ''), '\D', '', 'g'), '');
$$;

comment on function f_digitos is
  'Solo los dígitos de un texto. Para comparar teléfonos escritos de cualquier forma.';

-- Los últimos 10 dígitos: así un número guardado con +58 y otro sin él siguen
-- siendo el mismo. Se compara por la cola porque el prefijo del país es lo que
-- aparece y desaparece.
--
-- La cuenta va escrita completa aquí dentro, sin llamar a f_digitos, porque
-- esta función se usa en un índice y una dependencia menos es un problema
-- menos al construirlo.
create or replace function f_telefono_clave(texto text)
returns text
language sql
immutable
parallel safe
as $$
  select right(nullif(regexp_replace(coalesce(texto, ''), '\D', '', 'g'), ''), 10);
$$;

create unique index if not exists idx_clientes_telefono
  on clientes (public.f_telefono_clave(telefono))
  where public.f_telefono_clave(telefono) is not null;

create index if not exists idx_clientes_nombre_trgm
  on clientes using gin (public.f_normalizar(nombre) gin_trgm_ops);

create index if not exists idx_clientes_instagram
  on clientes (public.f_normalizar(instagram));

-- El arroba del Instagram lo escriben a veces sí y a veces no.
create or replace function fn_limpiar_cliente()
returns trigger
language plpgsql
as $$
begin
  new.nombre    := trim(new.nombre);
  new.instagram := nullif(ltrim(trim(coalesce(new.instagram, '')), '@'), '');
  new.telefono  := nullif(trim(coalesce(new.telefono, '')), '');
  new.cedula    := nullif(trim(coalesce(new.cedula, '')), '');
  return new;
end;
$$;

drop trigger if exists tg_limpiar_cliente on clientes;
create trigger tg_limpiar_cliente
  before insert or update on clientes
  for each row execute function fn_limpiar_cliente();

-- ============================================================================
-- 2. LA LISTA
-- ============================================================================

create or replace view v_clientes as
select
  c.id,
  c.nombre,
  c.telefono,
  c.instagram,
  c.nota,
  c.creado_at,
  count(v.id)::integer                        as compras,
  coalesce(sum(v.total_usd), 0)::numeric(12,2) as total_usd,
  max(v.creado_at)                            as ultima_compra
from clientes c
left join ventas v
       on v.cliente_id = c.id
      and v.estado <> 'anulada'
group by c.id;

alter view v_clientes set (security_invoker = true);
grant select on v_clientes to authenticated;

-- Busca por nombre, teléfono o Instagram sin que haga falta saber cuál. Se
-- escribe "marta", "0414" o "@martac" y sale igual.
create or replace function buscar_clientes(
  p_termino text default null,
  p_limite  integer default 40
)
returns setof v_clientes
language sql
stable
as $$
  select *
    from v_clientes vc
   where coalesce(trim(p_termino), '') = ''
      or public.f_normalizar(vc.nombre) like '%' || public.f_normalizar(trim(p_termino)) || '%'
      or public.f_normalizar(coalesce(vc.instagram, '')) like '%' || public.f_normalizar(ltrim(trim(p_termino), '@')) || '%'
      or (public.f_digitos(p_termino) is not null
          and public.f_digitos(vc.telefono) like '%' || public.f_digitos(p_termino) || '%')
   order by vc.ultima_compra desc nulls last, vc.nombre
   limit greatest(p_limite, 1);
$$;

revoke all on function buscar_clientes from public;
grant execute on function buscar_clientes to authenticated;

-- ============================================================================
-- 3. LA FICHA
-- ============================================================================
-- Todo lo de un cliente en una sola consulta: sus datos, qué tallas usa, qué
-- colores le gustan y sus últimas compras con las prendas.

create or replace function ficha_cliente(p_cliente_id uuid)
returns jsonb
language sql
stable
as $$
  with compras as (
    select v.id, v.numero, v.serie, v.canal, v.tipo, v.estado,
           v.total_usd, v.creado_at
      from ventas v
     where v.cliente_id = p_cliente_id
       and v.estado <> 'anulada'
     order by v.creado_at desc
  ),
  lineas as (
    select vl.venta_id, vl.cantidad, vl.precio_unitario_usd,
           va.talla, co.nombre as color, cc.hex,
           concat_ws(' ', tp.nombre, pr.detalle, pr.nombre) as prenda
      from ventas_lineas vl
      join compras       cp on cp.id = vl.venta_id
      join variantes     va on va.id = vl.variante_id
      join productos     pr on pr.id = va.producto_id
      join colores       co on co.id = va.color_id
      left join tipos_prenda tp on tp.id = pr.tipo_id
      -- El color guardado es texto libre; el catálogo es el que tiene el hex.
      left join colores_catalogo cc
             on public.f_normalizar(cc.nombre) = public.f_normalizar(co.nombre)
  )
  select jsonb_build_object(
    'cliente', (select to_jsonb(c) from clientes c where c.id = p_cliente_id),
    'compras', (select count(*) from compras),
    'total_usd', coalesce((select sum(total_usd) from compras), 0),
    'prendas', coalesce((select sum(cantidad) from lineas), 0),
    'ultima_compra', (select max(creado_at) from compras),
    -- Lo que más se consulta: qué talla usa.
    'tallas', coalesce((
      select jsonb_agg(jsonb_build_object('talla', talla, 'veces', veces)
                       order by veces desc, talla)
        from (select talla, sum(cantidad)::integer as veces
                from lineas where talla is not null
               group by talla) t), '[]'::jsonb),
    'colores', coalesce((
      select jsonb_agg(jsonb_build_object('color', color, 'hex', hex, 'veces', veces)
                       order by veces desc, color)
        from (select color, hex, sum(cantidad)::integer as veces
                from lineas group by color, hex
               order by sum(cantidad) desc limit 6) c), '[]'::jsonb),
    'historial', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', cp.id, 'serie', cp.serie, 'numero', cp.numero,
               'canal', cp.canal, 'tipo', cp.tipo, 'estado', cp.estado,
               'total_usd', cp.total_usd, 'creado_at', cp.creado_at,
               'lineas', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'prenda', l.prenda, 'color', l.color, 'hex', l.hex,
                          'talla', l.talla, 'cantidad', l.cantidad,
                          'precio_usd', l.precio_unitario_usd)), '[]'::jsonb)
                   from lineas l where l.venta_id = cp.id))
             order by cp.creado_at desc)
        from compras cp), '[]'::jsonb)
  );
$$;

revoke all on function ficha_cliente from public;
grant execute on function ficha_cliente to authenticated;

-- ============================================================================
-- 4. REGISTRAR UNA VENTA A NOMBRE DE ALGUIEN
-- ============================================================================
-- En el mostrador no se va a llenar una ficha completa: se escribe un nombre y
-- un teléfono mientras el cliente paga. Si ese teléfono ya existe, se usa la
-- cliente que ya está en vez de crear una repetida.

create or replace function obtener_o_crear_cliente(
  p_nombre    text,
  p_telefono  text default null,
  p_instagram text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_clave text := public.f_telefono_clave(p_telefono);
begin
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'El cliente necesita al menos un nombre.';
  end if;

  if v_clave is not null then
    select id into v_id from clientes
     where public.f_telefono_clave(telefono) = v_clave
     limit 1;
    if v_id is not null then
      -- Se completa lo que faltara, sin pisar lo que ya estaba escrito.
      update clientes
         set instagram = coalesce(instagram, p_instagram)
       where id = v_id;
      return v_id;
    end if;
  end if;

  insert into clientes (nombre, telefono, instagram)
  values (p_nombre, p_telefono, p_instagram)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function obtener_o_crear_cliente from public;
grant execute on function obtener_o_crear_cliente to authenticated;

commit;
