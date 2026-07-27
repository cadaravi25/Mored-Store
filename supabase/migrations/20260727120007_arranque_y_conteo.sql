-- Mored Store: arranque de catálogo y conteo físico
--
-- Resuelve el "¿y si Fina y Treinta no dejan exportar?". La respuesta es que
-- da bastante igual, porque de todas formas hace falta un conteo físico: lo que
-- diga cualquiera de las dos apps después de meses de manejo manual no coincide
-- con lo que hay en el local. Arrancar importando ese número es heredar el
-- error, no migrarlo.
--
-- Este mismo módulo sirve después para los conteos periódicos.

begin;

-- ============================================================================
-- 1. ALTA RÁPIDA DE VARIANTES
-- ============================================================================
-- La usa tanto la pantalla de conteo (recorriendo el local) como el importador
-- de pedidos cuando aparece un producto nuevo.

create sequence seq_sku start with 1;

create or replace function obtener_o_crear_variante(
  p_coleccion        text,
  p_producto_nombre  text,
  p_color            text,
  p_talla            text,
  p_precio_usd       numeric default 0,
  p_id_externo       text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto_id uuid;
  v_color_id    uuid;
  v_variante_id uuid;
  v_talla       text;
  v_sku         text;
begin
  if p_coleccion not in ('active', 'swim') then
    raise exception 'Colección inválida: %', p_coleccion;
  end if;

  v_talla := coalesce(
    (select talla from equivalencias_talla where origen = p_talla),
    upper(trim(p_talla))
  );

  -- Prioridad: ID de SHEIN, después nombre + colección.
  select id into v_producto_id
    from productos
   where (p_id_externo is not null and id_externo = p_id_externo)
      or (p_id_externo is null
          and coleccion = p_coleccion
          and f_normalizar(nombre) = f_normalizar(p_producto_nombre))
   limit 1;

  if v_producto_id is null then
    insert into productos (coleccion, nombre, id_externo)
    values (p_coleccion, trim(p_producto_nombre), p_id_externo)
    returning id into v_producto_id;
  end if;

  select id into v_color_id
    from colores
   where producto_id = v_producto_id
     and f_normalizar(nombre) = f_normalizar(p_color);

  if v_color_id is null then
    insert into colores (producto_id, nombre)
    values (v_producto_id, trim(p_color))
    returning id into v_color_id;
  end if;

  select id into v_variante_id
    from variantes
   where producto_id = v_producto_id
     and color_id = v_color_id
     and talla = v_talla;

  if v_variante_id is null then
    v_sku := case p_coleccion when 'active' then 'MA-' else 'MS-' end
             || lpad(nextval('seq_sku')::text, 6, '0');

    insert into variantes (producto_id, color_id, talla, talla_origen, sku, precio_usd)
    values (v_producto_id, v_color_id, v_talla,
            nullif(p_talla, v_talla), v_sku, coalesce(p_precio_usd, 0))
    returning id into v_variante_id;
  end if;

  return v_variante_id;
end;
$$;

comment on function obtener_o_crear_variante is
  'Idempotente: llamarla dos veces con los mismos datos devuelve la misma variante. Así la pantalla de conteo no duplica productos si se equivocan y vuelven a cargar.';

grant execute on function obtener_o_crear_variante to authenticated;

-- ============================================================================
-- 2. CONTEO FÍSICO
-- ============================================================================

create table conteos_inventario (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text not null,
  tipo        text not null default 'periodico'
                check (tipo in ('inicial', 'periodico')),
  estado      text not null default 'abierto'
                check (estado in ('abierto', 'aplicado', 'anulado')),
  fecha       date not null default current_date,
  nota        text,
  actor_id    uuid references perfiles(id),
  aplicado_at timestamptz,
  creado_at   timestamptz not null default now()
);

comment on column conteos_inventario.tipo is
  'inicial: el arranque del sistema, todo el stock entra desde cero. periodico: la revisión de rutina contra lo que dice el sistema.';

create table conteos_lineas (
  id                  uuid primary key default uuid_generate_v4(),
  conteo_id           uuid not null references conteos_inventario(id) on delete cascade,
  variante_id         uuid not null references variantes(id) on delete restrict,
  cantidad_contada    integer not null check (cantidad_contada >= 0),
  -- Necesario en el conteo inicial: el sistema no tiene de dónde sacar el costo
  -- de mercancía que compraron antes de existir.
  costo_unitario_usd  numeric(12,2) check (costo_unitario_usd >= 0),
  -- Se congelan al aplicar, para que el conteo quede como evidencia.
  cantidad_sistema    integer,
  diferencia          integer,
  creado_at           timestamptz not null default now(),
  unique (conteo_id, variante_id)
);

create index on conteos_lineas (conteo_id);

-- Vista previa antes de aplicar: qué va a cambiar y en cuánto.
create view v_conteo_diferencias as
select
  cl.conteo_id,
  cl.id                     as linea_id,
  cl.variante_id,
  p.nombre                  as producto,
  col.nombre                as color,
  v.talla,
  v.sku,
  v.stock                   as stock_sistema,
  cl.cantidad_contada,
  cl.cantidad_contada - v.stock as diferencia,
  abs(cl.cantidad_contada - v.stock)
    * coalesce(cl.costo_unitario_usd, v.costo_promedio_usd) as impacto_usd
from conteos_lineas cl
join variantes v  on v.id = cl.variante_id
join productos p  on p.id = v.producto_id
join colores col  on col.id = v.color_id
join conteos_inventario ci on ci.id = cl.conteo_id
where ci.estado = 'abierto';

comment on view v_conteo_diferencias is
  'Se revisa antes de aplicar. En un conteo periódico, una diferencia grande casi siempre es un error de conteo, no un robo: conviene recontar antes de ajustar.';

-- Aplica el conteo: genera un ajuste por cada diferencia y congela la evidencia.
create or replace function aplicar_conteo(p_conteo_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conteo    conteos_inventario%rowtype;
  v_fila      record;
  v_ajustes   integer := 0;
  v_costo     numeric(12,2);
  v_actor     uuid := auth.uid();
begin
  select * into v_conteo from conteos_inventario where id = p_conteo_id for update;
  if not found then
    raise exception 'Conteo % no existe.', p_conteo_id;
  end if;
  if v_conteo.estado <> 'abierto' then
    raise exception 'El conteo % ya fue % .', p_conteo_id, v_conteo.estado;
  end if;

  -- Sin costo no se puede valorar mercancía que entra, y sin valor el margen
  -- de esos productos queda inventado.
  if exists (
    select 1
      from conteos_lineas cl
      join variantes v on v.id = cl.variante_id
     where cl.conteo_id = p_conteo_id
       and cl.cantidad_contada > v.stock
       and coalesce(cl.costo_unitario_usd, nullif(v.costo_promedio_usd, 0)) is null
  ) then
    raise exception 'Hay líneas que suman stock sin costo unitario. Complétalas antes de aplicar.';
  end if;

  for v_fila in
    select cl.id, cl.variante_id, cl.cantidad_contada, cl.costo_unitario_usd,
           v.stock, v.costo_promedio_usd
      from conteos_lineas cl
      join variantes v on v.id = cl.variante_id
     where cl.conteo_id = p_conteo_id
     for update of cl
  loop
    update conteos_lineas
       set cantidad_sistema = v_fila.stock,
           diferencia       = v_fila.cantidad_contada - v_fila.stock
     where id = v_fila.id;

    continue when v_fila.cantidad_contada = v_fila.stock;

    v_costo := case
      when v_fila.cantidad_contada > v_fila.stock
        then coalesce(v_fila.costo_unitario_usd, nullif(v_fila.costo_promedio_usd, 0))
      else null   -- las salidas no recalculan el costo promedio
    end;

    insert into movimientos_stock (
      variante_id, tipo, cantidad, costo_unitario_usd,
      referencia_tipo, referencia_id, nota, actor_id
    ) values (
      v_fila.variante_id,
      'ajuste',
      v_fila.cantidad_contada - v_fila.stock,
      v_costo,
      'manual', p_conteo_id,
      v_conteo.nombre,
      v_actor
    );

    v_ajustes := v_ajustes + 1;
  end loop;

  update conteos_inventario
     set estado = 'aplicado', aplicado_at = now()
   where id = p_conteo_id;

  return v_ajustes;
end;
$$;

comment on function aplicar_conteo is
  'Los ajustes quedan como movimientos de stock normales, así que la diferencia siempre se puede rastrear hasta el conteo que la originó.';

revoke all on function aplicar_conteo from public;
grant execute on function aplicar_conteo to authenticated;

alter table conteos_inventario enable row level security;
alter table conteos_lineas     enable row level security;
create policy acceso_conteos_inventario on conteos_inventario
  for all to authenticated using (true) with check (true);
create policy acceso_conteos_lineas on conteos_lineas
  for all to authenticated using (true) with check (true);

commit;
