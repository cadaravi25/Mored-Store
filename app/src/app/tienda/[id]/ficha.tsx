"use client";

import Link from "next/link";
import { useState } from "react";
import { agregarAlCarrito } from "@/lib/carrito";
import Carrito from "../carrito";
import type { FilaCatalogo } from "../vitrina";

const ORDEN_TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];

const dinero = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

export default function Ficha({
  filas,
  colorInicial,
  whatsapp,
}: {
  filas: FilaCatalogo[];
  colorInicial: string | null;
  whatsapp: string | null;
}) {
  const colores = [...new Set(filas.map((f) => f.color))];
  const [color, setColor] = useState(
    colorInicial && colores.includes(colorInicial) ? colorInicial : colores[0],
  );
  const [talla, setTalla] = useState<string | null>(null);
  const [puesto, setPuesto] = useState(false);

  const primera = filas[0];
  const acento =
    primera.coleccion === "swim"
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

  const delColor = filas
    .filter((f) => f.color === color)
    .sort(
      (a, b) => ORDEN_TALLAS.indexOf(a.talla) - ORDEN_TALLAS.indexOf(b.talla),
    );
  const foto = delColor[0]?.foto_url ?? primera.foto_url;
  const elegida = delColor.find((f) => f.talla === talla);
  const precio = Number(elegida?.precio_usd ?? delColor[0]?.precio_usd ?? 0);

  function agregar() {
    if (!elegida) return;
    agregarAlCarrito({
      variante_id: elegida.variante_id,
      producto: elegida.producto,
      color: elegida.color,
      talla: elegida.talla,
      precio_usd: Number(elegida.precio_usd),
      foto_url: elegida.foto_url,
    });
    setPuesto(true);
    setTimeout(() => setPuesto(false), 1800);
  }

  return (
    <main
      style={acento as React.CSSProperties}
      className="mx-auto w-full max-w-4xl px-5 py-6"
    >
      <Link
        href="/tienda"
        className="text-sm text-tinta-suave underline-offset-4 hover:underline"
      >
        ← Seguir viendo
      </Link>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-borde bg-crema-alto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={foto}
            alt={`${primera.producto} ${color}`}
            className="aspect-[3/4] w-full object-cover"
          />
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Mored {primera.coleccion === "swim" ? "Swim" : "Active"}
          </p>
          <h1 className="mt-1 text-2xl text-tinta">{primera.producto}</h1>
          <p className="mt-2 text-2xl tabular-nums text-[var(--acento-hondo)]">
            {dinero.format(precio)}
          </p>

          {colores.length > 1 && (
            <div className="mt-6">
              <p className="mb-2 text-sm text-tinta-suave">Color</p>
              <div className="flex flex-wrap gap-2">
                {colores.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      setTalla(null);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm capitalize ${
                      color === c
                        ? "border-[var(--acento)] bg-[var(--acento-tenue)] text-tinta"
                        : "border-borde text-tinta-suave"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <p className="mb-2 text-sm text-tinta-suave">Talla</p>
            <div className="flex flex-wrap gap-2">
              {delColor.map((f) => {
                const hay = f.disponible > 0;
                return (
                  <button
                    key={f.variante_id}
                    type="button"
                    disabled={!hay}
                    onClick={() => setTalla(f.talla)}
                    className={`min-w-[3.25rem] rounded-xl border px-4 py-2.5 text-sm ${
                      talla === f.talla
                        ? "border-[var(--acento)] bg-[var(--acento)] text-crema-alto"
                        : hay
                          ? "border-borde text-tinta"
                          : "border-borde text-tinta-suave/40 line-through"
                    }`}
                  >
                    {f.talla}
                  </button>
                );
              })}
            </div>
            {delColor.every((f) => f.disponible <= 0) && (
              <p className="mt-2 text-sm text-tinta-suave">
                Este color está agotado. Escríbenos y te avisamos cuando llegue.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={agregar}
            disabled={!elegida}
            className="mt-7 w-full rounded-xl bg-tinta px-4 py-3.5 text-crema-alto disabled:opacity-40"
          >
            {puesto
              ? "Agregado ✓"
              : elegida
                ? "Agregar al pedido"
                : "Escoge tu talla"}
          </button>

          <p className="mt-4 text-xs text-tinta-suave">
            El pedido se cierra por WhatsApp. Cambio de talla dentro de 24
            horas; los colores claros no se prueban.
          </p>
        </div>
      </div>

      <Carrito whatsapp={whatsapp} />
    </main>
  );
}
