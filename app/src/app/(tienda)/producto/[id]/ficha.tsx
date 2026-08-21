"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { agregarAlCarrito } from "@/lib/carrito";
import { SIN_TALLA } from "@/lib/prendas";
import { precioVisible } from "@/lib/moneda";
import { useMoneda } from "@/lib/usar-moneda";
import Carrito from "../../carrito";
import { ACENTOS, type FilaCatalogo } from "../../portada";

const ORDEN_TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];

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
  const [mirando, setMirando] = useState(0);
  const { moneda, tasa } = useMoneda();
  const router = useRouter();

  const primera = filas[0];
  /** A dónde ir si no hay historial: el catálogo de su colección. */
  const volverA =
    primera.coleccion === "swim" ? "/catalogo?c=swim" : "/catalogo";
  const acento = ACENTOS[primera.coleccion === "swim" ? "swim" : "active"];

  const delColor = filas
    .filter((f) => f.color === color)
    .sort(
      (a, b) => ORDEN_TALLAS.indexOf(a.talla) - ORDEN_TALLAS.indexOf(b.talla),
    );
  // Las fotos del color que se está mirando. Se quitan repetidas por si la
  // principal viniera también dentro de la galería.
  const galeria = [
    ...new Set(
      (delColor[0]?.fotos?.length
        ? delColor[0].fotos
        : [delColor[0]?.foto_url ?? primera.foto_url]
      ).filter(Boolean),
    ),
  ];
  const foto = galeria[Math.min(mirando, galeria.length - 1)] ?? primera.foto_url;

  // Un sombrero o unos lentes no tienen talla que escoger. Pedirle a la
  // clienta que toque "ÚNICA" para poder seguir es un paso que no decide nada.
  const sinTalla = delColor.length === 1 && delColor[0].talla === SIN_TALLA;
  const elegida = sinTalla ? delColor[0] : delColor.find((f) => f.talla === talla);
  const precio = Number(elegida?.precio_usd ?? delColor[0]?.precio_usd ?? 0);
  const precioBs = Number(
    elegida?.precio_bs ?? delColor[0]?.precio_bs ?? precio,
  );
  const agotado = delColor.every((f) => f.disponible <= 0);

  function agregar() {
    if (!elegida) return;
    agregarAlCarrito({
      variante_id: elegida.variante_id,
      producto: elegida.producto,
      color: elegida.color,
      talla: elegida.talla,
      precio_usd: Number(elegida.precio_usd),
      precio_bs: Number(elegida.precio_bs ?? elegida.precio_usd),
      foto_url: elegida.foto_url,
    });
    setPuesto(true);
    setTimeout(() => setPuesto(false), 1800);
  }

  return (
    <main style={acento as React.CSSProperties}>
      <div className="mx-auto w-full max-w-[1400px] px-5 py-5 lg:px-10">
        {/* Volver atrás de verdad, no a un sitio parecido.
 
            Antes esto llevaba a la portada. Si alguien venía de la prenda 300
            del catálogo, salía y aterrizaba arriba del todo, con trescientas
            tarjetas por delante otra vez. Ir atrás en el historial devuelve al
            catálogo con el desplazamiento donde estaba, que es lo que el
            navegador ya sabe hacer solo.

            Si llegaron por un enlace compartido no hay historial al que
            volver, así que ahí sí se va al catálogo de su colección, que es lo
            más cerca de "seguir viendo" que existe. */}
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push(volverA);
          }}
          className="text-[13px] text-gris hover:text-carbon"
        >
          ← Seguir viendo
        </button>
      </div>

      <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-5 pb-16 lg:grid-cols-2 lg:gap-16 lg:px-10">
        {/* La tira de miniaturas a la izquierda, como en el catálogo del que
            vienen estas fotos. Si solo hay una, no aparece: una tira de un
            elemento es un botón que no lleva a ninguna parte. */}
        <div className="flex gap-3">
          {galeria.length > 1 && (
            <div className="flex shrink-0 flex-col gap-2">
              {galeria.map((f, i) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setMirando(i)}
                  aria-label={`Foto ${i + 1} de ${galeria.length}`}
                  aria-current={i === mirando}
                  className={`w-16 overflow-hidden border transition-colors lg:w-20 ${
                    i === mirando
                      ? "border-carbon"
                      : "border-linea hover:border-gris"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f}
                    alt=""
                    loading="lazy"
                    className="aspect-[3/4] w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="min-w-0 flex-1 bg-humo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto}
              alt={`${primera.producto} ${color}`}
              className="aspect-[3/4] w-full object-cover"
            />
          </div>
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start lg:py-6">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--acento-hondo)]">
            Mored {primera.coleccion === "swim" ? "Swim" : "Active"}
          </p>
          <h1 className="mt-4 text-3xl font-light leading-tight tracking-tight sm:text-4xl">
            {primera.producto}
          </h1>
          {/* El nombre dice de qué familia es; esto dice cuál de todas es. */}
          {primera.descripcion && (
            <p className="mt-3 text-[15px] leading-relaxed text-gris">
              {primera.descripcion}
            </p>
          )}
          <p className="mt-4 text-2xl font-light tabular-nums">
            {precioVisible(precio, precioBs, moneda, tasa)}
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
                      // Otro color, otras fotos: volver a la primera.
                      setMirando(0);
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

          <div className={`mt-8 ${sinTalla ? "hidden" : ""}`}>
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
