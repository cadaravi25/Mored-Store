-- Mored Store: vocabulario controlado de tipos de prenda y colores
--
-- El objetivo no es solo que carguen rápido, es que la lista no se degrade.
-- Con texto libre, en tres meses hay "Top", "top", "Tops" y "Top deportivo"
-- siendo la misma prenda, y ahí se acaban el autocompletado y los reportes.
--
-- La garantía está en la base y no en la pantalla: el índice único va sobre el
-- nombre NORMALIZADO, así que "Top", "top", "TOP" y "Tóp" son el mismo valor y
-- no se pueden duplicar ni queriendo. Agregar un tipo nuevo sigue siendo un
-- toque; lo que se vuelve imposible es agregar dos veces el mismo.

begin;

-- ============================================================================
-- 1. TIPOS DE PRENDA
-- ============================================================================

create table tipos_prenda (
  id         uuid primary key default uuid_generate_v4(),
  coleccion  text not null check (coleccion in ('active', 'swim')),
  nombre     text not null check (length(trim(nombre)) between 2 and 40),
  orden      integer not null default 0,
  activo     boolean not null default true,
  creado_at  timestamptz not null default now()
);

create unique index idx_tipos_prenda_unico
  on tipos_prenda (coleccion, f_normalizar(nombre));

comment on index idx_tipos_prenda_unico is
  'Sobre el nombre normalizado: "Top", "top" y "Tóp" colisionan y no se duplican.';

create table colores_catalogo (
  id         uuid primary key default uuid_generate_v4(),
  nombre     text not null check (length(trim(nombre)) between 2 and 30),
  hex        text check (hex ~ '^#[0-9a-fA-F]{6}$'),
  orden      integer not null default 0,
  activo     boolean not null default true,
  creado_at  timestamptz not null default now()
);

create unique index idx_colores_catalogo_unico
  on colores_catalogo (f_normalizar(nombre));

comment on column colores_catalogo.hex is
  'Opcional. Permite mostrar un punto de color en los botones, que se reconoce mas rapido que leer.';

-- ============================================================================
-- 2. EL PRODUCTO SE ARMA, NO SE ESCRIBE
-- ============================================================================

alter table productos
  add column tipo_id uuid references tipos_prenda(id) on delete restrict,
  add column detalle text;

comment on column productos.detalle is
  'Palabra corta que separa modelos dentro de un mismo tipo: "tirantes", "manga larga", "3/4". Vacio cuando no hace falta.';
comment on column productos.nombre is
  'Nombre para mostrar, armado como tipo + detalle. Lo escribe la aplicacion, no la persona.';

create index on productos (tipo_id);

-- ============================================================================
-- 3. ALTA SIN DUPLICADOS
-- ============================================================================

-- Devuelve el tipo existente si ya hay uno equivalente, y si no lo crea.
-- Que sea idempotente es lo que permite ofrecer "+ Nuevo tipo" dentro del
-- mismo formulario sin miedo a ensuciar la lista.
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
  select id into v_id
    from tipos_prenda
   where coleccion = p_coleccion
     and f_normalizar(nombre) = f_normalizar(trim(p_nombre));

  if v_id is null then
    insert into tipos_prenda (coleccion, nombre)
    values (p_coleccion, trim(p_nombre))
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

create or replace function obtener_o_crear_color(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
    from colores_catalogo
   where f_normalizar(nombre) = f_normalizar(trim(p_nombre));

  if v_id is null then
    insert into colores_catalogo (nombre)
    values (trim(p_nombre))
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function obtener_o_crear_tipo, obtener_o_crear_color to authenticated;

-- Sugiere parecidos ANTES de crear: si escriben "Tops" y ya existe "Top", la
-- pantalla lo muestra y pregunta. Es la diferencia entre una lista curada y
-- una lista con basura.
create or replace function sugerir_tipos(p_coleccion text, p_nombre text)
returns table (id uuid, nombre text, parecido real)
language sql
stable
as $$
  select t.id, t.nombre, similarity(f_normalizar(t.nombre), f_normalizar(p_nombre))
    from tipos_prenda t
   where t.coleccion = p_coleccion
     and t.activo
     and f_normalizar(t.nombre) % f_normalizar(p_nombre)
   order by 3 desc
   limit 5;
$$;

grant execute on function sugerir_tipos to authenticated;

-- Los tipos y colores en uso no se borran: se desactivan. Borrarlos dejaria
-- productos huerfanos y el historial sin sentido.
create or replace function desactivar_tipo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update tipos_prenda set activo = false where id = p_id;
end;
$$;

grant execute on function desactivar_tipo to authenticated;

-- ============================================================================
-- 4. LISTA INICIAL
-- ============================================================================
-- Punto de partida para que no arranquen con la pantalla vacia. La lista real
-- la definen ellas: van a agregar y desactivar segun lo que vendan.

insert into tipos_prenda (coleccion, nombre, orden) values
  ('active', 'Top', 10), ('active', 'Legging', 20), ('active', 'Short', 30),
  ('active', 'Body', 40), ('active', 'Enterizo', 50), ('active', 'Conjunto', 60),
  ('active', 'Chaqueta', 70), ('active', 'Pantalón', 80), ('active', 'Franela', 90),
  ('swim', 'Bikini', 10), ('swim', 'Traje de baño', 20), ('swim', 'Salida de baño', 30),
  ('swim', 'Short de playa', 40), ('swim', 'Pareo', 50), ('swim', 'Enterizo', 60),
  ('swim', 'Sombrero', 70), ('swim', 'Bolso', 80)
on conflict do nothing;

insert into colores_catalogo (nombre, hex, orden) values
  ('Negro', '#1a1a1a', 10), ('Blanco', '#ffffff', 20), ('Gris', '#9ca3af', 30),
  ('Beige', '#e3d5c0', 40), ('Marrón', '#7c5a3c', 50), ('Rosado', '#f4a6b8', 60),
  ('Fucsia', '#d6336c', 70), ('Rojo', '#c0392b', 80), ('Burdeos', '#7b2233', 90),
  ('Naranja', '#e8873a', 100), ('Amarillo', '#f2d05a', 110), ('Verde', '#4a8c5c', 120),
  ('Verde oscuro', '#2f5d43', 130), ('Menta', '#a8d8c4', 140), ('Celeste', '#8ec5e6', 150),
  ('Azul', '#2f5f9e', 160), ('Morado', '#6b4a8c', 170), ('Lila', '#c3aede', 180),
  ('Multicolor', null, 999)
on conflict do nothing;

alter table tipos_prenda      enable row level security;
alter table colores_catalogo  enable row level security;
create policy acceso_tipos_prenda on tipos_prenda
  for all to authenticated using (true) with check (true);
create policy acceso_colores_catalogo on colores_catalogo
  for all to authenticated using (true) with check (true);

grant select, insert, update on tipos_prenda, colores_catalogo to authenticated;

commit;
