"use client";

import Link from "next/link";
import { useState } from "react";
import type { Coleccion } from "./hero";
import {
  Hueco,
  TarjetaProducto,
  Titulo,
  useRevelar,
  type Tarjeta,
} from "./piezas";

/**
 * Las secciones de la portada, en el orden en que se recorren.
 *
 * Las fotos de campaña todavía no existen: donde van, queda un hueco de marca
 * en vez de un recuadro roto. Cada uno dice qué archivo espera, así se pueden
 * ir llenando de a poco sin tocar código.
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

/** Foto que cae a un hueco de marca si el archivo aún no existe. */
function FotoODeja({ src, nota }: { src: string; nota: string }) {
  const [falta, setFalta] = useState(false);
  if (falta) return <Hueco nota={nota} />;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFalta(true)}
      className="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-105"
      style={{ transitionTimingFunction: "var(--curva)" }}
    />
  );
}

// ---------------------------------------------------------------------------

const BANNERS = [
  {
    id: "nuevo",
    antetitulo: "Recién llegado",
    titulo: "Lo último que entró",
    foto: "/tienda/banner-nuevo.webp",
  },
  {
    id: "favoritas",
    antetitulo: "Las de siempre",
    titulo: "Las que más piden",
    foto: "/tienda/banner-favoritas.webp",
  },
  {
    id: "tienda",
    antetitulo: "Chacaíto",
    titulo: "Ven a medírtelo",
    foto: "/tienda/banner-tienda.webp",
  },
] as const;

export function Banners() {
  const ref = useRevelar<HTMLElement>();
  return (
    <section ref={ref} className="revela grid sm:grid-cols-3">
      {BANNERS.map((b) => (
        <a
          key={b.id}
          href="#catalogo"
          className="group relative block aspect-[4/5] overflow-hidden sm:aspect-[3/4]"
        >
          <FotoODeja src={b.foto} nota={`Falta ${b.foto.split("/").pop()}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-carbon/70 via-carbon/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-7">
            <p className="text-[11px] uppercase tracking-[0.2em] text-nieve/80">
              {b.antetitulo}
            </p>
            <p className="mt-2 text-2xl font-light text-nieve sm:text-3xl">
              {b.titulo}
            </p>
            <span className="mt-5 inline-block rounded-full bg-nieve px-7 py-2.5 text-[12px] uppercase tracking-[0.2em] text-carbon">
              Ver
            </span>
          </div>
        </a>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Las categorías salen del inventario, no de una lista escrita a mano: son los
 * tipos de prenda que de verdad hay, con su cuenta real. Si mañana entran
 * enterizos, aparecen solos.
 */
export function Categorias({
  tarjetas,
  coleccion,
  onElegir,
}: {
  tarjetas: Tarjeta[];
  coleccion: Coleccion;
  onElegir: (tipo: string) => void;
}) {
  const ref = useRevelar<HTMLElement>();

  const porTipo = new Map<string, { foto: string; piezas: number }>();
  for (const t of tarjetas) {
    if (!t.tipo) continue;
    const y = porTipo.get(t.tipo) ?? { foto: t.foto_url, piezas: 0 };
    y.piezas += t.tallas.reduce((s, x) => s + Math.max(x.disponible, 0), 0);
    porTipo.set(t.tipo, y);
  }
  const categorias = [...porTipo.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  if (categorias.length === 0) return null;

  return (
    <section
      ref={ref}
      className="revela mx-auto w-full max-w-[1400px] px-5 pt-20 lg:px-10"
    >
      <Titulo
        antetitulo={`Mored ${coleccion === "swim" ? "Swim" : "Active"}`}
        titulo="Categorías"
      />
      <ul className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
        {categorias.map(([tipo, y]) => (
          <li key={tipo}>
            <button
              type="button"
              onClick={() => onElegir(tipo)}
              className="group block w-full text-left"
            >
              <div className="overflow-hidden bg-humo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={y.foto}
                  alt={tipo}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-[900ms] group-hover:scale-105"
                  style={{ transitionTimingFunction: "var(--curva)" }}
                />
              </div>
              <p className="mt-3 text-base">{tipo}</p>
              <p className="text-[13px] text-gris">
                {y.piezas} {y.piezas === 1 ? "pieza" : "piezas"}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Franja oscura con desplazamiento lateral. El fondo negro le da un respiro a
 * la página: después de mucho blanco, el ojo agradece el corte.
 */
export function Destacados({
  tarjetas,
  coleccion,
}: {
  tarjetas: Tarjeta[];
  coleccion: Coleccion;
}) {
  const ref = useRevelar<HTMLElement>();
  const conStock = tarjetas.filter((t) =>
    t.tallas.some((x) => x.disponible > 0),
  );
  if (conStock.length === 0) return null;

  return (
    <section ref={ref} className="revela mt-20 bg-carbon py-16">
      <div className="mx-auto w-full max-w-[1400px] px-5 lg:px-10">
        <Titulo
          claro
          antetitulo="De esta temporada"
          titulo={`Lo que hay en ${coleccion === "swim" ? "Swim" : "Active"}`}
          bajada="Todo lo que ves está disponible ahora mismo en la tienda."
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

export function Inspiracion({ tarjetas }: { tarjetas: Tarjeta[] }) {
  const ref = useRevelar<HTMLElement>();
  const dos = tarjetas.filter((t) => t.tallas.some((x) => x.disponible > 0)).slice(0, 2);

  return (
    <section
      ref={ref}
      className="revela mx-auto w-full max-w-[1400px] px-5 pt-20 lg:px-10"
    >
      <Titulo antetitulo="Inspiración" titulo="Cómo se ve puesto" />

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="group relative aspect-[4/3] overflow-hidden lg:aspect-auto lg:min-h-[520px]">
          <FotoODeja
            src="/tienda/inspiracion.webp"
            nota="Falta inspiracion.webp"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-carbon/65 via-carbon/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-8">
            <p className="text-[11px] uppercase tracking-[0.2em] text-nieve/80">
              El local
            </p>
            <p className="mt-2 text-3xl font-light text-nieve">
              Pruébatelo en Chacaíto
            </p>
            <p className="mt-2 max-w-sm text-sm text-nieve/80">
              CC Manuelita Sáenz, nivel 2, local 02-178.
            </p>
            <div className="mt-6">
              <Boton href="/#visitanos">Cómo llegar</Boton>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {dos.map((t, i) => (
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
const INSTAGRAM = [
  { foto: "/tienda/ig-1.webp", enlace: null },
  { foto: "/tienda/ig-2.webp", enlace: null },
  { foto: "/tienda/ig-3.webp", enlace: null },
  { foto: "/tienda/ig-4.webp", enlace: null },
  { foto: "/tienda/ig-5.webp", enlace: null },
  { foto: "/tienda/ig-6.webp", enlace: null },
] as const;

export function Instagram({ coleccion }: { coleccion: Coleccion }) {
  const ref = useRevelar<HTMLElement>();
  const perfil =
    coleccion === "swim"
      ? "https://instagram.com/moredswim"
      : "https://instagram.com/mored.active";

  return (
    <section ref={ref} className="revela mt-20">
      <div className="mx-auto w-full max-w-[1400px] px-5 pb-7 lg:px-10">
        <Titulo
          antetitulo="Instagram"
          titulo={coleccion === "swim" ? "@moredswim" : "@mored.active"}
        />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6">
        {INSTAGRAM.map((x, i) => (
          <a
            key={i}
            href={x.enlace ?? perfil}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-square overflow-hidden"
          >
            <FotoODeja src={x.foto} nota={`ig-${i + 1}`} />
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
