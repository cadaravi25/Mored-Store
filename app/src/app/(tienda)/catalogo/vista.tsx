"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Carrito from "../carrito";
import type { Coleccion } from "../hero";
import { ACENTOS } from "../portada";
import {
  agrupar,
  dinero,
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
  tipoInicial,
}: {
  filas: FilaCatalogo[];
  whatsapp: string | null;
  coleccionInicial: Coleccion;
  tipoInicial: string;
}) {
  const [coleccion, setColeccion] = useState<Coleccion>(coleccionInicial);
  const [tipos, setTipos] = useState<string[]>(
    tipoInicial ? [tipoInicial] : [],
  );
  const [tallas, setTallas] = useState<string[]>([]);
  const [colores, setColores] = useState<string[]>([]);
  const [soloDisponible, setSoloDisponible] = useState(false);
  const [orden, setOrden] = useState<Orden>("nombre");
  const [columnas, setColumnas] = useState(3);
  const [panel, setPanel] = useState(false);

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
    const colores = new Set<string>();
    const tallas = new Set<string>();
    for (const t of deLaColeccion) {
      if (t.tipo) tipos.add(t.tipo);
      colores.add(t.color);
      for (const x of t.tallas) tallas.add(x.talla);
    }
    return {
      tipos: [...tipos].sort(),
      colores: [...colores].sort(),
      tallas: ORDEN_TALLAS.filter((x) => tallas.has(x)),
    };
  }, [deLaColeccion]);

  const visibles = useMemo(() => {
    const lista = deLaColeccion.filter((t) => {
      if (tipos.length && (!t.tipo || !tipos.includes(t.tipo))) return false;
      if (colores.length && !colores.includes(t.color)) return false;
      if (tallas.length) {
        const tiene = t.tallas.some(
          (x) => tallas.includes(x.talla) && x.disponible > 0,
        );
        if (!tiene) return false;
      }
      if (soloDisponible && !t.tallas.some((x) => x.disponible > 0)) return false;
      return true;
    });

    return lista.sort((a, b) =>
      orden === "barato"
        ? a.precio - b.precio
        : orden === "caro"
          ? b.precio - a.precio
          : a.producto.localeCompare(b.producto),
    );
  }, [deLaColeccion, tipos, colores, tallas, soloDisponible, orden]);

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
  }

  const precios = deLaColeccion.map((t) => t.precio);
  const desde = precios.length ? Math.min(...precios) : 0;
  const hasta = precios.length ? Math.max(...precios) : 0;

  const filtros = (
    <>
      <Grupo titulo="Colección">
        <div className="flex gap-2">
          {(["active", "swim"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColeccion(c)}
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
          onCambiar={() => setSoloDisponible(!soloDisponible)}
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
                onClick={() => alternar(tallas, setTallas, t)}
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
          <div className="space-y-0.5">
            {opciones.colores.map((c) => (
              <Casilla
                key={c}
                marcada={colores.includes(c)}
                onCambiar={() => alternar(colores, setColores, c)}
              >
                <span className="capitalize">{c}</span>
              </Casilla>
            ))}
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
                onCambiar={() => alternar(tipos, setTipos, t)}
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
            De {dinero.format(desde)} a {dinero.format(hasta)}
          </p>
        </Grupo>
      )}
    </>
  );

  return (
    <main style={acento as React.CSSProperties}>
      <div className="mx-auto w-full max-w-[1400px] px-5 pb-8 pt-10 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gris">
          <Link href="/" className="hover:text-carbon">
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
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-linea pb-4">
            <button
              type="button"
              onClick={() => setPanel(true)}
              className="rounded-full border border-linea px-5 py-2 text-[13px] lg:hidden"
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
                  onClick={() => setColumnas(n)}
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

            <div className="ml-auto flex items-center gap-4">
              <label className="flex items-center gap-2 text-[13px] text-gris">
                Ordenar
                <select
                  value={orden}
                  onChange={(e) => setOrden(e.target.value as Orden)}
                  className="rounded-lg border border-linea bg-nieve px-3 py-1.5 text-carbon outline-none"
                >
                  {ORDENES.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[13px] text-gris">
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
                <TarjetaProducto key={t.clave} t={t} orden={i} />
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
