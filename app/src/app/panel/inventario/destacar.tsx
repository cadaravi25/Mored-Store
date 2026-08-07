"use client";

import { useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

/**
 * Marca una prenda para que salga en "Lo nuevo" de la tienda.
 *
 * Va aquí, en la tarjeta del inventario, y no en una pantalla de "gestionar la
 * portada": el momento en que alguien sabe que algo es novedad es cuando lo
 * está viendo, no cuando se sienta a administrar la web.
 *
 * Se marca a mano a propósito. Ordenar por fecha de entrada parecía lo obvio,
 * pero un restock de algo viejo entraría como novedad.
 */
export default function Destacar({
  productoId,
  inicial,
}: {
  productoId: string;
  inicial: boolean;
}) {
  const [puesto, setPuesto] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(false);

  async function alternar() {
    const nuevo = !puesto;
    setPuesto(nuevo); // se ve al instante; si falla, se devuelve
    setGuardando(true);
    setError(false);

    const { error: fallo } = await crearClienteNavegador()
      .from("productos")
      .update({ destacado: nuevo })
      .eq("id", productoId);

    if (fallo) {
      setPuesto(!nuevo);
      setError(true);
    }
    setGuardando(false);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={guardando}
      title="Sale en «Lo nuevo» de la tienda"
      className={`mt-1.5 flex items-center gap-1.5 text-xs transition-colors ${
        puesto ? "text-marron-hondo" : "text-tinta-suave/70 hover:text-tinta"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill={puesto ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      >
        <path d="M12 3.5l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8z" />
      </svg>
      {error ? "No se pudo guardar" : puesto ? "En Lo nuevo" : "Marcar como nuevo"}
    </button>
  );
}
