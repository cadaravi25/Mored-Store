"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * El rango a mano, para lo que no cae en un mes limpio.
 *
 * Va plegado porque el caso normal es cerrar el mes de un toque. Si esto
 * estuviera siempre abierto, dos campos de fecha serían lo primero que se ve
 * al entrar a cuadrar la caja, y no es lo que hacen casi nunca.
 */
export default function Periodo({
  desde,
  hasta,
  aMano,
}: {
  desde: string;
  hasta: string;
  /** Puesta cuando el período de la pantalla ya viene de un rango escrito. */
  aMano: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(aMano);
  const [d, setD] = useState(desde);
  const [h, setH] = useState(hasta);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mb-4 text-sm text-marron-hondo underline-offset-4 hover:underline"
      >
        Otro rango de fechas
      </button>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-borde bg-crema-alto p-4">
      <div>
        <label htmlFor="desde" className="mb-1 block text-xs text-tinta-suave">
          Desde
        </label>
        <input
          id="desde"
          type="date"
          value={d}
          max={h}
          onChange={(e) => setD(e.target.value)}
          className="rounded-lg border border-borde bg-crema px-3 py-2 text-sm outline-none focus:border-marron"
        />
      </div>
      <div>
        <label htmlFor="hasta" className="mb-1 block text-xs text-tinta-suave">
          Hasta
        </label>
        <input
          id="hasta"
          type="date"
          value={h}
          min={d}
          onChange={(e) => setH(e.target.value)}
          className="rounded-lg border border-borde bg-crema px-3 py-2 text-sm outline-none focus:border-marron"
        />
      </div>
      <button
        type="button"
        onClick={() => router.push(`/panel/caja?desde=${d}&hasta=${h}`)}
        disabled={!d || !h || d > h}
        className="rounded-lg bg-tinta px-4 py-2 text-sm text-crema-alto disabled:opacity-50"
      >
        Ver
      </button>
      {!aMano && (
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="py-2 text-sm text-tinta-suave"
        >
          Cancelar
        </button>
      )}
    </div>
  );
}
