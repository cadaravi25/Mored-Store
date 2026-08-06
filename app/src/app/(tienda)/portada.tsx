"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Carrito from "./carrito";
import Hero, { type Coleccion } from "./hero";

export interface FilaCatalogo {
  producto_id: string;
  producto: string;
  coleccion: Coleccion;
  tipo: string | null;
  estilo: string | null;
  color_id: string;
  color: string;
  hex: string | null;
  foto_url: string;
  variante_id: string;
  talla: string;
  precio_usd: number;
  disponible: number;
}

const ORDEN_TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];

const dinero = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

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

/** Cada tarjeta es un producto en un color: es como se mira la ropa. */
interface Tarjeta {
  clave: string;
  producto_id: string;
  producto: string;
  coleccion: Coleccion;
  tipo: string | null;
  color: string;
  foto_url: string;
  precio: number;
  tallas: { talla: string; disponible: number }[];
}

function agrupar(filas: FilaCatalogo[]): Tarjeta[] {
  const mapa = new Map<string, Tarjeta>();
  for (const f of filas) {
    const clave = `${f.producto_id}-${f.color_id}`;
    const t = mapa.get(clave) ?? {
      clave,
      producto_id: f.producto_id,
      producto: f.producto,
      coleccion: f.coleccion,
      tipo: f.tipo,
      color: f.color,
      foto_url: f.foto_url,
      precio: Number(f.precio_usd),
      tallas: [],
    };
    t.tallas.push({ talla: f.talla, disponible: f.disponible });
    t.precio = Math.min(t.precio, Number(f.precio_usd));
    mapa.set(clave, t);
  }
  for (const t of mapa.values()) {
    t.tallas.sort(
      (a, b) => ORDEN_TALLAS.indexOf(a.talla) - ORDEN_TALLAS.indexOf(b.talla),
    );
  }
  return [...mapa.values()];
}

/** Aparecer al entrar en pantalla, una sola vez. Repetirlo al subir y bajar
 *  cansa: la primera vez es una bienvenida, la quinta es un parpadeo. */
function useRevelar<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    const ojo = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          nodo.dataset.visible = "si";
          ojo.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    ojo.observe(nodo);
    return () => ojo.disconnect();
  }, []);
  return ref;
}

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
      className={`shrink-0 border px-4 py-2 text-[13px] transition-colors ${
        activo
          ? "border-carbon bg-carbon text-nieve"
          : "border-linea text-gris hover:border-carbon hover:text-carbon"
      }`}
    >
      {children}
    </button>
  );
}

function Producto({ t, orden }: { t: Tarjeta; orden: number }) {
  const ref = useRevelar<HTMLLIElement>();
  const hay = t.tallas.filter((x) => x.disponible > 0);

  return (
    <li
      ref={ref}
      className="revela"
      // El escalonado es corto a propósito: con más de medio segundo entre la
      // primera y la última, la fila se siente lenta en vez de viva.
      style={{ transitionDelay: `${Math.min(orden, 7) * 70}ms` }}
    >
      <Link
        href={`/producto/${t.producto_id}?color=${encodeURIComponent(t.color)}`}
        className="group block"
      >
        <div className="relative overflow-hidden bg-humo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={t.foto_url}
            alt={`${t.producto} ${t.color}`}
            loading="lazy"
            className="aspect-[3/4] w-full object-cover transition-transform duration-[900ms] group-hover:scale-105"
            style={{ transitionTimingFunction: "var(--curva)" }}
          />
          {hay.length === 0 && (
            <span className="absolute left-3 top-3 bg-nieve px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-gris">
              Agotado
            </span>
          )}
        </div>
        <p className="mt-3 text-sm leading-snug">{t.producto}</p>
        <p className="mt-0.5 text-[13px] capitalize text-gris">
          {t.color}
          {hay.length > 0 && (
            <span className="normal-case">
              {" · "}
              {hay.map((x) => x.talla).join(" ")}
            </span>
          )}
        </p>
        <p className="mt-1 text-sm tabular-nums">{dinero.format(t.precio)}</p>
      </Link>
    </li>
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

  // Al cambiar de colección se limpian los filtros: los tipos de una no son
  // los de la otra, y quedarse con "Traje de baño" al pasar a Active dejaría
  // la pantalla vacía sin motivo aparente.
  useEffect(() => {
    setTipo("");
    setTalla("");
  }, [coleccion]);

  const tarjetas = useMemo(() => agrupar(filas), [filas]);
  const acento = ACENTOS[coleccion];

  const dellColeccion = useMemo(
    () => tarjetas.filter((t) => t.coleccion === coleccion),
    [tarjetas, coleccion],
  );

  const tipos = useMemo(
    () =>
      [
        ...new Set(
          dellColeccion.map((t) => t.tipo).filter((t): t is string => Boolean(t)),
        ),
      ].sort(),
    [dellColeccion],
  );

  const visibles = useMemo(
    () =>
      dellColeccion.filter(
        (t) =>
          (!tipo || t.tipo === tipo) &&
          (!talla || t.tallas.some((x) => x.talla === talla && x.disponible > 0)),
      ),
    [dellColeccion, tipo, talla],
  );

  const refFranja = useRevelar<HTMLDivElement>();

  function cambiar(c: Coleccion) {
    setColeccion(c);
    // La dirección queda contando en qué colección estás: si comparten el
    // enlace, se abre en la misma.
    window.history.replaceState(null, "", c === "active" ? "/" : `/?c=${c}`);
  }

  return (
    <main style={acento as React.CSSProperties}>
      <Hero coleccion={coleccion} onCambiar={cambiar} />

      <section
        id="catalogo"
        className="mx-auto w-full max-w-[1400px] px-5 pt-16 lg:px-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-linea pb-5">
          <h2 className="text-3xl font-light tracking-tight sm:text-4xl">
            Mored {coleccion === "swim" ? "Swim" : "Active"}
          </h2>
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
            {dellColeccion.length === 0
              ? `Mored ${coleccion === "swim" ? "Swim" : "Active"} abre pronto.`
              : "Nada con esos filtros. Prueba con otra talla."}
          </p>
        ) : (
          <ul
            key={coleccion}
            className="grid grid-cols-2 gap-x-3 gap-y-9 pb-4 sm:grid-cols-3 lg:grid-cols-4"
          >
            {visibles.map((t, i) => (
              <Producto key={t.clave} t={t} orden={i} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-20 border-y border-linea bg-humo">
        <div
          ref={refFranja}
          className="revela mx-auto grid w-full max-w-[1400px] gap-8 px-5 py-14 sm:grid-cols-3 lg:px-10"
        >
          {[
            {
              titulo: "Estamos en Chacaíto",
              texto:
                "CC Manuelita Sáenz, nivel 2, local 02-178. Puedes venir a medirte lo que viste aquí.",
            },
            {
              titulo: "Se pide por WhatsApp",
              texto:
                "Armas tu pedido y se abre el chat con todo escrito. Ahí acordamos el pago y la entrega.",
            },
            {
              titulo: "Cambio en 24 horas",
              texto:
                "Si la talla no te quedó, la cambias dentro de las 24 horas. Los colores claros no se prueban.",
            },
          ].map((b) => (
            <div key={b.titulo}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--acento-hondo)]">
                {b.titulo}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-gris">{b.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <Carrito whatsapp={whatsapp} />
    </main>
  );
}
