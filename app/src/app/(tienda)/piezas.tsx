"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Coleccion } from "./hero";

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

/** Cada tarjeta es un producto en un color: es como se mira la ropa. */
export interface Tarjeta {
  clave: string;
  producto_id: string;
  producto: string;
  coleccion: Coleccion;
  tipo: string | null;
  color: string;
  hex: string | null;
  foto_url: string;
  precio: number;
  tallas: { talla: string; disponible: number }[];
}

export const ORDEN_TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];

export const dinero = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

export function agrupar(filas: FilaCatalogo[]): Tarjeta[] {
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
      hex: f.hex,
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

/**
 * Aparecer al entrar en pantalla, una sola vez. Repetirlo al subir y bajar
 * cansa: la primera vez es una bienvenida, la quinta es un parpadeo.
 *
 * Falla hacia mostrar, nunca hacia esconder. Una sección invisible ocupa su
 * espacio igual, así que si el aviso no llega el resultado es un hueco blanco
 * enorme y la página parece rota. Por eso hay tres caminos al mismo sitio: el
 * observador, una comprobación al montar por si ya estaba a la vista, y un
 * plazo de gracia por si ninguno de los dos disparó.
 */
export function useRevelar<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;

    const mostrar = () => {
      nodo.dataset.visible = "si";
    };

    if (typeof IntersectionObserver === "undefined") {
      mostrar();
      return;
    }

    // Ya visible al montar: no hay que esperar a que alguien se desplace.
    if (nodo.getBoundingClientRect().top < window.innerHeight * 0.95) {
      mostrar();
    }

    const ojo = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          mostrar();
          ojo.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    ojo.observe(nodo);

    const plazo = setTimeout(mostrar, 2500);

    return () => {
      ojo.disconnect();
      clearTimeout(plazo);
    };
  }, []);

  return ref;
}

/** Título de sección: antetítulo pequeño arriba y titular grande debajo. */
export function Titulo({
  antetitulo,
  titulo,
  bajada,
  claro,
}: {
  antetitulo: string;
  titulo: string;
  bajada?: string;
  claro?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-[11px] uppercase tracking-[0.2em] ${
          claro ? "text-nieve/60" : "text-gris"
        }`}
      >
        {antetitulo}
      </p>
      <h2
        className={`mt-2 text-3xl font-light tracking-tight sm:text-4xl ${
          claro ? "text-nieve" : ""
        }`}
      >
        {titulo}
      </h2>
      {bajada && (
        <p className={`mt-2 text-sm ${claro ? "text-nieve/70" : "text-gris"}`}>
          {bajada}
        </p>
      )}
    </div>
  );
}

export function TarjetaProducto({
  t,
  orden = 0,
  claro,
}: {
  t: Tarjeta;
  orden?: number;
  claro?: boolean;
}) {
  const ref = useRevelar<HTMLDivElement>();
  const hay = t.tallas.filter((x) => x.disponible > 0);

  return (
    <div
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
        <p className={`mt-3 text-sm leading-snug ${claro ? "text-nieve" : ""}`}>
          {t.producto}
        </p>
        <p
          className={`mt-0.5 text-[13px] capitalize ${
            claro ? "text-nieve/60" : "text-gris"
          }`}
        >
          {t.color}
          {hay.length > 0 && (
            <span className="normal-case">
              {" · "}
              {hay.map((x) => x.talla).join(" ")}
            </span>
          )}
        </p>
        <p
          className={`mt-1 text-sm tabular-nums ${claro ? "text-nieve" : ""}`}
        >
          {dinero.format(t.precio)}
        </p>
      </Link>
    </div>
  );
}
