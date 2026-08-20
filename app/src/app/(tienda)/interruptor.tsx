"use client";

import { ponerMoneda, type Moneda } from "@/lib/moneda";
import { useMoneda } from "@/lib/usar-moneda";

/**
 * El interruptor de moneda, siempre a la vista.
 *
 * Va flotando y no dentro del encabezado porque el precio se mira mientras se
 * baja por el catálogo, no al llegar arriba. Escondido tras un menú obligaría a
 * subir cada vez que alguien quiere saber cuánto le cuesta en bolívares.
 *
 * Se coloca a la derecha y pequeño: es un dato, no una decisión de compra.
 */
export default function Interruptor() {
  const { moneda, tasa } = useMoneda();

  // Sin tasa del día no hay precio en bolívares que dar, y un interruptor que
  // no cambia nada confunde más que la falta del interruptor.
  if (!tasa) return null;

  const opciones: { id: Moneda; texto: string }[] = [
    { id: "eur", texto: "€" },
    { id: "bs", texto: "Bs" },
  ];

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-40 flex justify-end lg:right-8">
      <div
        role="group"
        aria-label="Moneda de los precios"
        className="pointer-events-auto flex overflow-hidden rounded-full border border-linea bg-nieve/95 shadow-sm backdrop-blur"
      >
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => ponerMoneda(o.id)}
            aria-pressed={moneda === o.id}
            title={
              o.id === "eur"
                ? "Precios en euros"
                : `Precios en bolívares, a ${tasa.toLocaleString("es-VE", {
                    maximumFractionDigits: 2,
                  })} por euro`
            }
            className={`px-3.5 py-1.5 text-[13px] transition-colors ${
              moneda === o.id
                ? "bg-carbon text-nieve"
                : "text-gris hover:text-carbon"
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}
