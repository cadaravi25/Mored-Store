"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Carrito from "./carrito";
import Hero, { type Coleccion } from "./hero";
import {
  agrupar,
  ORDEN_TALLAS,
  TarjetaProducto,
  Titulo,
  type FilaCatalogo,
} from "./piezas";
import {
  Banners,
  Categorias,
  Destacados,
  Inspiracion,
  Instagram,
} from "./secciones";

export type { FilaCatalogo };

export const ACENTOS = {
  active: {
    "--acento": "var(--color-marron)",
    "--acento-hondo": "var(--color-marron-hondo)",
    "--acento-tenue": "var(--color-marron-tenue)",
  },
  swim: {
    "--acento": "var(--color-rosa)",
    "--acento-hondo": "var(--color-rosa-hondo)",
    "--acento-tenue": "var(--color-rosa-tenue)",
  },
} as const;

function Pildora({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-2 text-[13px] transition-colors ${
        activo
          ? "border-carbon bg-carbon text-nieve"
          : "border-linea text-gris hover:border-carbon hover:text-carbon"
      }`}
    >
      {children}
    </button>
  );
}

export default function Portada({
  filas,
  whatsapp,
  coleccionInicial,
}: {
  filas: FilaCatalogo[];
  whatsapp: string | null;
  coleccionInicial: Coleccion;
}) {
  const [coleccion, setColeccion] = useState<Coleccion>(coleccionInicial);
  const [tipo, setTipo] = useState("");
  const [talla, setTalla] = useState("");
  const catalogo = useRef<HTMLElement>(null);

  // Al cambiar de colección se limpian los filtros: los tipos de una no son
  // los de la otra, y quedarse con "Traje de baño" al pasar a Active dejaría
  // la pantalla vacía sin motivo aparente.
  useEffect(() => {
    setTipo("");
    setTalla("");
  }, [coleccion]);

  const tarjetas = useMemo(() => agrupar(filas), [filas]);
  const acento = ACENTOS[coleccion];

  const deLaColeccion = useMemo(
    () => tarjetas.filter((t) => t.coleccion === coleccion),
    [tarjetas, coleccion],
  );

  const tipos = useMemo(
    () =>
      [
        ...new Set(
          deLaColeccion.map((t) => t.tipo).filter((t): t is string => Boolean(t)),
        ),
      ].sort(),
    [deLaColeccion],
  );

  const visibles = useMemo(
    () =>
      deLaColeccion.filter(
        (t) =>
          (!tipo || t.tipo === tipo) &&
          (!talla || t.tallas.some((x) => x.talla === talla && x.disponible > 0)),
      ),
    [deLaColeccion, tipo, talla],
  );

  function cambiar(c: Coleccion) {
    setColeccion(c);
    // La dirección queda contando en qué colección estás: si comparten el
    // enlace, se abre en la misma.
    window.history.replaceState(null, "", c === "active" ? "/" : `/?c=${c}`);
  }

  function irAlCatalogo(t: string) {
    setTipo(t);
    catalogo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main style={acento as React.CSSProperties}>
      <Hero coleccion={coleccion} onCambiar={cambiar} />

      <Banners />

      <Categorias
        tarjetas={deLaColeccion}
        coleccion={coleccion}
        onElegir={irAlCatalogo}
      />

      <section
        id="catalogo"
        ref={catalogo}
        className="mx-auto w-full max-w-[1400px] scroll-mt-24 px-5 pt-20 lg:px-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-linea pb-5">
          <Titulo
            antetitulo="Todo el catálogo"
            titulo={`Mored ${coleccion === "swim" ? "Swim" : "Active"}`}
          />
          <p className="text-sm text-gris">
            {visibles.length} {visibles.length === 1 ? "pieza" : "piezas"}
          </p>
        </div>

        <div className="space-y-3 py-6">
          {tipos.length > 1 && (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0">
              <Pildora activo={tipo === ""} onClick={() => setTipo("")}>
                Todas
              </Pildora>
              {tipos.map((t) => (
                <Pildora key={t} activo={tipo === t} onClick={() => setTipo(t)}>
                  {t}
                </Pildora>
              ))}
            </div>
          )}

          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0">
            <Pildora activo={talla === ""} onClick={() => setTalla("")}>
              Mi talla
            </Pildora>
            {ORDEN_TALLAS.map((t) => (
              <Pildora key={t} activo={talla === t} onClick={() => setTalla(t)}>
                {t}
              </Pildora>
            ))}
          </div>
        </div>

        {visibles.length === 0 ? (
          <p className="py-24 text-center text-gris">
            {deLaColeccion.length === 0
              ? `Mored ${coleccion === "swim" ? "Swim" : "Active"} abre pronto.`
              : "Nada con esos filtros. Prueba con otra talla."}
          </p>
        ) : (
          <div
            key={coleccion}
            className="grid grid-cols-2 gap-x-3 gap-y-9 pb-4 sm:grid-cols-3 lg:grid-cols-4"
          >
            {visibles.map((t, i) => (
              <TarjetaProducto key={t.clave} t={t} orden={i} />
            ))}
          </div>
        )}
      </section>

      <Destacados tarjetas={deLaColeccion} coleccion={coleccion} />

      <Inspiracion tarjetas={deLaColeccion} />

      <Instagram coleccion={coleccion} />

      <Carrito whatsapp={whatsapp} />
    </main>
  );
}
