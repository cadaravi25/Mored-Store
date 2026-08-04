-- Mored Store: un set no es una prenda
--
-- Los packs existen del lado de la COMPRA: SHEIN vende "set de 3 leggings" y
-- se paga uno solo precio por los tres. Pero del lado de la VENTA no existen:
-- se vende un legging, no un set. Ya el sistema lo hacía bien al recibir
-- (reparte el costo entre las piezas y crea una variante por pieza), pero
-- 'Set' estaba en la lista de tipos de prenda, invitando a cargarlo mal.
--
-- El nombre de un producto se arma como TIPO + ESTILO. Si el tipo es "Set" o
-- el estilo es "3 piezas", ese texto queda pegado a cada pieza suelta para
-- siempre, y al vender aparece "Set 3 piezas leggings" con stock 1, que no
-- significa nada.

begin;

-- ============================================================================
-- 1. FUERA 'SET' DEL VOCABULARIO
-- ============================================================================

delete from tipos_prenda
 where public.f_normalizar(nombre) in ('set', 'sets', 'pack', 'combo', 'kit')
   and not exists (
     select 1 from productos p where p.tipo_id = tipos_prenda.id
   );

-- Si alguno estaba en uso no se borra (rompería el producto), pero se retira
-- de la lista para que no se pueda escoger de nuevo.
update tipos_prenda
   set activo = false
 where public.f_normalizar(nombre) in ('set', 'sets', 'pack', 'combo', 'kit');

-- ============================================================================
-- 2. QUE NO VUELVA A ENTRAR
-- ============================================================================
-- La lista de tipos y estilos se puede ampliar desde la pantalla de recibir,
-- que es como debe ser. Pero un empaque no es una prenda ni un estilo, y esa
-- distinción no se sostiene sola: hay que sostenerla acá.

create or replace function f_es_empaque(texto text)
returns boolean
language sql
immutable
parallel safe
as $$
  select public.f_normalizar(coalesce(texto, '')) ~
         '(^|\s)(set|sets|pack|packs|combo|kit|juego|trio|duo)($|\s)'
      or public.f_normalizar(coalesce(texto, '')) ~ '[0-9]\s*(piezas?|pzas?|und|uds)'
      or public.f_normalizar(coalesce(texto, '')) ~ '(^|\s)x\s*[2-9]($|\s)';
$$;

comment on function f_es_empaque is
  'Reconoce el lenguaje de empaque: "set", "pack de 3", "x3". Sirve para no dejar que se cuele en el nombre de una prenda.';

-- NOT VALID a propósito: la regla rige de aquí en adelante, sin romper la
-- migración si quedó algún nombre viejo que la incumple. Lo viejo se limpia
-- mirándolo; lo nuevo ya no puede entrar.
alter table tipos_prenda drop constraint if exists tipos_prenda_no_empaque;
alter table tipos_prenda
  add constraint tipos_prenda_no_empaque
  check (not public.f_es_empaque(nombre)) not valid;

alter table estilos drop constraint if exists estilos_no_empaque;
alter table estilos
  add constraint estilos_no_empaque
  check (not public.f_es_empaque(nombre)) not valid;

-- ============================================================================
-- 3. MENSAJE ENTENDIBLE EN VEZ DEL ERROR DE POSTGRES
-- ============================================================================
-- Las dos funciones que crean vocabulario desde la pantalla de recibir avisan
-- qué hacer, en vez de dejar salir un error de restricción que no se entiende.

create or replace function obtener_o_crear_tipo(
  p_coleccion text,
  p_nombre    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if f_es_empaque(p_nombre) then
    raise exception 'Un set o un pack no es un tipo de prenda: carga la prenda suelta ("Licra", "Top") e indica cuántas piezas trae.';
  end if;

  select id into v_id
    from tipos_prenda
   where coleccion = p_coleccion
     and f_normalizar(nombre) = f_normalizar(trim(p_nombre));

  if v_id is not null then
    update tipos_prenda set activo = true where id = v_id;
    return v_id;
  end if;

  insert into tipos_prenda (coleccion, nombre, orden)
  values (p_coleccion, trim(p_nombre),
          coalesce((select max(orden) + 10 from tipos_prenda
                     where coleccion = p_coleccion), 10))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function obtener_o_crear_tipo from public;
grant execute on function obtener_o_crear_tipo to authenticated;

create or replace function obtener_o_crear_estilo(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if f_es_empaque(p_nombre) then
    raise exception 'Cuántas piezas trae el paquete no es un estilo: eso se indica arriba, en "¿Cuántas piezas trae?".';
  end if;

  select id into v_id from estilos
   where f_normalizar(nombre) = f_normalizar(trim(p_nombre));

  if v_id is not null then
    update estilos set activo = true where id = v_id;
    return v_id;
  end if;

  insert into estilos (nombre, orden)
  values (trim(p_nombre),
          coalesce((select max(orden) + 10 from estilos), 10))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function obtener_o_crear_estilo from public;
grant execute on function obtener_o_crear_estilo to authenticated;

commit;
