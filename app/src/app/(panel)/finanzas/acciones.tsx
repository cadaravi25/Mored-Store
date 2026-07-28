"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

const CATEGORIAS = [
  "importacion",
  "alquiler",
  "publicidad",
  "servicios",
  "sueldos",
  "transporte",
  "otro",
];

const METODOS = [
  { id: "efectivo_usd", nombre: "Efectivo $", moneda: "USD" as const },
  { id: "zelle", nombre: "Zelle", moneda: "USD" as const },
  { id: "binance", nombre: "Binance", moneda: "USD" as const },
  { id: "efectivo_bs", nombre: "Efectivo Bs", moneda: "BS" as const },
  { id: "pago_movil", nombre: "Pago móvil", moneda: "BS" as const },
  { id: "transferencia", nombre: "Transferencia", moneda: "BS" as const },
];

export function ActualizarTasas() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function actualizar() {
    setCargando(true);
    setError(null);
    const r = await fetch("/api/bcv", { method: "POST" });
    if (!r.ok) {
      const cuerpo = await r.json().catch(() => ({}));
      setError(cuerpo.error ?? "No se pudo consultar el BCV.");
    } else {
      router.refresh();
    }
    setCargando(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={actualizar}
        disabled={cargando}
        className="text-sm text-dorado underline-offset-4 hover:underline disabled:opacity-50"
      >
        {cargando ? "Consultando…" : "Actualizar del BCV"}
      </button>
      {error && <p className="mt-1 text-xs text-alerta">{error}</p>}
    </div>
  );
}

export function NuevoMovimiento({ tasa }: { tasa: number | null }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<"egreso" | "ingreso">("egreso");
  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState("otro");
  const [metodo, setMetodo] = useState(METODOS[0]);
  const [monto, setMonto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const valor = Number(monto);
    if (!concepto.trim() || !valor || valor <= 0) return;
    if (metodo.moneda === "BS" && !tasa) {
      setError("Falta la tasa del día para registrar montos en bolívares.");
      return;
    }

    setGuardando(true);
    setError(null);

    const montoUsd = metodo.moneda === "BS" ? valor / tasa! : valor;
    const supabase = crearClienteNavegador();
    const { error: fallo } = await supabase.from("movimientos_financieros").insert({
      tipo,
      concepto: concepto.trim(),
      categoria: tipo === "egreso" ? categoria : null,
      monto_original: valor,
      moneda: metodo.moneda,
      monto_usd: Number(montoUsd.toFixed(2)),
      tasa_usada: metodo.moneda === "BS" ? tasa : null,
      cuenta: metodo.moneda === "BS" ? "bs" : "divisa",
      metodo_pago: metodo.id,
      origen: "manual",
    });

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setConcepto("");
    setMonto("");
    setAbierto(false);
    setGuardando(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-xl border border-borde bg-crema-alto px-4 py-2.5 text-sm text-tinta hover:border-dorado-claro"
      >
        Registrar movimiento
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-borde bg-crema-alto p-4">
      <div className="flex gap-2">
        {(["egreso", "ingreso"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={`rounded-full border px-4 py-2 text-sm capitalize ${
              tipo === t
                ? "border-dorado bg-dorado text-crema-alto"
                : "border-borde bg-crema text-tinta"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <input
        value={concepto}
        onChange={(e) => setConcepto(e.target.value)}
        placeholder="Concepto"
        className="w-full rounded-lg border border-borde bg-crema px-4 py-2.5 text-sm outline-none focus:border-dorado"
      />

      {tipo === "egreso" && (
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="w-full rounded-lg border border-borde bg-crema px-4 py-2.5 text-sm capitalize outline-none focus:border-dorado"
        >
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}

      <div className="flex gap-2">
        <select
          value={metodo.id}
          onChange={(e) =>
            setMetodo(METODOS.find((m) => m.id === e.target.value)!)
          }
          className="min-w-0 flex-1 rounded-lg border border-borde bg-crema px-3 py-2.5 text-sm outline-none focus:border-dorado"
        >
          {METODOS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder={metodo.moneda === "BS" ? "Bs" : "$"}
          className="w-28 shrink-0 rounded-lg border border-borde bg-crema px-3 py-2.5 text-sm tabular-nums outline-none focus:border-dorado"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-alerta-tenue px-3 py-2 text-sm text-alerta">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-xl border border-borde px-4 py-2.5 text-sm text-tinta-suave"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="flex-1 rounded-xl bg-tinta px-4 py-2.5 text-sm text-crema-alto disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
