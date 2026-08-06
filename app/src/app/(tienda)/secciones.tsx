"use client";

import Link from "next/link";
import { useState } from "react";
import type { Coleccion } from "./hero";
import {
  TarjetaProducto,
  Titulo,
  useRevelar,
  type Tarjeta,
} from "./piezas";

/**
 * Las secciones de la portada, en el orden en que se recorren.
 *
 * Ninguna usa fotos de campaña: todas salen del inventario o del hero. Es lo
 * único honesto mientras no haya sesión de fotos, y de paso no hay imágenes
 * sueltas que mantener al día aparte del catálogo.
 */

function Boton({
  href,
  onClick,
  children,
  oscuro,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  oscuro?: boolean;
}) {
  const clases = `inline-block rounded-full px-8 py-3 text-[12px] uppercase tracking-[0.2em] transition-colors ${
    oscuro
      ? "bg-carbon text-nieve hover:bg-carbon/85"
      : "bg-nieve text-carbon hover:bg-nieve/85"
  }`;
  if (href) {
    return (
      <Link href={href} className={clases}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={clases}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------

/**
 * Todo lo que cambia entre Active y Swim.
 *
 * No solo el hero: los accesos, la franja, el look de inspiración y la tira de
 * Instagram. Tocar el botón cambia de tienda, no de fondo.
 *
 * Swim va con poco material a propósito: es lo único suyo que existe hoy. En
 * cuanto haya sesión de fotos se cambian estas rutas y ya, sin tocar nada más.
 */
const CONTENIDO = {
  active: {
    perfil: "https://instagram.com/mored.active",
    usuario: "@mored.active",
    accesos: [
      { titulo: "Tops", tipo: "Top", foto: "/fotos/moreda_11.webp" },
      { titulo: "Leggins", tipo: "Leggin", foto: "/fotos/m0406-02.webp" },
      { titulo: "Enterizos", tipo: "Enterizo", foto: "/fotos/moreda_17.webp" },
    ],
    franja: {
      video: "/fotos/franja.mp4",
      poster: "/fotos/franja-poster.webp",
    },
    look: "/fotos/m0406-04.webp",
    instagram: [
      "/fotos/moreda_06.webp",
      "/fotos/moreda_12.webp",
      "/fotos/moreda_16.webp",
      "/fotos/moreda_21.webp",
      "/fotos/m0406-03.webp",
      "/fotos/moreda_03.webp",
    ],
  },
  swim: {
    perfil: "https://instagram.com/moredswim",
    usuario: "@moredswim",
    accesos: [
      { titulo: "Trajes de baño", tipo: "Traje de baño", foto: "/fotos/swim-1.webp" },
      { titulo: "Salidas de playa", tipo: "Salida de baño", foto: "/fotos/swim-2.webp" },
      { titulo: "Accesorios", tipo: "Accesorios", foto: "/fotos/swim-3.webp" },
    ],
    franja: { video: null, poster: "/hero/swim-fondo.webp" },
    look: "/fotos/swim-look.webp",
    instagram: [
      "/fotos/swim-1.webp",
      "/fotos/swim-2.webp",
      "/fotos/swim-3.webp",
      "/fotos/swim-look.webp",
      "/hero/swim-fondo.webp",
      "/fotos/swim-1.webp",
    ],
  },
} as const;

export function Estilos({
  coleccion,
  onElegir,
}: {
  coleccion: Coleccion;
  onElegir: (tipo: string) => void;
}) {
  const ref = useRevelar<HTMLElement>();

  return (
    <section
      ref={ref}
      className="parada revela mx-auto w-full max-w-[1400px] px-5 pt-20 lg:px-10"
    >
      <Titulo
        antetitulo={`Mored ${coleccion === "swim" ? "Swim" : "Active"}`}
        titulo="Por prenda"
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {CONTENIDO[coleccion].accesos.map((a) => (
          <button
            key={a.tipo}
            type="button"
            onClick={() => onElegir(a.tipo)}
            className="group relative block aspect-[4/5] overflow-hidden text-left sm:aspect-[4/3]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.foto}
              alt={a.titulo}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-105"
              style={{ transitionTimingFunction: "var(--curva)" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-carbon/65 via-carbon/5 to-transparent" />
            <p className="absolute bottom-5 left-5 text-xl font-light uppercase tracking-[0.14em] text-nieve sm:text-2xl">
              {a.titulo}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

/**
 * Lo último que entró, sobre fondo oscuro.
 *
 * Se ordena por cuándo entró la prenda al inventario, no a mano: así la
 * sección se mantiene sola y nunca muestra como novedad algo de hace meses.
 *
 * El fondo negro le da un respiro a la página: después de mucho blanco, el ojo
 * agradece el corte.
 */
export function Destacados({
  tarjetas,
  coleccion,
}: {
  tarjetas: Tarjeta[];
  coleccion: Coleccion;
}) {
  const ref = useRevelar<HTMLElement>();
  const conStock = tarjetas
    .filter((t) => t.tallas.some((x) => x.disponible > 0))
    .sort((a, b) => b.entro_at.localeCompare(a.entro_at));
  if (conStock.length === 0) return null;

  return (
    <section ref={ref} className="parada revela mt-24 bg-carbon py-20">
      <div className="mx-auto w-full max-w-[1400px] px-5 lg:px-10">
        <Titulo
          claro
          antetitulo={`Mored ${coleccion === "swim" ? "Swim" : "Active"}`}
          titulo="Lo nuevo"
          bajada="Lo último que llegó, y todo está disponible ahora mismo."
        />
      </div>

      {/* Se desliza de lado en vez de envolverse: mantiene la sección corta y
          en el teléfono es el gesto natural. */}
      <div className="mt-9 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 lg:px-10">
        {conStock.slice(0, 12).map((t, i) => (
          <div
            key={t.clave}
            className="w-[62vw] shrink-0 snap-start sm:w-[38vw] lg:w-[22vw] xl:w-[19vw]"
          >
            <TarjetaProducto t={t} orden={i} claro />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Un look completo a la izquierda y las prendas sueltas a la derecha.
 *
 * La foto del look es la misma de la portada: es la única de campaña que
 * existe, y ahí cumple otra función. Nada de la tienda ni de la dirección: eso
 * ya está en el pie y aquí solo distraía de la ropa.
 */
export function Inspiracion({
  tarjetas,
  coleccion,
}: {
  tarjetas: Tarjeta[];
  coleccion: Coleccion;
}) {
  const ref = useRevelar<HTMLElement>();
  const sueltas = tarjetas
    .filter((t) => t.tallas.some((x) => x.disponible > 0))
    .slice(0, 4);

  if (sueltas.length === 0) return null;

  return (
    <section
      ref={ref}
      className="parada revela mx-auto w-full max-w-[1400px] px-5 pt-24 lg:px-10"
    >
      <Titulo antetitulo="Inspiración" titulo="Cómo se ve puesto" />

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative overflow-hidden bg-[var(--acento-tenue)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={CONTENIDO[coleccion].look}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-7 self-start">
          {sueltas.map((t, i) => (
            <TarjetaProducto key={t.clave} t={t} orden={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * La franja de Instagram, pegada al pie y de borde a borde.
 *
 * Su Instagram es donde la clientela ya los sigue: la tienda es nueva, la
 * cuenta tiene veinte mil personas. Enseñar el feed acá es prestarle a la
 * tienda la confianza que la cuenta ya tiene.
 *
 * Cada foto puede llevar el enlace a su propia publicación; mientras no lo
 * tenga, lleva al perfil.
 */
export function Instagram({ coleccion }: { coleccion: Coleccion }) {
  const ref = useRevelar<HTMLElement>();
  // Fotos de su propia sesión. No son las publicaciones reales: Instagram no
  // deja leer el perfil sin sesión, así que el feed de verdad tendría que
  // entrar por otra vía. Mientras tanto, esto es de ellas y es lo que venden.
  const { perfil, instagram: seis } = CONTENIDO[coleccion];

  return (
    <section ref={ref} className="parada revela mt-24">
      <div className="mx-auto w-full max-w-[1400px] px-5 pb-7 lg:px-10">
        <Titulo
          antetitulo="Instagram"
          titulo={CONTENIDO[coleccion].usuario}
        />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6">
        {seis.map((foto, i) => (
          <a
            key={i}
            href={perfil}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-square overflow-hidden bg-humo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-105"
              style={{ transitionTimingFunction: "var(--curva)" }}
            />
            <span className="absolute inset-0 grid place-items-center bg-carbon/0 text-nieve opacity-0 transition-all duration-500 group-hover:bg-carbon/35 group-hover:opacity-100">
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.4}
              >
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * La franja que lleva al catálogo completo.
 *
 * Acepta video de fondo sin necesidad de tocar código: si existe el archivo
 * /fotos/franja.mp4 se reproduce encima de la foto; si no, queda la foto. Así
 * el día que tengan un clip se suelta el archivo y ya.
 */
export function FranjaCatalogo({ coleccion }: { coleccion: Coleccion }) {
  const ref = useRevelar<HTMLElement>();
  const [conVideo, setConVideo] = useState(false);
  const franja = CONTENIDO[coleccion].franja;

  return (
    <section
      ref={ref}
      className="parada revela relative mt-24 h-[62vh] min-h-[420px] overflow-hidden bg-carbon"
    >
      {/* El primer cuadro del propio video, para que no haya un salto de
          color mientras carga. Swim todavía no tiene video: se queda la foto. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={franja.poster}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />

      {franja.video && (
        <video
          key={franja.video}
          src={franja.video}
          poster={franja.poster}
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={() => setConVideo(true)}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
          style={{ opacity: conVideo ? 1 : 0 }}
        />
      )}

      <div className="absolute inset-0 bg-carbon/45" />

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-nieve/80">
          Todo Mored {coleccion === "swim" ? "Swim" : "Active"}
        </p>
        <p className="mt-4 max-w-2xl text-4xl font-light leading-tight text-nieve sm:text-5xl">
          Mira el catálogo completo
        </p>
        <p className="mt-4 max-w-md text-sm text-nieve/80">
          Filtra por talla, color y tipo de prenda, y ve solo lo que hay
          disponible.
        </p>
        <Link
          href={`/catalogo${coleccion === "swim" ? "?c=swim" : ""}`}
          className="mt-8 rounded-full bg-nieve px-10 py-3.5 text-[12px] uppercase tracking-[0.24em] text-carbon transition-opacity hover:opacity-90"
        >
          Ver todo el catálogo
        </Link>
      </div>
    </section>
  );
}
