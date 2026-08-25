-- Mored Store: poder arreglar y quitar prendas desde el panel
--
-- Hasta ahora el inventario dejaba cambiar la foto, los precios, destacar y
-- repartir tallas, pero no corregir un nombre mal escrito, ni ajustar lo que
-- de verdad hay en el perchero, ni sacar una prenda que ya no se vende. Para
-- todo eso había que entrar a la base, y eso no lo va a hacer nadie.

begin;

-- ============================================================================
-- 1. CORREGIR EL NOMBRE Y LA DESCRIPCIÓN
-- ============================================================================
-- La descripción es lo único que distingue una prenda de otra en la tienda: el
-- nombre las agrupa a propósito. Una descripción mal escrita no se puede
-- arreglar desde ningún sitio, y hay ciento y pico que salieron de un vídeo.

create or replace function editar_prenda(
  p_producto_id uuid,
  p_nombre      text,
  p_descripcion text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := nullif(trim(coalesce(p_nombre, '')), '');
begin
  if v_nombre is null then
    raise exception 'La prenda necesita un nombre.';
  end if;

  update productos
     set nombre      = v_nombre,
         -- Una descripción vacía se guarda como nada, no como cadena vacía:
         -- la tienda ya sabe qué hacer con la ausencia.
         descripcion = nullif(trim(coalesce(p_descripcion, '')), '')
   where id = p_producto_id;

  if not found then
    raise exception 'Esa prenda ya no existe.';
  end if;
end;
$$;

revoke all on function editar_prenda(uuid, text, text) from public;
grant execute on function editar_prenda(uuid, text, text) to authenticated;

-- ============================================================================
-- 2. CORREGIR EL NOMBRE DEL COLOR
-- ============================================================================

create or replace function renombrar_color(p_color_id uuid, p_nombre text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre    text := nullif(trim(coalesce(p_nombre, '')), '');
  v_producto  uuid;
begin
  if v_nombre is null then
    raise exception 'El color necesita un nombre.';
  end if;

  select producto_id into v_producto from colores where id = p_color_id;
  if v_producto is null then
    raise exception 'Ese color ya no existe.';
  end if;

  -- Dos colores con el mismo nombre en la misma prenda no pueden convivir, y
  -- el error de la base no dice nada útil. Mejor decirlo aquí.
  if exists (
    select 1 from colores
     where producto_id = v_producto
       and id <> p_color_id
       and f_normalizar(nombre) = f_normalizar(v_nombre)
  ) then
    raise exception 'Esa prenda ya tiene un color llamado %.', v_nombre;
  end if;

  update colores set nombre = v_nombre where id = p_color_id;
end;
$$;

revoke all on function renombrar_color(uuid, text) from public;
grant execute on function renombrar_color(uuid, text) to authenticated;

-- ============================================================================
-- 3. DEJAR EL STOCK EN LO QUE DE VERDAD HAY
-- ============================================================================
-- Casi todo el catálogo entró con una unidad por talla porque nadie las contó.
-- Esto es lo que hace falta para repasarlo: se dice cuántas hay y la función
-- calcula el movimiento que falta. Nunca se escribe la columna a mano, que es
-- lo que avisa el esquema: la fuente de verdad es el libro de movimientos.

create or replace function ajustar_existencias(
  p_variante_id uuid,
  p_cantidad    integer,
  p_nota        text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual integer;
  v_delta  integer;
begin
  if p_cantidad is null or p_cantidad < 0 then
    raise exception 'No se puede tener una cantidad negativa.';
  end if;

  select stock into v_actual from variantes where id = p_variante_id;
  if v_actual is null then
    raise exception 'Esa talla ya no existe.';
  end if;

  v_delta := p_cantidad - v_actual;
  -- Un ajuste que no cambia nada no se anota: el libro es para leerlo.
  if v_delta = 0 then
    return v_actual;
  end if;

  insert into movimientos_stock (
    variante_id, tipo, cantidad, referencia_tipo, nota, actor_id
  ) values (
    p_variante_id, 'ajuste', v_delta, 'manual',
    coalesce(nullif(trim(p_nota), ''),
             format('Conteo a mano: de %s a %s', v_actual, p_cantidad)),
    auth.uid()
  );

  return p_cantidad;
end;
$$;

revoke all on function ajustar_existencias(uuid, integer, text) from public;
grant execute on function ajustar_existencias(uuid, integer, text) to authenticated;

-- ============================================================================
-- 4. QUITAR UN COLOR, O LA PRENDA ENTERA
-- ============================================================================
-- LO QUE SE VENDIÓ NO SE BORRA
--
-- Si de ese color salió aunque sea una venta, borrarlo dejaría a Caja y a
-- Finanzas hablando de una prenda que ya no existe, y los números de meses
-- pasados cambiarían solos. En ese caso se desactiva: desaparece de la tienda
-- y del inventario, pero el historial sigue cuadrando.
--
-- Solo lo que nunca se vendió se borra de verdad, con su rastro entero, para
-- que no quede stock fantasma de algo que se cargó por error.

create or replace function retirar_color(p_color_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto  uuid;
  v_vendidas  integer;
  v_variantes integer;
  v_borrado   boolean;
  v_quedan    integer;
begin
  select producto_id into v_producto from colores where id = p_color_id;
  if v_producto is null then
    raise exception 'Ese color ya no existe.';
  end if;

  select count(*) into v_vendidas
    from ventas_lineas vl
    join variantes v on v.id = vl.variante_id
   where v.color_id = p_color_id;

  select count(*) into v_variantes from variantes where color_id = p_color_id;

  if v_vendidas > 0 then
    update variantes set activa = false where color_id = p_color_id;
    v_borrado := false;
  else
    delete from movimientos_stock
     where variante_id in (select id from variantes where color_id = p_color_id);
    delete from reservas_stock
     where variante_id in (select id from variantes where color_id = p_color_id);
    delete from variantes where color_id = p_color_id;
    delete from fotos_color where color_id = p_color_id;
    delete from colores where id = p_color_id;
    v_borrado := true;
  end if;

  -- Una prenda sin ningún color vendible no tiene por qué seguir apareciendo.
  select count(*) into v_quedan
    from variantes where producto_id = v_producto and activa;

  if v_quedan = 0 then
    update productos set activo = false where id = v_producto;
  end if;

  return jsonb_build_object(
    'borrado', v_borrado,
    'variantes', v_variantes,
    'prenda_retirada', v_quedan = 0
  );
end;
$$;

revoke all on function retirar_color(uuid) from public;
grant execute on function retirar_color(uuid) to authenticated;

commit;
