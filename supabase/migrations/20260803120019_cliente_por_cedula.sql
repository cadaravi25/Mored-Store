-- Mored Store: la cédula identifica al cliente
--
-- Hasta ahora el teléfono era la identidad. La cédula es mejor: no cambia
-- nunca, no se comparte y el cliente se la sabe de memoria. El teléfono se
-- cambia, se presta y a veces la mamá paga con el suyo por la hija.
--
-- Por eso también se suelta el índice único del teléfono. Que dos clientes
-- compartan número es raro pero pasa, y un error de "teléfono repetido" en
-- plena venta obliga a inventar un número para poder cobrar. Se sigue usando
-- para reconocer a quien ya está, pero ya no bloquea.

begin;

-- ============================================================================
-- 1. CLAVE DE CÉDULA
-- ============================================================================
-- V-12.345.678, v12345678 y 12345678 son la misma persona. Sin letra se asume
-- V, que es la enorme mayoría; E y J se respetan porque sí distinguen.

create or replace function f_cedula_clave(texto text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when nullif(regexp_replace(coalesce(texto, ''), '\D', '', 'g'), '') is null
      then null
    else
      case upper(substring(regexp_replace(coalesce(texto, ''), '[^A-Za-z]', '', 'g') from 1 for 1))
        when 'E' then 'E'
        when 'J' then 'J'
        when 'G' then 'G'
        when 'P' then 'P'
        else 'V'
      end
      || regexp_replace(texto, '\D', '', 'g')
  end;
$$;

comment on function f_cedula_clave is
  'Cédula normalizada: letra (V por defecto) más los dígitos. Para que la misma persona escrita de cualquier forma sea una sola.';

create unique index if not exists idx_clientes_cedula
  on clientes (public.f_cedula_clave(cedula))
  where public.f_cedula_clave(cedula) is not null;

-- El teléfono deja de ser único: sigue sirviendo para buscar y para reconocer,
-- pero no puede impedir que se cobre.
drop index if exists idx_clientes_telefono;
create index if not exists idx_clientes_telefono
  on clientes (public.f_telefono_clave(telefono));

-- ============================================================================
-- 2. LA LISTA Y LA BÚSQUEDA INCLUYEN LA CÉDULA
-- ============================================================================

create or replace view v_clientes as
select
  c.id,
  c.nombre,
  c.telefono,
  c.instagram,
  c.cedula,
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
      or (public.f_digitos(p_termino) is not null
          and public.f_digitos(vc.cedula) like public.f_digitos(p_termino) || '%')
   order by vc.ultima_compra desc nulls last, vc.nombre
   limit greatest(p_limite, 1);
$$;

revoke all on function buscar_clientes from public;
grant execute on function buscar_clientes to authenticated;

-- ============================================================================
-- 3. BUSCAR POR CÉDULA, QUE ES EL PRIMER PASO DE LA VENTA
-- ============================================================================

create or replace function cliente_por_cedula(p_cedula text)
returns table (
  id        uuid,
  nombre    text,
  cedula    text,
  telefono  text,
  instagram text,
  compras   integer,
  total_usd numeric
)
language sql
stable
as $$
  select vc.id, vc.nombre, vc.cedula, vc.telefono, vc.instagram,
         vc.compras, vc.total_usd
    from v_clientes vc
   where public.f_cedula_clave(vc.cedula) = public.f_cedula_clave(p_cedula)
     and public.f_cedula_clave(p_cedula) is not null
   limit 1;
$$;

revoke all on function cliente_por_cedula from public;
grant execute on function cliente_por_cedula to authenticated;

-- ============================================================================
-- 4. CREAR DESDE EL MOSTRADOR
-- ============================================================================
-- Se busca por cédula, y si no la dieron, por teléfono. Nunca falla por
-- duplicado: devuelve el que ya está y le completa lo que le faltaba.

drop function if exists obtener_o_crear_cliente(text, text, text);

create function obtener_o_crear_cliente(
  p_nombre    text,
  p_cedula    text default null,
  p_telefono  text default null,
  p_instagram text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_cedula text := f_cedula_clave(p_cedula);
  v_tlf    text := f_telefono_clave(p_telefono);
begin
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'El cliente necesita al menos un nombre.';
  end if;

  if v_cedula is not null then
    select id into v_id from clientes
     where f_cedula_clave(cedula) = v_cedula limit 1;
  end if;

  if v_id is null and v_tlf is not null then
    select id into v_id from clientes
     where f_telefono_clave(telefono) = v_tlf limit 1;
  end if;

  if v_id is not null then
    -- Se completa lo que faltara, sin pisar lo que ya estaba escrito.
    update clientes
       set cedula    = coalesce(cedula, p_cedula),
           telefono  = coalesce(telefono, p_telefono),
           instagram = coalesce(instagram, p_instagram)
     where id = v_id;
    return v_id;
  end if;

  insert into clientes (nombre, cedula, telefono, instagram)
  values (p_nombre, p_cedula, p_telefono, p_instagram)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function obtener_o_crear_cliente from public;
grant execute on function obtener_o_crear_cliente to authenticated;

-- La cédula también se guarda limpia: sin puntos ni guiones, con su letra.
create or replace function fn_limpiar_cliente()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nombre    := trim(new.nombre);
  new.instagram := nullif(ltrim(trim(coalesce(new.instagram, '')), '@'), '');
  new.telefono  := nullif(trim(coalesce(new.telefono, '')), '');
  new.cedula    := f_cedula_clave(new.cedula);
  return new;
end;
$$;

commit;
