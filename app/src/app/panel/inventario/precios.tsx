"use client";

import { useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

const eur = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "EUR",
});

/**
 * El monto tal como lo escribe una persona en Venezuela: la coma es el decimal
 * y el punto separa los miles. JavaScript lo lee al revés.
 */
function leerMonto(texto: string): number {
  const limpio = texto.trim().replace(/\s/g, "");
  if (!limpio) return 0;
  const n = Number(
    limpio.includes(",")
      ? limpio.replace(/\./g, "").replace(",", ".")
      : limpio,
  );
  return Number.isFinite(n) ? n : 0;
}

/**
 * Los dos precios de una prenda.
 *
 * Una misma prenda no vale lo mismo pagada en divisas que pagada en bolívares.
 * No es un recargo automático: son dos números que ellas deciden prenda por
 * prenda, y por eso van los dos a mano.
 *
 * Los DOS se escriben en euros. El de bolívares se multiplica por la tasa del
 * BCV del día para mostrarlo en la tienda, así que aquí nunca se escriben
 * bolívares: serían un número que caduca cada mañana.
 *
 * Se guarda por color y no por talla porque la misma prenda vale igual en S que
 * en M.
 */
export default function Precios({
  colorId,
  precioEur,
  precioBs,
  tasa,
  onGuardado,
}: {
  colorId: string;
  precioEur: number;
  precioBs: number;
  tasa: number | null;
  onGuardado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [divisas, setDivisas] = useState(String(precioEur));
  const [bolivares, setBolivares] = useState(String(precioBs));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enBs = leerMonto(bolivares);

  async function guardar() {
    const a = leerMonto(divisas);
    const b = leerMonto(bolivares);

    if (a <= 0) {
      setError("Falta el precio en divisas.");
      return;
    }
    if (b <= 0) {
      setError("Falta el precio para pago en bolívares.");
      return;
    }

    setGuardando(true);
    setError(null);

    const { error: fallo } = await crearClienteNavegador().rpc("poner_precios", {
      p_color_id: colorId,
      p_precio_usd: a,
      p_precio_bs: b,
    });

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setGuardando(false);
    setAbierto(false);
    onGuardado();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-1 text-left text-xs text-tinta-suave underline-offset-2 hover:underline"
      >
        {eur.format(precioEur)} en divisas · {eur.format(precioBs)} en Bs
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-marron-suave bg-crema p-3">
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs text-tinta-suave">
            Paga en divisas
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={divisas}
            onChange={(e) => setDivisas(e.target.value)}
            className="w-full rounded-lg border border-borde bg-crema-alto px-3 py-2 text-sm tabular-nums outline-none focus:border-marron"
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs text-tinta-suave">
            Paga en bolívares
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={bolivares}
            onChange={(e) => setBolivares(e.target.value)}
            className="w-full rounded-lg border border-borde bg-crema-alto px-3 py-2 text-sm tabular-nums outline-none focus:border-marron"
          />
        </label>
      </div>

      {/* Los dos se escriben en euros, así que hay que enseñar en qué se
          convierte el segundo: es la cifra que va a ver la clienta. */}
      <p className="mt-2 text-xs text-tinta-suave">
        {tasa && enBs > 0 ? (
          <>
            En la tienda saldrá{" "}
            <b className="text-tinta">
              Bs{" "}
              {(enBs * tasa).toLocaleString("es-VE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </b>{" "}
            a {tasa.toLocaleString("es-VE", { maximumFractionDigits: 2 })} por euro
          </>
        ) : (
          "Los dos se escriben en euros. El de bolívares se multiplica por la tasa del día."
        )}
      </p>

      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-alerta-tenue px-3 py-2 text-xs text-alerta">
          {error}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg border border-borde px-3 py-1.5 text-xs text-tinta-suave"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="flex-1 rounded-lg bg-tinta px-3 py-1.5 text-xs text-crema-alto disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar precios"}
        </button>
      </div>
    </div>
  );
}
