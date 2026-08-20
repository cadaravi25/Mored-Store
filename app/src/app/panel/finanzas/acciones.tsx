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

const usd = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});
const bs = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 });

/** Dónde vive el dinero. Un cambio lo mueve de una a la otra. */
const CAJAS = {
  divisa: [
    { id: "efectivo_usd", nombre: "Efectivo $" },
    { id: "zelle", nombre: "Zelle" },
    { id: "binance", nombre: "Binance" },
  ],
  bs: [
    { id: "efectivo_bs", nombre: "Efectivo Bs" },
    { id: "pago_movil", nombre: "Pago móvil" },
    { id: "transferencia", nombre: "Transferencia" },
  ],
} as const;

/**
 * El monto tal como lo escribe una persona en Venezuela.
 *
 * Aquí la coma es el separador decimal y el punto separa los miles: "1.250,50"
 * son mil doscientos cincuenta con cincuenta. JavaScript lee justo al revés,
 * así que hay que darle la vuelta antes de convertir.
 *
 * El campo tampoco puede ser type="number": con ese tipo, el navegador en
 * español descarta lo que escribes en cuanto pones la coma y devuelve cadena
 * vacía. El monto se quedaba en cero y Guardar no hacía nada.
 */
function leerMonto(texto: string): number {
  const limpio = texto.trim().replace(/\s/g, "");
  if (!limpio) return 0;

  const conComa = limpio.includes(",");
  const normal = conComa
    ? limpio.replace(/\./g, "").replace(",", ".")
    : limpio;

  const n = Number(normal);
  return Number.isFinite(n) ? n : 0;
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
    const valor = leerMonto(monto);

    // Antes esto se salía sin decir nada: si el monto no valía, no pasaba
    // absolutamente nada al pulsar Guardar y no había forma de saber por qué.
    if (!concepto.trim()) {
      setError("Falta el concepto.");
      return;
    }
    if (!valor || valor <= 0) {
      setError("El monto tiene que ser mayor que cero.");
      return;
    }
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
        className="rounded-xl border border-borde bg-crema-alto px-4 py-2.5 text-sm text-tinta hover:border-marron-suave"
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
                ? "border-marron bg-marron text-crema-alto"
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
        className="w-full rounded-lg border border-borde bg-crema px-4 py-2.5 text-sm outline-none focus:border-marron"
      />

      {tipo === "egreso" && (
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="w-full rounded-lg border border-borde bg-crema px-4 py-2.5 text-sm capitalize outline-none focus:border-marron"
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
          className="min-w-0 flex-1 rounded-lg border border-borde bg-crema px-3 py-2.5 text-sm outline-none focus:border-marron"
        >
          {METODOS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder={metodo.moneda === "BS" ? "Bs" : "$"}
          className="w-28 shrink-0 rounded-lg border border-borde bg-crema px-3 py-2.5 text-sm tabular-nums outline-none focus:border-marron"
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

/**
 * Cambio de divisas.
 *
 * Sacar dólares de una caja y meter bolívares en otra, o al revés. NO es un
 * ingreso ni un gasto: el negocio no ganó ni perdió nada, el mismo dinero
 * cambió de sitio. Confundir eso es el error contable clásico de este tipo de
 * negocio, y por eso el reporte de finanzas deja los cambios fuera de las dos
 * columnas.
 *
 * Se guardan DOS movimientos, uno por caja, atados por la misma referencia:
 * uno que saca de donde salió y otro que mete donde entró. Con una sola fila
 * no se podría saber de qué caja salió el dinero.
 *
 * La tasa se escribe a mano y no se toma la del BCV a propósito: cambiar en la
 * calle nunca es a la tasa oficial, y guardar la del día haría que las cuentas
 * no cuadraran con lo que de verdad entró en la caja.
 */
export function NuevoCambio() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [haciaBs, setHaciaBs] = useState(true);
  const [origen, setOrigen] = useState<string>(CAJAS.divisa[0].id);
  const [destino, setDestino] = useState<string>(CAJAS.bs[0].id);
  const [monto, setMonto] = useState("");
  const [tasa, setTasa] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dolares = leerMonto(monto);
  const cambio = leerMonto(tasa);
  const bolivares = dolares && cambio ? dolares * cambio : 0;

  function girar() {
    const aBs = !haciaBs;
    setHaciaBs(aBs);
    setOrigen(aBs ? CAJAS.divisa[0].id : CAJAS.bs[0].id);
    setDestino(aBs ? CAJAS.bs[0].id : CAJAS.divisa[0].id);
  }

  async function guardar() {
    if (!dolares || dolares <= 0) {
      setError("Falta cuánto se cambió.");
      return;
    }
    if (!cambio || cambio <= 0) {
      setError("Falta la tasa a la que se cambió.");
      return;
    }

    setGuardando(true);
    setError(null);

    // Ata las dos mitades del mismo cambio.
    const referencia = crypto.randomUUID();
    const enDivisa = {
      tipo: "cambio",
      concepto: haciaBs ? "Cambio de dólares a bolívares" : "Cambio de bolívares a dólares",
      monto_original: dolares,
      moneda: "USD",
      monto_usd: dolares,
      cuenta: "divisa",
      metodo_pago: haciaBs ? origen : destino,
      origen: "manual",
      referencia_id: referencia,
    };
    const enBs = {
      ...enDivisa,
      monto_original: Number(bolivares.toFixed(2)),
      moneda: "BS",
      tasa_usada: cambio,
      cuenta: "bs",
      metodo_pago: haciaBs ? destino : origen,
    };

    const { error: fallo } = await crearClienteNavegador()
      .from("movimientos_financieros")
      .insert([enDivisa, enBs]);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setMonto("");
    setTasa("");
    setAbierto(false);
    setGuardando(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-xl border border-borde bg-crema-alto px-4 py-2.5 text-sm text-tinta hover:border-marron-suave"
      >
        Registrar cambio
      </button>
    );
  }

  const cajasOrigen = haciaBs ? CAJAS.divisa : CAJAS.bs;
  const cajasDestino = haciaBs ? CAJAS.bs : CAJAS.divisa;

  return (
    <div className="space-y-3 rounded-2xl border border-borde bg-crema-alto p-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-tinta">
          {haciaBs ? "De dólares a bolívares" : "De bolívares a dólares"}
        </p>
        <button
          type="button"
          onClick={girar}
          className="rounded-full border border-borde px-3 py-1 text-xs text-tinta-suave hover:border-marron-suave"
        >
          Al revés
        </button>
      </div>

      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs text-tinta-suave">Sale de</span>
          <select
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            className="w-full rounded-lg border border-borde bg-crema px-3 py-2.5 text-sm outline-none focus:border-marron"
          >
            {cajasOrigen.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs text-tinta-suave">Entra en</span>
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className="w-full rounded-lg border border-borde bg-crema px-3 py-2.5 text-sm outline-none focus:border-marron"
          >
            {cajasDestino.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs text-tinta-suave">Dólares</span>
          <input
            type="text"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="100"
            className="w-full rounded-lg border border-borde bg-crema px-3 py-2.5 text-sm tabular-nums outline-none focus:border-marron"
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs text-tinta-suave">Tasa</span>
          <input
            type="text"
            inputMode="decimal"
            value={tasa}
            onChange={(e) => setTasa(e.target.value)}
            placeholder="Bs por $"
            className="w-full rounded-lg border border-borde bg-crema px-3 py-2.5 text-sm tabular-nums outline-none focus:border-marron"
          />
        </label>
      </div>

      {/* El resultado a la vista antes de guardar: es la cifra que tiene que
          coincidir con lo que de verdad entró en la caja. */}
      <div className="rounded-xl bg-marron-tenue px-3 py-2.5 text-sm">
        {bolivares > 0 ? (
          haciaBs ? (
            <>
              Salen <b className="tabular-nums">{usd.format(dolares)}</b> y entran{" "}
              <b className="tabular-nums">{bs.format(bolivares)} Bs</b>
            </>
          ) : (
            <>
              Salen <b className="tabular-nums">{bs.format(bolivares)} Bs</b> y entran{" "}
              <b className="tabular-nums">{usd.format(dolares)}</b>
            </>
          )
        ) : (
          <span className="text-tinta-suave">
            Escribe cuántos dólares y a qué tasa.
          </span>
        )}
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
          {guardando ? "Guardando…" : "Guardar cambio"}
        </button>
      </div>
    </div>
  );
}
