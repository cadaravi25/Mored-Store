"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import Carrito from "../carrito";
import { colorVisible } from "@/lib/prendas";
import { precioVisible } from "@/lib/moneda";
import { useMoneda } from "@/lib/usar-moneda";
import type { Coleccion } from "../hero";
import { ACENTOS } from "../portada";
import {
  agrupar,
  ORDEN_TALLAS,
  TarjetaProducto,
  type FilaCatalogo,
} from "../piezas";

const ORDENES = [
  { id: "nombre", nombre: "Nombre, A-Z" },
  { id: "barato", nombre: "Precio, menor primero" },
  { id: "caro", nombre: "Precio, mayor primero" },
] as const;

type Orden = (typeof ORDENES)[number]["id"];

/** Un grupo de filtros que se pliega. En el teléfono todos empiezan cerrados
 *  menos el primero: la lista completa abierta sería una pared. */
function Grupo({
  titulo,
  children,
  abiertoInicial = true,
}: {
  titulo: string;
  children: React.ReactNode;
  abiertoInicial?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  return (
    <div className="border-b border-linea py-5">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm">{titulo}</span>
        <span
          className="text-gris transition-transform duration-300"
          style={{ transform: abierto ? "rotate(180deg)" : undefined }}
          aria-hidden
        >
          ⌄
        </span>
      </button>
      {abierto && <div className="mt-4">{children}</div>}
    </div>
  );
}

function Casilla({
  marcada,
  onCambiar,
  children,
}: {
  marcada: boolean;
  onCambiar: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm text-gris hover:text-carbon">
      <input
        type="checkbox"
        checked={marcada}
        onChange={onCambiar}
        className="h-4 w-4 accent-[var(--acento)]"
      />
      {children}
    </label>
  );
}

export default function Vista({
  filas,
  whatsapp,
  coleccionInicial,
}: {
  filas: FilaCatalogo[];
  whatsapp: string | null;
  coleccionInicial: Coleccion;
}) {
  /**
   * Los filtros viven en la dirección, no solo aquí dentro.
   *
   * Antes vivían en el estado y nada más. Quien filtraba por enterizos, abría
   * una prenda y volvía, se encontraba el catálogo entero otra vez y tenía que
   * filtrar de nuevo: al volver, el componente se monta desde cero y el estado
   * no existía. En la dirección sí sobrevive, y de paso el enlace filtrado se
   * puede pasar por WhatsApp.
   */
  const parametros = useSearchParams();
  const lista = (clave: string) => {
    const v = parametros.get(clave);
    return v ? v.split(",").filter(Boolean) : [];
  };

  const [coleccion, setColeccion] = useState<Coleccion>(coleccionInicial);
  const [tipos, setTipos] = useState<string[]>(() => lista("tipo"));
  const [tallas, setTallas] = useState<string[]>(() => lista("talla"));
  const [colores, setColores] = useState<string[]>(() => lista("color"));
  const [soloDisponible, setSoloDisponible] = useState(
    () => parametros.get("hay") === "1",
  );
  const [orden, setOrden] = useState<Orden>(
    () => (parametros.get("orden") as Orden) || "nombre",
  );
  const [columnas, setColumnas] = useState(
    () => Number(parametros.get("cols")) || 3,
  );
  const [panel, setPanel] = useState(false);
  const { moneda, tasa } = useMoneda();

  /**
   * Escribe los filtros en la dirección sin volver al servidor.
   *
   * Con `router.replace` cada toque de un filtro sería un viaje, y filtrar
   * tiene que verse al instante. `replaceState` es la forma que Next da para
   * esto: cambia la dirección, el encabezado se entera porque lee los mismos
   * parámetros, y no se vuelve a pedir nada.
   *
   * Reemplaza en vez de apilar a propósito: si cada filtro dejara su huella,
   * salir del catálogo con el botón atrás serían quince toques.
   */
  function anotar(cambios: Record<string, string | null>) {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(cambios)) {
      if (!v) p.delete(k);
      else p.set(k, v);
    }
    const q = p.toString();
    window.history.replaceState(
      null,
      "",
      q ? `${window.location.pathname}?${q}` : window.location.pathname,
    );
  }

  const ponerTipos = (v: string[]) => {
    setTipos(v);
    anotar({ tipo: v.join(",") });
  };
  const ponerTallas = (v: string[]) => {
    setTallas(v);
    anotar({ talla: v.join(",") });
  };
  const ponerColores = (v: string[]) => {
    setColores(v);
    anotar({ color: v.join(",") });
  };
  const ponerDisponible = (v: boolean) => {
    setSoloDisponible(v);
    anotar({ hay: v ? "1" : null });
  };
  const ponerOrden = (v: Orden) => {
    setOrden(v);
    anotar({ orden: v === "nombre" ? null : v });
  };
  const ponerColumnas = (n: number) => {
    setColumnas(n);
    anotar({ cols: n === 3 ? null : String(n) });
  };

  /**
   * La colección se cambia desde dos sitios y hay que atender los dos.
   *
   * Aquí mismo se ve al instante, sin ir al servidor: es una animación y no
   * puede esperar a nadie. Pero desde el encabezado se cambia navegando, y esa
   * navegación llega como una propiedad nueva. Sin conciliarlas, la dirección
   * decía swim y la página seguía entera en active.
   *
   * Se concilia durante el render y no en un efecto: así React lo resuelve en
   * la misma pasada, sin pintar una vez con la colección vieja. Un efecto
   * pintaría primero lo anterior y lo corregiría después, que es justo el
   * parpadeo que se quiere evitar.
   */
  const [ultimaDireccion, setUltimaDireccion] = useState(coleccionInicial);
  if (coleccionInicial !== ultimaDireccion) {
    setUltimaDireccion(coleccionInicial);
    setColeccion(coleccionInicial);
  }

  /**
   * Se cambia de colección desde dos sitios, el encabezado y el filtro
   * lateral, y los dos tienen que dejar la dirección contando lo mismo. Si el
   * filtro cambiara solo el estado, el encabezado seguiría marcando la otra
   * colección y compartir el enlace abriría la que no es.
   */
  function cambiarColeccion(c: Coleccion) {
    setColeccion(c);
    anotar({ c: c === "active" ? null : c });
  }

  const acento = ACENTOS[coleccion];
  const todas = useMemo(() => agrupar(filas), [filas]);

  const deLaColeccion = useMemo(
    () => todas.filter((t) => t.coleccion === coleccion),
    [todas, coleccion],
  );

  // Las opciones salen de lo que hay en esta colección, no de una lista fija:
  // ofrecer un filtro que no devuelve nada es peor que no ofrecerlo.
  const opciones = useMemo(() => {
    const tipos = new Set<string>();
    const colores = new Map<string, string | null>();
    const tallas = new Set<string>();
    for (const t of deLaColeccion) {
      if (t.tipo) tipos.add(t.tipo);
      for (const c of t.colores) {
        // Las prendas cuyo color todavía no se sabe no abren una muestra: sería
        // un filtro llamado "Por definir", que no significa nada para quien compra.
        if (colorVisible(c.color) && !colores.has(c.color)) {
          colores.set(c.color, c.hex);
        }
        for (const x of c.tallas) tallas.add(x.talla);
      }
    }
    return {
      tipos: [...tipos].sort(),
      colores: [...colores.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      tallas: ORDEN_TALLAS.filter((x) => tallas.has(x)),
    };
  }, [deLaColeccion]);

  // El precio que se está mirando manda en el orden y en el rango: en
  // bolívares la más barata no tiene por qué ser la misma que en euros.
  const enBs = moneda === "bs" && tasa;

  const visibles = useMemo(() => {
    // Los filtros de color y talla se miran color por color, no sobre la
    // prenda entera: un bikini que existe en verde S y en naranja M no
    // cumple "verde y talla M" aunque tenga las dos cosas por separado.
    const lista = deLaColeccion.filter((t) => {
      if (tipos.length && (!t.tipo || !tipos.includes(t.tipo))) return false;

      return t.colores.some((c) => {
        if (colores.length && !colores.includes(c.color)) return false;
        if (tallas.length) {
          const tiene = c.tallas.some(
            (x) => tallas.includes(x.talla) && x.disponible > 0,
          );
          if (!tiene) return false;
        }
        if (soloDisponible && !c.tallas.some((x) => x.disponible > 0)) {
          return false;
        }
        return true;
      });
    });

    return lista.sort((a, b) =>
      orden === "barato"
        ? (enBs ? a.precioBs - b.precioBs : a.precio - b.precio)
        : orden === "caro"
          ? (enBs ? b.precioBs - a.precioBs : b.precio - a.precio)
          : a.producto.localeCompare(b.producto),
    );
  }, [deLaColeccion, tipos, colores, tallas, soloDisponible, orden, enBs]);

  const precios = deLaColeccion.map((t) => (enBs ? t.precioBs : t.precio));
  const desde = precios.length ? Math.min(...precios) : 0;
  const hasta = precios.length ? Math.max(...precios) : 0;

  function alternar(
    lista: string[],
    poner: (v: string[]) => void,
    valor: string,
  ) {
    poner(
      lista.includes(valor)
        ? lista.filter((x) => x !== valor)
        : [...lista, valor],
    );
  }

  const filtrando =
    tipos.length + tallas.length + colores.length > 0 || soloDisponible;

  function limpiar() {
    setTipos([]);
    setTallas([]);
    setColores([]);
    setSoloDisponible(false);
    anotar({ tipo: null, talla: null, color: null, hay: null });
  }


  const filtros = (
    <>
      <Grupo titulo="Colección">
        <div className="flex gap-2">
          {(["active", "swim"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => cambiarColeccion(c)}
              className={`rounded-full border px-4 py-1.5 text-[13px] transition-colors ${
                coleccion === c
                  ? "border-carbon bg-carbon text-nieve"
                  : "border-linea text-gris hover:border-carbon"
              }`}
            >
              {c === "active" ? "Active" : "Swim"}
            </button>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Disponibilidad">
        <Casilla
          marcada={soloDisponible}
          onCambiar={() => ponerDisponible(!soloDisponible)}
        >
          Solo lo que hay ahora
        </Casilla>
      </Grupo>

      {opciones.tallas.length > 0 && (
        <Grupo titulo="Talla">
          <div className="flex flex-wrap gap-2">
            {opciones.tallas.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => alternar(tallas, ponerTallas, t)}
                className={`min-w-11 rounded-lg border px-3 py-2 text-[13px] transition-colors ${
                  tallas.includes(t)
                    ? "border-carbon bg-carbon text-nieve"
                    : "border-linea text-gris hover:border-carbon"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Grupo>
      )}

      {opciones.colores.length > 0 && (
        <Grupo titulo="Color">
          {/* Muestras redondas y no casillas: el color se reconoce viéndolo,
              y leer "burdeos" obliga a imaginárselo. El nombre queda como
              etiqueta accesible y como ayuda al pasar por encima. */}
          <div className="flex flex-wrap gap-2.5">
            {opciones.colores.map(([nombre, hex]) => {
              const puesto = colores.includes(nombre);
              return (
                <button
                  key={nombre}
                  type="button"
                  onClick={() => alternar(colores, ponerColores, nombre)}
                  title={nombre}
                  aria-label={nombre}
                  aria-pressed={puesto}
                  className={`h-7 w-7 rounded-full border transition-all ${
                    puesto
                      ? "border-carbon ring-2 ring-carbon ring-offset-2 ring-offset-nieve"
                      : "border-linea hover:border-gris"
                  }`}
                  style={{
                    // "Multicolor" no tiene un tono que lo represente, y
                    // pintarlo de uno solo sería mentir. La rueda entera se
                    // reconoce al instante y es lo que la prenda es.
                    //
                    // Sin hex conocido, un rayado tenue: mejor que un blanco
                    // que se confunde con el color "blanco" de verdad.
                    background:
                      nombre.toLowerCase() === "multicolor"
                        ? "conic-gradient(#e0827a, #f2d05a, #4a8c5c, #8ec5e6, #6b4a8c, #d6336c, #e0827a)"
                        : (hex ??
                          "repeating-linear-gradient(45deg, #eee, #eee 4px, #ddd 4px, #ddd 8px)"),
                  }}
                />
              );
            })}
          </div>
        </Grupo>
      )}

      {opciones.tipos.length > 0 && (
        <Grupo titulo="Tipo de prenda">
          <div className="space-y-0.5">
            {opciones.tipos.map((t) => (
              <Casilla
                key={t}
                marcada={tipos.includes(t)}
                onCambiar={() => alternar(tipos, ponerTipos, t)}
              >
                {t}
              </Casilla>
            ))}
          </div>
        </Grupo>
      )}

      {hasta > 0 && (
        <Grupo titulo="Precio" abiertoInicial={false}>
          <p className="text-sm text-gris">
            De {precioVisible(desde, desde, moneda, tasa)} a{" "}
            {precioVisible(hasta, hasta, moneda, tasa)}
          </p>
        </Grupo>
      )}
    </>
  );

  return (
    <main style={acento as React.CSSProperties}>
      <div className="mx-auto w-full max-w-[1400px] px-5 pb-8 pt-10 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gris">
          <Link
            href={coleccion === "swim" ? "/?c=swim" : "/"}
            className="hover:text-carbon"
          >
            Inicio
          </Link>
          <span className="px-2">/</span>
          Catálogo
        </p>
        <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-5xl">
          Mored {coleccion === "swim" ? "Swim" : "Active"}
        </h1>
      </div>

      <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-5 pb-20 lg:grid-cols-[240px_1fr] lg:px-10">
        {/* Barra lateral en pantalla ancha; en el teléfono, un panel que se
            abre desde arriba. */}
        <aside className="hidden lg:block">
          <p className="text-sm text-carbon">Filtrar</p>
          {filtros}
          {filtrando && (
            <button
              type="button"
              onClick={limpiar}
              className="mt-5 text-[13px] text-[var(--acento-hondo)] underline-offset-4 hover:underline"
            >
              Quitar los filtros
            </button>
          )}
        </aside>

        <div>
          {/* Una sola fila, también en el teléfono. Antes `flex-wrap` mandaba
              "Filtrar" a un renglón suyo y el de abajo quedaba desalineado. */}
          <div className="mb-6 flex items-center justify-between gap-3 border-b border-linea pb-4 sm:gap-4">
            <button
              type="button"
              onClick={() => setPanel(true)}
              className="shrink-0 whitespace-nowrap rounded-full border border-linea px-4 py-2 text-[13px] sm:px-5 lg:hidden"
            >
              Filtrar{filtrando ? " ·" : ""}
            </button>

            {/* Cuántas columnas. En una tienda de ropa esto se usa de verdad:
                pocas para mirar bien, muchas para comparar. */}
            <div className="hidden gap-1.5 sm:flex">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => ponerColumnas(n)}
                  aria-label={`${n} columnas`}
                  className={`flex h-8 w-8 items-center justify-center gap-[2px] rounded border ${
                    columnas === n ? "border-carbon" : "border-linea"
                  }`}
                >
                  {Array.from({ length: n }, (_, i) => (
                    <span
                      key={i}
                      className={`h-3.5 w-[2px] ${
                        columnas === n ? "bg-carbon" : "bg-gris"
                      }`}
                    />
                  ))}
                </button>
              ))}
            </div>

            <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4">
              <label className="flex min-w-0 items-center gap-2 text-[13px] text-gris">
                {/* La palabra sobra en el teléfono: el propio desplegable dice
                    por qué está ordenando. */}
                <span className="hidden sm:inline">Ordenar</span>
                <select
                  value={orden}
                  onChange={(e) => ponerOrden(e.target.value as Orden)}
                  className="min-w-0 rounded-lg border border-linea bg-nieve px-2 py-1.5 text-carbon outline-none sm:px-3"
                >
                  {ORDENES.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <p className="whitespace-nowrap text-[13px] text-gris">
                {visibles.length} {visibles.length === 1 ? "pieza" : "piezas"}
              </p>
            </div>
          </div>

          {visibles.length === 0 ? (
            <div className="py-28 text-center">
              <p className="text-gris">
                {deLaColeccion.length === 0
                  ? `Mored ${coleccion === "swim" ? "Swim" : "Active"} abre pronto.`
                  : "Nada con esos filtros."}
              </p>
              {filtrando && (
                <button
                  type="button"
                  onClick={limpiar}
                  className="mt-4 text-sm text-[var(--acento-hondo)] underline-offset-4 hover:underline"
                >
                  Quitar los filtros
                </button>
              )}
            </div>
          ) : (
            <div
              className={`grid grid-cols-2 gap-x-3 gap-y-9 ${
                columnas === 2
                  ? "sm:grid-cols-2"
                  : columnas === 3
                    ? "sm:grid-cols-3"
                    : "sm:grid-cols-4"
              }`}
            >
              {visibles.map((t, i) => (
                <TarjetaProducto
                  key={t.clave}
                  t={t}
                  orden={i}
                  soloColores={colores}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {panel && (
        <div
          className="fixed inset-0 z-40 flex bg-carbon/30 lg:hidden"
          onClick={() => setPanel(false)}
        >
          <div
            className="h-full w-[86%] max-w-sm overflow-y-auto bg-nieve px-6 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between bg-nieve py-5">
              <p className="text-sm">Filtrar</p>
              <button
                type="button"
                onClick={() => setPanel(false)}
                aria-label="Cerrar"
                className="text-gris"
              >
                ✕
              </button>
            </div>
            {filtros}
            <div className="mt-6 flex gap-2">
              {filtrando && (
                <button
                  type="button"
                  onClick={limpiar}
                  className="flex-1 rounded-full border border-linea py-3 text-[13px]"
                >
                  Quitar
                </button>
              )}
              <button
                type="button"
                onClick={() => setPanel(false)}
                className="flex-1 rounded-full bg-carbon py-3 text-[13px] text-nieve"
              >
                Ver {visibles.length}
              </button>
            </div>
          </div>
        </div>
      )}

      <Carrito whatsapp={whatsapp} />
    </main>
  );
}
