"use client";

import { useEffect, useState } from "react";
import {
  cambiarCantidad,
  enlaceWhatsapp,
  leerCarrito,
  totalCarrito,
  vaciarCarrito,
  type ItemCarrito,
} from "@/lib/carrito";

const dinero = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

/**
 * El pedido se cierra por WhatsApp, que es como su clientela ya compra. El
 * botón arma el mensaje con lo que eligieron; a partir de ahí la conversación
 * es entre personas, igual que hoy.
 */
export default function Carrito({ whatsapp }: { whatsapp: string | null }) {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const releer = () => setItems(leerCarrito());
    releer();
    window.addEventListener("carrito", releer);
    window.addEventListener("storage", releer);
    return () => {
      window.removeEventListener("carrito", releer);
      window.removeEventListener("storage", releer);
    };
  }, []);

  const piezas = items.reduce((s, x) => s + x.cantidad, 0);
  if (piezas === 0) return null;

  return (
    <>
      {!abierto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-full bg-tinta px-5 py-3.5 text-crema-alto shadow-lg"
        >
          <span className="text-sm">
            {piezas} {piezas === 1 ? "prenda" : "prendas"}
          </span>
          <span className="text-sm tabular-nums">
            {dinero.format(totalCarrito(items))}
          </span>
          <span className="text-sm">Ver pedido</span>
        </button>
      )}

      {abierto && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-tinta/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-crema-alto p-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="text-lg text-tinta">Tu pedido</p>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="text-tinta-suave"
              >
                ✕
              </button>
            </div>

            <ul className="max-h-[45vh] divide-y divide-borde overflow-y-auto">
              {items.map((x) => (
                <li key={x.variante_id} className="flex items-center gap-3 py-2.5">
                  {x.foto_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={x.foto_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg border border-borde object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-tinta">
                      {x.producto}
                    </span>
                    <span className="block text-xs capitalize text-tinta-suave">
                      {x.color} · {x.talla}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(x.variante_id, -1)}
                      aria-label="Quitar uno"
                      className="h-7 w-7 rounded-lg border border-borde"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm tabular-nums">
                      {x.cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(x.variante_id, 1)}
                      aria-label="Agregar uno"
                      className="h-7 w-7 rounded-lg border border-borde"
                    >
                      +
                    </button>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-baseline justify-between border-t border-borde pt-3">
              <span className="text-tinta-suave">Total</span>
              <span className="text-xl tabular-nums text-tinta">
                {dinero.format(totalCarrito(items))}
              </span>
            </div>

            {whatsapp ? (
              <a
                href={enlaceWhatsapp(items, whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block rounded-xl bg-tinta px-4 py-3.5 text-center text-crema-alto"
              >
                Pedir por WhatsApp
              </a>
            ) : (
              <p className="mt-4 rounded-xl bg-alerta-tenue px-4 py-3 text-center text-sm text-alerta">
                Falta configurar el número de WhatsApp de la tienda.
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                vaciarCarrito();
                setAbierto(false);
              }}
              className="mt-2 w-full py-2 text-center text-sm text-tinta-suave underline-offset-4 hover:underline"
            >
              Vaciar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
