"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Carrito from "./carrito";
import Hero, { type Coleccion } from "./hero";
import { agrupar, type FilaCatalogo } from "./piezas";
import {
  Destacados,
  Estilos,
  FranjaCatalogo,
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

export default function Portada({
  filas,
  whatsapp,
  coleccionInicial,
}: {
  filas: FilaCatalogo[];
  whatsapp: string | null;
  coleccionInicial: Coleccion;
}) {
  const router = useRouter();
  const [coleccion, setColeccion] = useState<Coleccion>(coleccionInicial);

  const tarjetas = useMemo(() => agrupar(filas), [filas]);
  const acento = ACENTOS[coleccion];

  const deLaColeccion = useMemo(
    () => tarjetas.filter((t) => t.coleccion === coleccion),
    [tarjetas, coleccion],
  );

  function cambiar(c: Coleccion) {
    setColeccion(c);
    // La dirección queda contando en qué colección estás: si comparten el
    // enlace, se abre en la misma.
    window.history.replaceState(null, "", c === "active" ? "/" : `/?c=${c}`);
  }

  // Los accesos y las categorías llevan al catálogo completo con el filtro ya
  // puesto: la portada muestra, el catálogo deja buscar.
  function irAlCatalogo(t: string) {
    const p = new URLSearchParams();
    if (coleccion === "swim") p.set("c", "swim");
    if (t) p.set("tipo", t);
    router.push(`/catalogo${p.size ? `?${p}` : ""}`);
  }

  return (
    <main style={acento as React.CSSProperties}>
      <Hero coleccion={coleccion} onCambiar={cambiar} />

      <Estilos coleccion={coleccion} onElegir={irAlCatalogo} />

      <FranjaCatalogo coleccion={coleccion} />

      <Destacados tarjetas={deLaColeccion} coleccion={coleccion} />

      <Inspiracion tarjetas={deLaColeccion} coleccion={coleccion} />

      <Instagram coleccion={coleccion} />

      <Carrito whatsapp={whatsapp} />
    </main>
  );
}
