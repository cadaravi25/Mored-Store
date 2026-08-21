"use client";

import { precioVisible } from "@/lib/moneda";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { useMoneda } from "@/lib/usar-moneda";
import { useEffect, useState } from "react";
import {
  cambiarCantidad,
  enlaceWhatsapp,
  leerCarrito,
  totalCarrito,
  baseBsCarrito,
  vaciarCarrito,
  type ItemCarrito,
} from "@/lib/carrito";

/**
 * El pedido se cierra por WhatsApp, que es como su clientela ya compra. El
 * botón arma el mensaje con lo que eligieron; de ahí en adelante la
 * conversación es entre personas, igual que hoy.
 */
export default function Carrito({ whatsapp }: { whatsapp: string | null }) {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const { moneda, tasa } = useMoneda();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const releer = () => setItems(leerCarrito());
    const abrir = () => {
      releer();
      setAbierto(true);
    };
    releer();
    window.addEventListener("carrito", releer);
    window.addEventListener("storage", releer);
    window.addEventListener("abrir-carrito", abrir);
    return () => {
      window.removeEventListener("carrito", releer);
      window.removeEventListener("storage", releer);
      window.removeEventListener("abrir-carrito", abrir);
    };
  }, []);

  // El teclado de escape cierra: es un panel encima de todo.
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [abierto]);

  const piezas = items.reduce((s, x) => s + x.cantidad, 0);
  const [pidiendo, setPidiendo] = useState(false);

  /**
   * Pedir: primero se registra la orden, después se abre WhatsApp.
   *
   * Registrarla es lo que hace que a ellas les llegue la prenda con su foto al
   * panel, en vez de un mensaje que dice "chaqueta negro talla s" y las obliga
   * a adivinar cuál de las siete es.
   *
   * SI LA BASE FALLA, EL PEDIDO SE MANDA IGUAL
   *
   * Una clienta con el pedido armado no puede quedarse sin poder pedirlo
   * porque nuestra base no respondió. Se abre WhatsApp de todos modos, solo
   * que sin número de pedido. Es la misma regla que ya sigue el punto de
   * venta: nunca bloquear una venta real.
   *
   * LA VENTANA SE ABRE ANTES DE ESPERAR
   *
   * Si se abriera después del await, el navegador lo tomaría por una ventana
   * emergente y la bloquearía, porque ya no está pegada al clic. Se abre
   * vacía en el momento del clic y se le pone la dirección al volver.
   */
  async function pedir() {
    if (!whatsapp || pidiendo || items.length === 0) return;
    setPidiendo(true);

    const ventana = window.open("", "_blank");

    let numero: number | null = null;
    try {
      const { data } = await crearClienteNavegador().rpc("crear_orden", {
        p_lineas: items.map((x) => ({
          variante_id: x.variante_id,
          cantidad: x.cantidad,
        })),
      });
      const orden = data as { numero?: number } | null;
      numero = typeof orden?.numero === "number" ? orden.numero : null;
    } catch {
      // Queda sin número y sigue.
    }

    const url = enlaceWhatsapp(items, whatsapp, moneda, tasa, numero);
    if (ventana) ventana.location.href = url;
    else window.location.href = url;

    vaciarCarrito();
    setAbierto(false);
    setPidiendo(false);
  }

  return (
    <>
      {piezas > 0 && !abierto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-sm items-center justify-between gap-4 bg-carbon px-6 py-4 text-nieve shadow-xl"
        >
          <span className="text-sm">
            {piezas} {piezas === 1 ? "pieza" : "piezas"}
          </span>
          <span className="text-sm tabular-nums">
            {precioVisible(totalCarrito(items), baseBsCarrito(items), moneda, tasa)}
          </span>
          <span className="text-sm uppercase tracking-[0.14em]">Pedir</span>
        </button>
      )}

      {abierto && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-carbon/30"
          onClick={() => setAbierto(false)}
        >
          {/* Panel lateral, como en cualquier tienda: no tapa la ropa. */}
          <div
            className="flex h-full w-full max-w-md flex-col bg-nieve"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-linea px-6 py-5">
              <p className="text-[11px] uppercase tracking-[0.18em]">Tu pedido</p>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="text-gris hover:text-carbon"
              >
                ✕
              </button>
            </div>

            {items.length === 0 ? (
              <p className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gris">
                Todavía no has agregado nada.
              </p>
            ) : (
              <ul className="flex-1 divide-y divide-linea overflow-y-auto px-6">
                {items.map((x) => (
                  <li key={x.variante_id} className="flex gap-4 py-4">
                    {x.foto_url && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={x.foto_url}
                        alt=""
                        className="h-24 w-20 shrink-0 bg-humo object-cover"
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate text-sm">{x.producto}</p>
                      <p className="mt-0.5 text-[13px] capitalize text-gris">
                        {x.color} · {x.talla}
                      </p>
                      <p className="mt-auto text-sm tabular-nums">
                        {precioVisible(
                          x.cantidad * Number(x.precio_usd),
                          x.cantidad * Number(x.precio_bs ?? x.precio_usd),
                          moneda,
                          tasa,
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end justify-between">
                      <span className="flex items-center border border-linea">
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(x.variante_id, -1)}
                          aria-label="Quitar uno"
                          className="h-8 w-8 text-gris hover:text-carbon"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums">
                          {x.cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(x.variante_id, 1)}
                          aria-label="Agregar uno"
                          className="h-8 w-8 text-gris hover:text-carbon"
                        >
                          +
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {items.length > 0 && (
              <div className="border-t border-linea px-6 py-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-gris">Total</span>
                  <span className="text-2xl font-light tabular-nums">
                    {precioVisible(totalCarrito(items), baseBsCarrito(items), moneda, tasa)}
                  </span>
                </div>

                {whatsapp ? (
                  <button
                    type="button"
                    onClick={pedir}
                    disabled={pidiendo}
                    className="mt-5 block w-full bg-carbon px-6 py-4 text-center text-sm uppercase tracking-[0.14em] text-nieve disabled:opacity-60"
                  >
                    {pidiendo ? "Un momento…" : "Pedir por WhatsApp"}
                  </button>
                ) : (
                  <p className="mt-5 bg-alerta-tenue px-4 py-3 text-center text-sm text-alerta">
                    Falta configurar el número de WhatsApp de la tienda.
                  </p>
                )}

                <p className="mt-3 text-center text-xs leading-relaxed text-gris">
                  Se abre el chat con tu pedido escrito. Ahí acordamos el pago y
                  la entrega.
                </p>

                <button
                  type="button"
                  onClick={() => vaciarCarrito()}
                  className="mt-4 w-full text-center text-xs text-gris underline-offset-4 hover:underline"
                >
                  Vaciar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
