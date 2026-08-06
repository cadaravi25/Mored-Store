"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { conDiaSemana, diaEnCaracas, enCorto } from "@/lib/fechas";

interface Tasa {
  fecha: string;
  bs_por_usd: number | null;
  bs_por_eur: number | null;
}

interface Estado {
  vigente: Tasa | null;
  proxima: Tasa | null;
  venta: { fecha: string; bs_por_usd: number; base: string } | null;
  sinConexion: boolean;
}

const bs = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Acepta 1.234,56 y 1234.56: en la tablet se escribe como salga. */
function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(/\s/g, "");
  if (!limpio) return null;
  const normal = limpio.includes(",")
    ? limpio.replace(/\./g, "").replace(",", ".")
    : limpio;
  const n = Number(normal);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function Moneda({
  simbolo,
  valor,
  destacada,
}: {
  simbolo: string;
  valor: number | null;
  destacada?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm ${
          destacada
            ? "bg-marron text-crema-alto"
            : "bg-marron-tenue text-marron-hondo"
        }`}
      >
        {simbolo}
      </span>
      <span
        className={`text-sm tabular-nums ${
          destacada ? "text-tinta" : "text-tinta-suave"
        }`}
      >
        {valor === null ? "—" : `Bs ${bs.format(valor)}`}
      </span>
    </div>
  );
}

export function BarraTasas({ tasaVenta }: { tasaVenta: number | null }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [monto, setMonto] = useState("");

  async function traer(forzar = false) {
    setCargando(true);
    setError("");
    try {
      const r = await fetch("/api/bcv", {
        method: forzar ? "POST" : "GET",
        cache: "no-store",
      });
      if (!r.ok) throw new Error();
      setEstado((await r.json()) as Estado);
      // La tasa de venta pudo haberse puesto sola en esta consulta, y el resto
      // de la pantalla se renderiza en el servidor.
      if (forzar) router.refresh();
    } catch {
      setError("Sin tasa");
    }
    setCargando(false);
  }

  // Al abrir finanzas se consulta sola: si falta la de hoy, la trae y la
  // guarda sin que nadie tenga que acordarse.
  useEffect(() => {
    let vivo = true;
    fetch("/api/bcv", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: Estado) => {
        if (!vivo) return;
        setEstado(d);
        setCargando(false);
        // Solo se vuelve a pintar la pantalla si la consulta cambió algo:
        // refrescar siempre sería pedirle al servidor un trabajo que ya hizo.
        if (d.venta && Number(d.venta.bs_por_usd) !== tasaVenta) {
          router.refresh();
        }
      })
      .catch(() => {
        if (!vivo) return;
        setError("Sin tasa");
        setCargando(false);
      });
    return () => {
      vivo = false;
    };
    // Una sola vez al montar: es una consulta de apertura, no un suscriptor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const factor = aNumero(monto) ?? 1;
  const v = estado?.vigente;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-borde bg-crema-alto px-4 py-2.5">
      <Moneda
        simbolo="€"
        valor={v?.bs_por_eur ? Number(v.bs_por_eur) * factor : null}
        destacada
      />
      <Moneda
        simbolo="$"
        valor={v?.bs_por_usd ? Number(v.bs_por_usd) * factor : null}
      />

      <label className="flex items-center gap-2">
        <span className="sr-only">Convertir un monto</span>
        <input
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          inputMode="decimal"
          placeholder="1"
          className="w-20 rounded-full border border-borde bg-crema px-3 py-1.5 text-sm tabular-nums outline-none focus:border-marron"
        />
      </label>

      {estado?.proxima?.bs_por_eur && (
        <span
          className="rounded-full bg-marron-tenue px-2.5 py-1 text-[11px] text-marron-hondo"
          title="El BCV publica a las 4 p.m. la tasa del próximo día hábil"
        >
          próxima {enCorto(estado.proxima.fecha)}: €{" "}
          {bs.format(Number(estado.proxima.bs_por_eur))}
        </span>
      )}

      <div className="flex items-center gap-2.5 text-[11px] text-tinta-suave">
        {v && <span>Vigente {conDiaSemana(v.fecha)}</span>}
        {estado?.sinConexion && (
          <span className="text-alerta">sin conexión</span>
        )}
        {error && <span className="text-alerta">{error}</span>}
        <button
          type="button"
          onClick={() => traer(true)}
          disabled={cargando}
          aria-label="Actualizar del BCV"
          className="grid h-7 w-7 place-items-center rounded-full border border-borde text-tinta-suave hover:bg-crema disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 11-2.6-6.4" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * La tasa con la que el sistema convierte a bolívares.
 *
 * Normalmente se pone sola con el euro del BCV, que es como cobran. Se deja
 * cambiar a mano porque el día que decidan cobrar distinto, la alternativa
 * sería que alguien lo escriba mal en cada venta.
 */
export function TasaDeVenta({
  tasa,
  base,
  fecha,
}: {
  tasa: number | null;
  base: string | null;
  fecha: string | null;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoy = diaEnCaracas();
  const alDia = fecha === hoy;

  async function guardar() {
    const valor = aNumero(texto);
    if (!valor) return;
    setGuardando(true);
    setError(null);

    const { error: fallo } = await crearClienteNavegador()
      .from("tasas_venta")
      .upsert(
        { fecha: hoy, bs_por_usd: valor, base: "manual" },
        { onConflict: "fecha" },
      );

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }
    setEditando(false);
    setGuardando(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-borde bg-crema-alto p-5">
      <p className="text-xs uppercase tracking-wide text-tinta-suave">
        Tasa que aplica el sistema
      </p>

      <p className="mt-3 text-3xl tabular-nums text-marron-hondo">
        {tasa === null ? "—" : bs.format(tasa)}
      </p>
      <p className="mt-1 text-xs text-tinta-suave">
        {tasa === null
          ? "Todavía no hay ninguna guardada."
          : base === "manual"
            ? `Puesta a mano${fecha ? `, el ${enCorto(fecha)}` : ""}`
            : `Euro del BCV${fecha ? `, del ${enCorto(fecha)}` : ""}`}
        {tasa !== null && !alDia && (
          <span className="text-alerta"> · no es la de hoy</span>
        )}
      </p>

      {editando ? (
        <div className="mt-4 space-y-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            inputMode="decimal"
            autoFocus
            placeholder={tasa === null ? "Bs por dólar" : bs.format(tasa)}
            className="w-full rounded-lg border border-borde bg-crema px-4 py-2.5 text-sm tabular-nums outline-none focus:border-marron"
          />
          {error && <p className="text-xs text-alerta">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-xl border border-borde px-4 py-2 text-sm text-tinta-suave"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="flex-1 rounded-xl bg-tinta px-4 py-2 text-sm text-crema-alto disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Usar esta tasa hoy"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setTexto("");
            setEditando(true);
          }}
          className="mt-4 text-sm text-marron-hondo underline-offset-4 hover:underline"
        >
          Cambiar la de hoy
        </button>
      )}
    </div>
  );
}
