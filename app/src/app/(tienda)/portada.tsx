"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Carrito from "./carrito";

export interface FilaCatalogo {
  producto_id: string;
  producto: string;
  coleccion: "active" | "swim";
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

/** Cada tarjeta es un producto en un color: es como se mira la ropa. */
interface Tarjeta {
  clave: string;
  producto_id: string;
  producto: string;
  coleccion: "active" | "swim";
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

function Producto({ t }: { t: Tarjeta }) {
  const hay = t.tallas.filter((x) => x.disponible > 0);
  return (
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
          className="aspect-[3/4] w-full object-cover transition-transform duration-700 group-hover:scale-105"
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
          <span className="normal-case"> · {hay.map((x) => x.talla).join(" ")}</span>
        )}
      </p>
      <p className="mt-1 text-sm tabular-nums">{dinero.format(t.precio)}</p>
    </Link>
  );
}

export default function Portada({
  filas,
  whatsapp,
  coleccionInicial,
}: {
  filas: FilaCatalogo[];
  whatsapp: string | null;
  coleccionInicial: "" | "active" | "swim";
}) {
  const [coleccion, setColeccion] = useState<"" | "active" | "swim">(
    coleccionInicial,
  );
  const [tipo, setTipo] = useState("");
  const [talla, setTalla] = useState("");

  useEffect(() => setTipo(""), [coleccion]);

  const tarjetas = useMemo(() => agrupar(filas), [filas]);
  const acento = ACENTOS[coleccion === "swim" ? "swim" : "active"];

  const tipos = useMemo(
    () =>
      [
        ...new Set(
          tarjetas
            .filter((t) => !coleccion || t.coleccion === coleccion)
            .map((t) => t.tipo)
            .filter((t): t is string => Boolean(t)),
        ),
      ].sort(),
    [tarjetas, coleccion],
  );

  const visibles = useMemo(
    () =>
      tarjetas.filter(
        (t) =>
          (!coleccion || t.coleccion === coleccion) &&
          (!tipo || t.tipo === tipo) &&
          (!talla || t.tallas.some((x) => x.talla === talla && x.disponible > 0)),
      ),
    [tarjetas, coleccion, tipo, talla],
  );

  // La foto del encabezado sale del propio catálogo: la primera con existencia
  // de la colección que están mirando. Sin sesión de fotos y sin nada que
  // mantener aparte.
  const portada =
    tarjetas.find(
      (t) =>
        (!coleccion || t.coleccion === coleccion) &&
        t.tallas.some((x) => x.disponible > 0),
    ) ?? tarjetas[0];

  return (
    <main style={acento as React.CSSProperties}>
      {/* ------------------------------------------------------------------ */}
      <section className="border-b border-linea bg-humo">
        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-10 px-5 py-14 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-20">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--acento-hondo)]">
              {coleccion === "swim" ? "Mored Swim" : "Mored Active"}
            </p>
            <h1 className="mt-5 text-[2.6rem] font-light leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              {coleccion === "swim" ? (
                <>
                  Playa,
                  <br />
                  sol y agua
                </>
              ) : (
                <>
                  Ropa para
                  <br />
                  moverte
                </>
              )}
            </h1>
            <p className="mt-6 max-w-md leading-relaxed text-gris">
              {coleccion === "swim"
                ? "Trajes de baño y salidas de playa. Piezas que se ven bien dentro y fuera del agua."
                : "Tops, licras y sets que aguantan el entrenamiento y se ven bien fuera del gimnasio."}
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#catalogo"
                className="bg-carbon px-8 py-3.5 text-sm text-nieve transition-opacity hover:opacity-90"
              >
                Ver el catálogo
              </a>
              <button
                type="button"
                onClick={() => setColeccion(coleccion === "swim" ? "active" : "swim")}
                className="border border-carbon px-8 py-3.5 text-sm transition-colors hover:bg-carbon hover:text-nieve"
              >
                Ver {coleccion === "swim" ? "Active" : "Swim"}
              </button>
            </div>
          </div>

          <div className="relative">
            {portada ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={portada.foto_url}
                alt=""
                className="aspect-[4/5] w-full object-cover"
              />
            ) : (
              <div className="grid aspect-[4/5] w-full place-items-center bg-[var(--acento-tenue)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mored-marron.png" alt="" className="w-1/3 opacity-40" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto grid w-full max-w-[1400px] gap-3 px-5 py-14 sm:grid-cols-2 lg:px-10">
        {(
          [
            {
              id: "active",
              nombre: "Active",
              texto: "Para entrenar",
              fondo: "bg-marron-tenue",
              color: "text-marron-hondo",
            },
            {
              id: "swim",
              nombre: "Swim",
              texto: "Para la playa",
              fondo: "bg-rosa-tenue",
              color: "text-rosa-hondo",
            },
          ] as const
        ).map((c) => {
          const foto = tarjetas.find((t) => t.coleccion === c.id)?.foto_url;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setColeccion(c.id);
                document
                  .getElementById("catalogo")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`group relative overflow-hidden text-left ${c.fondo}`}
            >
              {foto ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={foto}
                  alt=""
                  loading="lazy"
                  className="aspect-[16/10] w-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="aspect-[16/10] w-full" />
              )}
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-carbon/55 to-transparent p-7">
                <p className="text-3xl font-light text-nieve">{c.nombre}</p>
                <p className="mt-1 text-sm text-nieve/85">{c.texto}</p>
              </div>
            </button>
          );
        })}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="catalogo" className="mx-auto w-full max-w-[1400px] px-5 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-linea pb-5">
          <h2 className="text-3xl font-light tracking-tight sm:text-4xl">
            {coleccion === "active"
              ? "Active"
              : coleccion === "swim"
                ? "Swim"
                : "Todo"}
          </h2>
          <p className="text-sm text-gris">
            {visibles.length} {visibles.length === 1 ? "pieza" : "piezas"}
          </p>
        </div>

        <div className="space-y-3 py-6">
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0">
            <Pildora activo={coleccion === ""} onClick={() => setColeccion("")}>
              Todo
            </Pildora>
            <Pildora
              activo={coleccion === "active"}
              onClick={() => setColeccion("active")}
            >
              Active
            </Pildora>
            <Pildora
              activo={coleccion === "swim"}
              onClick={() => setColeccion("swim")}
            >
              Swim
            </Pildora>
          </div>

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
            {tarjetas.length === 0
              ? "La tienda abre pronto."
              : "Nada con esos filtros. Prueba con otra talla."}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-9 pb-4 sm:grid-cols-3 lg:grid-cols-4">
            {visibles.map((t) => (
              <li key={t.clave}>
                <Producto t={t} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="visitanos" className="mt-20 border-y border-linea bg-humo">
        <div className="mx-auto grid w-full max-w-[1400px] gap-8 px-5 py-14 sm:grid-cols-3 lg:px-10">
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
