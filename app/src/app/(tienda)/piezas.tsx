"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { colorVisible, tallaVisible } from "@/lib/prendas";
import { precioVisible } from "@/lib/moneda";
import { useMoneda } from "@/lib/usar-moneda";
import type { Coleccion } from "./hero";

export interface FilaCatalogo {
  producto_id: string;
  producto: string;
  descripcion: string | null;
  coleccion: Coleccion;
  tipo: string | null;
  estilo: string | null;
  color_id: string;
  color: string;
  hex: string | null;
  foto_url: string;
  /** La principal primero y después las demás. Puede traer una sola. */
  fotos: string[] | null;
  variante_id: string;
  talla: string;
  precio_usd: number;
  /** Base del precio en bolívares, también en euros. */
  precio_bs: number;
  disponible: number;
  destacado: boolean;
}

/** Un color de una prenda, con su foto y sus tallas. */
export interface ColorDeTarjeta {
  /** Cada color puede venir de una fila de productos distinta: el enlace a la
   *  ficha sale de aquí y no de la tarjeta. */
  producto_id: string;
  color_id: string;
  color: string;
  hex: string | null;
  foto_url: string;
  /** La principal primero. La segunda, si la hay, es la que sale al pasar por
   *  encima: casi siempre la de espaldas. */
  fotos: string[];
  precio: number;
  precioBs: number;
  tallas: { talla: string; disponible: number }[];
}

/**
 * Cada tarjeta es una prenda, con todos sus colores dentro.
 *
 * Antes era una tarjeta por prenda y color, y en la rejilla salía el mismo
 * bañador tres veces cambiando solo la foto. Eso llena el catálogo de
 * repeticiones y hace creer que hay más surtido del que hay. Ahora la prenda
 * aparece una vez y el color se escoge en la propia tarjeta.
 */
export interface Tarjeta {
  clave: string;
  producto_id: string;
  producto: string;
  descripcion: string | null;
  coleccion: Coleccion;
  tipo: string | null;
  /** El más barato de sus colores: es el que se enseña como "desde". */
  precio: number;
  precioBs: number;
  /** Lo escogen ellas desde el panel: es lo que sale en "Lo nuevo". */
  destacado: boolean;
  colores: ColorDeTarjeta[];
}

export const ORDEN_TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];

/** Los precios de la tienda son euros. La columna se llama precio_usd por
 *  herencia del esquema inicial, pero nunca tuvo dólares dentro. */
export const dinero = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "EUR",
});

/**
 * Qué hace que dos filas sean la misma prenda.
 *
 * El nombre junta y la descripción separa. Dos trikinis distintos se llaman
 * los dos "Trikini": lo que los distingue es lo que son ("arriba triángulo, x
 * atrás"), no cómo se llaman. Así que misma descripción es la misma prenda en
 * otro color, y descripción distinta son prendas distintas aunque compartan
 * nombre.
 *
 * Se normaliza a minúsculas y sin espacios de sobra porque estas
 * descripciones las escribe una persona, y "Arriba triangulo " y "arriba
 * triangulo" son lo mismo.
 */
function claveDePrenda(f: FilaCatalogo) {
  // Si el catálogo todavía no devuelve la descripción, no se anida nada: cada
  // prenda va por su lado. Anidar por nombre a secas juntaría dos trikinis
  // distintos en una sola tarjeta, que es justo lo que hay que evitar.
  if (f.descripcion === undefined) return f.producto_id;

  const limpio = (t: string | null) =>
    (t ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${limpio(f.producto)}|${limpio(f.descripcion)}`;
}

export function agrupar(filas: FilaCatalogo[]): Tarjeta[] {
  const prendas = new Map<string, Tarjeta>();
  const colores = new Map<string, ColorDeTarjeta>();

  for (const f of filas) {
    const clave = claveDePrenda(f);
    let prenda = prendas.get(clave);
    if (!prenda) {
      prenda = {
        clave,
        producto_id: f.producto_id,
        producto: f.producto,
        descripcion: f.descripcion,
        coleccion: f.coleccion,
        tipo: f.tipo,
        precio: Number(f.precio_usd),
        precioBs: Number(f.precio_bs ?? f.precio_usd),
        destacado: Boolean(f.destacado),
        colores: [],
      };
      prendas.set(clave, prenda);
    }
    prenda.precio = Math.min(prenda.precio, Number(f.precio_usd));
    prenda.precioBs = Math.min(prenda.precioBs, Number(f.precio_bs ?? f.precio_usd));
    // Basta con que una de las anidadas esté marcada para que la prenda salga
    // en "Lo nuevo": es la misma prenda.
    prenda.destacado = prenda.destacado || Boolean(f.destacado);

    const claveColor = `${f.producto_id}-${f.color_id}`;
    let color = colores.get(claveColor);
    if (!color) {
      color = {
        producto_id: f.producto_id,
        color_id: f.color_id,
        color: f.color,
        hex: f.hex,
        foto_url: f.foto_url,
        fotos: f.fotos?.length ? f.fotos : [f.foto_url],
        precio: Number(f.precio_usd),
        precioBs: Number(f.precio_bs ?? f.precio_usd),
        tallas: [],
      };
      colores.set(claveColor, color);
      prenda.colores.push(color);
    }
    color.precio = Math.min(color.precio, Number(f.precio_usd));
    color.precioBs = Math.min(color.precioBs, Number(f.precio_bs ?? f.precio_usd));
    color.tallas.push({ talla: f.talla, disponible: f.disponible });
  }

  for (const c of colores.values()) {
    c.tallas.sort(
      (a, b) => ORDEN_TALLAS.indexOf(a.talla) - ORDEN_TALLAS.indexOf(b.talla),
    );
  }
  return [...prendas.values()];
}

/** Todas las tallas de una prenda, sin repetir, sumando las de cada color. */
export function tallasDe(t: Tarjeta) {
  const suma = new Map<string, number>();
  for (const c of t.colores) {
    for (const x of c.tallas) {
      suma.set(x.talla, (suma.get(x.talla) ?? 0) + x.disponible);
    }
  }
  return [...suma.entries()]
    .map(([talla, disponible]) => ({ talla, disponible }))
    .sort((a, b) => ORDEN_TALLAS.indexOf(a.talla) - ORDEN_TALLAS.indexOf(b.talla));
}

/**
 * Aparecer al entrar en pantalla, una sola vez.
 *
 * La versión anterior nacía invisible desde el servidor y esperaba a que
 * JavaScript la mostrara. Eso tiene un problema de fondo: entre que llega el
 * HTML y arranca el JavaScript hay una ventana, y en esa ventana media página
 * es un hueco blanco. En desarrollo esa ventana dura segundos.
 *
 * Ahora es al revés: el contenido nace VISIBLE y solo se esconde si el
 * JavaScript ya está corriendo y comprueba que la sección está fuera de
 * pantalla. Si el JavaScript falla, tarda o está desactivado, el resultado es
 * una página sin animación, que es un problema de nada.
 *
 * Se usa useLayoutEffect y no useEffect para que el escondido ocurra antes de
 * pintar: con useEffect se vería un parpadeo.
 */
export function useRevelar<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    if (typeof IntersectionObserver === "undefined") return;

    // Ya se ve: no hay nada que animar, se queda como está.
    if (nodo.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    nodo.dataset.revela = "si";

    const ojo = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        nodo.dataset.revela = "visto";
        ojo.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    ojo.observe(nodo);

    // Red de seguridad: si el aviso no llega por lo que sea, se muestra igual.
    const plazo = setTimeout(() => {
      nodo.dataset.revela = "visto";
    }, 2000);

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
  tope,
  soloColores,
}: {
  t: Tarjeta;
  orden?: number;
  claro?: boolean;
  /** Tope de altura para la foto, cuando la sección tiene que caber en una
   *  pantalla. La proporción 3/4 manda mientras quepa; el tope solo actúa en
   *  pantallas bajas, donde si no la sección se saldría. */
  tope?: string;
  /** Con el filtro de color puesto, la tarjeta enseña solo esos. Si no, verde
   *  filtrado enseñaría la foto naranja y parecería que el filtro falla. */
  soloColores?: string[];
}) {
  const ref = useRevelar<HTMLDivElement>();
  const [puesto, setPuesto] = useState(0);
  const { moneda, tasa } = useMoneda();

  const colores = soloColores?.length
    ? t.colores.filter((c) => soloColores.includes(c.color))
    : t.colores;
  const c = colores[Math.min(puesto, colores.length - 1)] ?? t.colores[0];
  const hay = c.tallas.filter((x) => x.disponible > 0);

  return (
    <div
      ref={ref}
      className="revela"
      // El escalonado es corto a propósito: con más de medio segundo entre la
      // primera y la última, la fila se siente lenta en vez de viva.
      style={{ transitionDelay: `${Math.min(orden, 7) * 70}ms` }}
    >
      {/* La colección viaja en la dirección para que la ficha sepa a dónde
          devolver a quien pulse "seguir viendo". */}
      {/* El enlace sale del color escogido, no de la tarjeta: cuando dos
          prendas se anidan por tener la misma descripción, cada color puede
          venir de una ficha distinta. */}
      <Link
        href={
          `/producto/${c.producto_id}?color=${encodeURIComponent(c.color)}` +
          (t.coleccion === "swim" ? "&c=swim" : "")
        }
        className="group block"
      >
        <div className="relative overflow-hidden bg-humo">
          {/* Con dos fotos, pasar por encima enseña la de espaldas en vez de
              ampliar: se ve más de la prenda sin tener que entrar. Con una
              sola no hay nada que enseñar, así que se queda el acercamiento.
              El vuelto no se cruza en el móvil, donde no hay ratón, y ahí la
              tarjeta se comporta como siempre. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.foto_url}
            alt={`${t.producto} ${c.color}`}
            loading="lazy"
            className={`aspect-[3/4] w-full object-cover duration-[900ms] ${
              c.fotos.length > 1
                ? "transition-opacity group-hover:opacity-0"
                : "transition-transform group-hover:scale-105"
            } ${tope ?? ""}`}
            style={{ transitionTimingFunction: "var(--curva)" }}
          />
          {c.fotos.length > 1 && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={c.fotos[1]}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-[900ms] group-hover:opacity-100"
              style={{ transitionTimingFunction: "var(--curva)" }}
            />
          )}
          {hay.length === 0 && (
            <span className="absolute left-3 top-3 bg-nieve px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-gris">
              Agotado
            </span>
          )}
        </div>
        <p className={`mt-3 text-sm leading-snug ${claro ? "text-nieve" : ""}`}>
          {t.producto}
        </p>
        {/* La descripción es lo único que distingue una prenda de otra: el
            nombre las junta a propósito, y sin esto el catálogo de Active son
            ciento y pico tarjetas que dicen "Conjunto" y nada más.
            Dos líneas siempre, tenga texto o no: si cada tarjeta se ajusta a
            lo suyo, las muestras de color de una fila quedan a distinta
            altura y la rejilla se ve descuadrada. */}
        <p
          className={`mt-0.5 line-clamp-2 min-h-[2.75em] text-[13px] leading-snug ${
            claro ? "text-nieve/70" : "text-gris"
          }`}
        >
          {t.descripcion ?? ""}
        </p>
        {/* El color solo si se sabe: "Por definir" es una nota de trabajo de
            la tienda, no algo que la clienta tenga que leer. */}
        <p
          className={`mt-0.5 text-[13px] capitalize ${
            claro ? "text-nieve/60" : "text-gris"
          }`}
        >
          {colorVisible(c.color)}
          {hay.length > 0 && (
            <span className="normal-case">
              {colorVisible(c.color) ? " · " : ""}
              {hay.map((x) => tallaVisible(x.talla)).join(" ")}
            </span>
          )}
        </p>
        <p
          className={`mt-1 text-sm tabular-nums ${claro ? "text-nieve" : ""}`}
        >
          {precioVisible(c.precio, c.precioBs, moneda, tasa)}
        </p>
      </Link>

      {/* Las muestras van fuera del enlace: tocarlas cambia la foto, no lleva
          a la ficha. Si la prenda tiene un solo color no hay nada que escoger
          y no aparecen. */}
      {colores.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {colores.map((x, i) => (
            <button
              key={x.color_id}
              type="button"
              onClick={() => setPuesto(i)}
              onMouseEnter={() => setPuesto(i)}
              title={x.color}
              aria-label={x.color}
              aria-pressed={i === puesto}
              className={`h-5 w-5 rounded-full border transition-all ${
                i === puesto
                  ? claro
                    ? "border-nieve ring-1 ring-nieve ring-offset-2 ring-offset-carbon"
                    : "border-carbon ring-1 ring-carbon ring-offset-2 ring-offset-nieve"
                  : claro
                    ? "border-nieve/40 hover:border-nieve"
                    : "border-linea hover:border-gris"
              }`}
              style={{
                background:
                  x.color.toLowerCase() === "multicolor"
                    ? "conic-gradient(#e0827a, #f2d05a, #4a8c5c, #8ec5e6, #6b4a8c, #d6336c, #e0827a)"
                    : (x.hex ??
                      "repeating-linear-gradient(45deg, #eee, #eee 3px, #ddd 3px, #ddd 6px)"),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
