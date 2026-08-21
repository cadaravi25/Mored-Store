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

  const tarjetas = useMemo(() => agrupar(filas), [filas]);
  const acento = ACENTOS[coleccion];

  const deLaColeccion = useMemo(
    () => tarjetas.filter((t) => t.coleccion === coleccion),
    [tarjetas, coleccion],
  );

  function cambiar(c: Coleccion) {
    // El cambio se ve al instante, sin esperar al servidor: es una animación.
    setColeccion(c);

    // Y la dirección queda contando en qué colección estás, para que compartir
    // el enlace abra la misma.
    //
    // Va por el router de Next y no por history.replaceState, aunque este
    // último sea más barato. Con replaceState la barra de direcciones cambiaba
    // pero Next seguía creyendo que estaba en la anterior, y entonces pulsar
    // ACTIVE en el encabezado no navegaba a ninguna parte: para él ya estabas
    // ahí. El resultado era una tienda que decía Swim con la dirección en
    // active y sin forma de volver.
    router.replace(c === "active" ? "/" : `/?c=${c}`, { scroll: false });
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
