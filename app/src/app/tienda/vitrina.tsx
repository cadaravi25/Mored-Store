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

function Filtro({
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
      className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${
        activo
          ? "border-[var(--acento)] bg-[var(--acento)] text-crema-alto"
          : "border-borde bg-crema-alto text-tinta-suave"
      }`}
    >
      {children}
    </button>
  );
}

export default function Vitrina({
  filas,
  whatsapp,
}: {
  filas: FilaCatalogo[];
  whatsapp: string | null;
}) {
  const [coleccion, setColeccion] = useState<"" | "active" | "swim">("");
  const [tipo, setTipo] = useState("");
  const [talla, setTalla] = useState("");

  // El acento sigue a la colección que están mirando. Mored Swim es azul y
  // coral; Active es marrón. Son dos marcas, no una con dos secciones.
  const acento =
    coleccion === "swim"
      ? {
          "--acento": "var(--color-swim)",
          "--acento-hondo": "var(--color-swim-hondo)",
          "--acento-tenue": "var(--color-swim-tenue)",
        }
      : {
          "--acento": "var(--color-marron)",
          "--acento-hondo": "var(--color-marron-hondo)",
          "--acento-tenue": "var(--color-marron-tenue)",
        };

  useEffect(() => {
    setTipo("");
  }, [coleccion]);

  const tarjetas = useMemo(() => agrupar(filas), [filas]);

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

  return (
    <main
      style={acento as React.CSSProperties}
      className="mx-auto w-full max-w-6xl px-5 py-8"
    >
      <div className="mb-7 space-y-3">
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          <Filtro activo={coleccion === ""} onClick={() => setColeccion("")}>
            Todo
          </Filtro>
          <Filtro
            activo={coleccion === "active"}
            onClick={() => setColeccion("active")}
          >
            Active
          </Filtro>
          <Filtro
            activo={coleccion === "swim"}
            onClick={() => setColeccion("swim")}
          >
            Swim
          </Filtro>
        </div>

        {tipos.length > 1 && (
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            <Filtro activo={tipo === ""} onClick={() => setTipo("")}>
              Todas
            </Filtro>
            {tipos.map((t) => (
              <Filtro key={t} activo={tipo === t} onClick={() => setTipo(t)}>
                {t}
              </Filtro>
            ))}
          </div>
        )}

        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          <Filtro activo={talla === ""} onClick={() => setTalla("")}>
            Mi talla
          </Filtro>
          {ORDEN_TALLAS.map((t) => (
            <Filtro key={t} activo={talla === t} onClick={() => setTalla(t)}>
              {t}
            </Filtro>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-2xl border border-borde bg-crema-alto py-20 text-center text-tinta-suave">
          {tarjetas.length === 0
            ? "La tienda abre pronto."
            : "Nada con esos filtros. Prueba con otra talla."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibles.map((t) => {
            const hay = t.tallas.filter((x) => x.disponible > 0);
            return (
              <li key={t.clave}>
                <Link
                  href={`/tienda/${t.producto_id}?color=${encodeURIComponent(t.color)}`}
                  className="group block"
                >
                  <span className="block overflow-hidden rounded-2xl border border-borde bg-crema-alto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.foto_url}
                      alt={`${t.producto} ${t.color}`}
                      loading="lazy"
                      className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </span>
                  <span className="mt-2 block">
                    <span className="block truncate text-sm text-tinta">
                      {t.producto}
                    </span>
                    <span className="block text-xs capitalize text-tinta-suave">
                      {t.color}
                      {hay.length > 0 && (
                        <span className="normal-case">
                          {" · "}
                          {hay.map((x) => x.talla).join(" ")}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm tabular-nums text-[var(--acento-hondo)]">
                      {dinero.format(t.precio)}
                      {hay.length === 0 && (
                        <span className="ml-2 text-xs text-tinta-suave">
                          agotado
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Carrito whatsapp={whatsapp} />
    </main>
  );
}
