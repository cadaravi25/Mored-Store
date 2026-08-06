"use client";

import Link from "next/link";
import { useState } from "react";
import { agregarAlCarrito } from "@/lib/carrito";
import Carrito from "../../carrito";
import { ACENTOS, type FilaCatalogo } from "../../portada";

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
  const acento = ACENTOS[primera.coleccion === "swim" ? "swim" : "active"];

  const delColor = filas
    .filter((f) => f.color === color)
    .sort(
      (a, b) => ORDEN_TALLAS.indexOf(a.talla) - ORDEN_TALLAS.indexOf(b.talla),
    );
  const foto = delColor[0]?.foto_url ?? primera.foto_url;
  const elegida = delColor.find((f) => f.talla === talla);
  const precio = Number(elegida?.precio_usd ?? delColor[0]?.precio_usd ?? 0);
  const agotado = delColor.every((f) => f.disponible <= 0);

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
    <main style={acento as React.CSSProperties}>
      <div className="mx-auto w-full max-w-[1400px] px-5 py-5 lg:px-10">
        <Link href="/" className="text-[13px] text-gris hover:text-carbon">
          ← Seguir viendo
        </Link>
      </div>

      <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-5 pb-16 lg:grid-cols-2 lg:gap-16 lg:px-10">
        <div className="bg-humo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={foto}
            alt={`${primera.producto} ${color}`}
            className="aspect-[3/4] w-full object-cover"
          />
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start lg:py-6">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--acento-hondo)]">
            Mored {primera.coleccion === "swim" ? "Swim" : "Active"}
          </p>
          <h1 className="mt-4 text-3xl font-light leading-tight tracking-tight sm:text-4xl">
            {primera.producto}
          </h1>
          <p className="mt-4 text-2xl font-light tabular-nums">
            {dinero.format(precio)}
          </p>

          {colores.length > 1 && (
            <div className="mt-10">
              <p className="text-[11px] uppercase tracking-[0.18em] text-gris">
                Color
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {colores.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      setTalla(null);
                    }}
                    className={`border px-4 py-2 text-[13px] capitalize transition-colors ${
                      color === c
                        ? "border-carbon text-carbon"
                        : "border-linea text-gris hover:border-carbon"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <p className="text-[11px] uppercase tracking-[0.18em] text-gris">
              Talla
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {delColor.map((f) => {
                const hay = f.disponible > 0;
                return (
                  <button
                    key={f.variante_id}
                    type="button"
                    disabled={!hay}
                    onClick={() => setTalla(f.talla)}
                    className={`min-w-[3.5rem] border px-4 py-3 text-sm transition-colors ${
                      talla === f.talla
                        ? "border-carbon bg-carbon text-nieve"
                        : hay
                          ? "border-linea hover:border-carbon"
                          : "border-linea text-gris/40 line-through"
                    }`}
                  >
                    {f.talla}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={agregar}
            disabled={!elegida}
            className="mt-9 w-full bg-carbon px-6 py-4 text-sm uppercase tracking-[0.14em] text-nieve transition-opacity disabled:opacity-30"
          >
            {puesto
              ? "Agregado"
              : agotado
                ? "Agotado"
                : elegida
                  ? "Agregar al pedido"
                  : "Escoge tu talla"}
          </button>

          {agotado && (
            <p className="mt-3 text-sm text-gris">
              Este color está agotado. Escríbenos y te avisamos cuando llegue.
            </p>
          )}

          <dl className="mt-12 space-y-4 border-t border-linea pt-8 text-sm">
            {[
              [
                "Cómo se pide",
                "Agregas lo que quieras y se abre WhatsApp con el pedido escrito.",
              ],
              [
                "Cambios",
                "Cambio de talla dentro de 24 horas. Los colores claros no se prueban.",
              ],
              [
                "Dónde estamos",
                "CC Manuelita Sáenz, Chacaíto, nivel 2, local 02-178.",
              ],
            ].map(([titulo, texto]) => (
              <div key={titulo}>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-carbon">
                  {titulo}
                </dt>
                <dd className="mt-1.5 leading-relaxed text-gris">{texto}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <Carrito whatsapp={whatsapp} />
    </main>
  );
}
