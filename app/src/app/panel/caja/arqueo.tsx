"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

export interface Resumen {
  fecha: string;
  cantidad_ventas: number;
  total_ventas_usd: number;
  efectivo_usd_esperado: number;
  efectivo_bs_esperado: number;
  movimientos_usd: number;
  movimientos_bs: number;
  tasa: number | null;
  por_verificar: { cantidad: number; monto_usd: number } | null;
  detalle: {
    metodo: string;
    moneda: "USD" | "BS";
    monto: number;
    monto_usd: number;
    cantidad: number;
  }[];
  cierre: {
    estado: string;
    efectivo_usd_contado: number | null;
    efectivo_bs_contado: number | null;
    efectivo_usd_esperado: number | null;
    efectivo_bs_esperado: number | null;
    diferencia_usd: number | null;
    diferencia_bs: number | null;
    nota: string | null;
    cerrado_at: string | null;
  } | null;
}

const usd = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});
const num = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 });

/** Muestra la diferencia dicha como la diría una persona, no como un signo. */
function Diferencia({
  valor,
  moneda,
}: {
  valor: number | null;
  moneda: "USD" | "BS";
}) {
  if (valor === null) {
    return <span className="text-sm text-tinta-suave">Sin contar</span>;
  }
  const texto =
    moneda === "BS"
      ? `${num.format(Math.abs(valor))} Bs`
      : usd.format(Math.abs(valor));

  if (Math.abs(valor) < 0.005) {
    return <span className="text-sm text-tinta">Cuadra exacto</span>;
  }
  return (
    <span className="text-sm text-alerta">
      {valor > 0 ? `Sobran ${texto}` : `Faltan ${texto}`}
    </span>
  );
}

export default function Arqueo({
  fecha,
  resumen,
}: {
  fecha: string;
  resumen: Resumen;
}) {
  const router = useRouter();
  const cerrado = resumen.cierre?.estado === "cerrado";

  const [rehaciendo, setRehaciendo] = useState(false);
  const [contadoUsd, setContadoUsd] = useState("");
  const [contadoBs, setContadoBs] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esperadoUsd = Number(resumen.efectivo_usd_esperado ?? 0);
  const esperadoBs = Number(resumen.efectivo_bs_esperado ?? 0);

  const difUsd = contadoUsd.trim() === "" ? null : Number(contadoUsd) - esperadoUsd;
  const difBs = contadoBs.trim() === "" ? null : Number(contadoBs) - esperadoBs;

  async function cerrar() {
    setGuardando(true);
    setError(null);

    const supabase = crearClienteNavegador();
    const { error: fallo } = await supabase.rpc("cerrar_caja", {
      p_fecha: fecha,
      p_efectivo_usd_contado: contadoUsd.trim() === "" ? null : Number(contadoUsd),
      p_efectivo_bs_contado: contadoBs.trim() === "" ? null : Number(contadoBs),
      p_nota: nota.trim() || null,
      p_recalcular: rehaciendo,
    });

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setRehaciendo(false);
    setGuardando(false);
    router.refresh();
  }

  if (cerrado && !rehaciendo) {
    const c = resumen.cierre!;
    return (
      <section className="rounded-2xl border border-borde bg-crema-alto p-5">
        <p className="text-xs uppercase tracking-wide text-tinta-suave">
          Arqueo del día
        </p>

        <dl className="mt-3 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-sm text-tinta-suave">
              Efectivo $ · contaron{" "}
              <span className="tabular-nums text-tinta">
                {c.efectivo_usd_contado === null
                  ? "—"
                  : usd.format(Number(c.efectivo_usd_contado))}
              </span>{" "}
              de {usd.format(Number(c.efectivo_usd_esperado ?? 0))}
            </dt>
            <dd>
              <Diferencia
                valor={
                  c.efectivo_usd_contado === null
                    ? null
                    : Number(c.diferencia_usd ?? 0)
                }
                moneda="USD"
              />
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-sm text-tinta-suave">
              Efectivo Bs · contaron{" "}
              <span className="tabular-nums text-tinta">
                {c.efectivo_bs_contado === null
                  ? "—"
                  : `${num.format(Number(c.efectivo_bs_contado))} Bs`}
              </span>{" "}
              de {num.format(Number(c.efectivo_bs_esperado ?? 0))} Bs
            </dt>
            <dd>
              <Diferencia
                valor={
                  c.efectivo_bs_contado === null
                    ? null
                    : Number(c.diferencia_bs ?? 0)
                }
                moneda="BS"
              />
            </dd>
          </div>
        </dl>

        {c.nota && (
          <p className="mt-3 rounded-lg bg-crema px-3 py-2 text-sm text-tinta">
            {c.nota}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-3">
          <p className="text-xs text-tinta-suave">
            Cerrada el{" "}
            {c.cerrado_at
              ? new Date(c.cerrado_at).toLocaleString("es-VE", {
                  timeZone: "America/Caracas",
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
          {/* Rehacer el cierre es válido cuando aparece una venta rezagada,
              pero tiene que costar un toque más que cerrarlo bien. */}
          <button
            type="button"
            onClick={() => {
              setContadoUsd(
                c.efectivo_usd_contado === null ? "" : String(c.efectivo_usd_contado),
              );
              setContadoBs(
                c.efectivo_bs_contado === null ? "" : String(c.efectivo_bs_contado),
              );
              setNota(c.nota ?? "");
              setRehaciendo(true);
            }}
            className="text-sm text-marron-hondo underline-offset-4 hover:underline"
          >
            Rehacer el cierre
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-borde bg-crema-alto p-5">
      <p className="text-xs uppercase tracking-wide text-tinta-suave">
        {rehaciendo ? "Rehacer el cierre" : "Cerrar el día"}
      </p>
      <p className="mt-1 text-sm text-tinta-suave">
        Cuenten el efectivo que hay en la caja y anótenlo aquí.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="contado-usd"
            className="mb-1.5 block text-sm text-tinta-suave"
          >
            Efectivo en dólares
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="contado-usd"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={contadoUsd}
              onChange={(e) => setContadoUsd(e.target.value)}
              placeholder={String(esperadoUsd)}
              className="w-36 rounded-lg border border-borde bg-crema px-4 py-3 text-base tabular-nums outline-none focus:border-marron"
            />
            <Diferencia valor={difUsd} moneda="USD" />
          </div>
        </div>

        <div>
          <label
            htmlFor="contado-bs"
            className="mb-1.5 block text-sm text-tinta-suave"
          >
            Efectivo en bolívares
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="contado-bs"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={contadoBs}
              onChange={(e) => setContadoBs(e.target.value)}
              placeholder={String(esperadoBs)}
              className="w-36 rounded-lg border border-borde bg-crema px-4 py-3 text-base tabular-nums outline-none focus:border-marron"
            />
            <Diferencia valor={difBs} moneda="BS" />
          </div>
        </div>

        <div>
          <label htmlFor="nota" className="mb-1.5 block text-sm text-tinta-suave">
            Nota <span className="text-tinta-suave/60">(opcional)</span>
          </label>
          <input
            id="nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Faltan 5$ del vuelto de la clienta del vestido"
            className="w-full rounded-lg border border-borde bg-crema px-4 py-3 text-sm outline-none focus:border-marron"
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-alerta-tenue px-3 py-2 text-sm text-alerta"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {rehaciendo && (
          <button
            type="button"
            onClick={() => setRehaciendo(false)}
            className="rounded-xl border border-borde px-4 py-3 text-sm text-tinta-suave"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={cerrar}
          disabled={guardando}
          className="flex-1 rounded-xl bg-tinta px-4 py-3 text-base text-crema-alto disabled:opacity-50"
        >
          {guardando
            ? "Cerrando…"
            : rehaciendo
              ? "Guardar de nuevo"
              : "Cerrar caja"}
        </button>
      </div>
    </section>
  );
}
