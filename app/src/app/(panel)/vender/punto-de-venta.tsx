"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { diaEnCaracas } from "@/lib/fechas";
import SelectorCliente, { type Elegida } from "./selector-cliente";

interface Variante {
  variante_id: string;
  producto_nombre: string;
  color_nombre: string;
  color_hex: string | null;
  foto_url: string | null;
  talla: string;
  precio_usd: number;
  disponible: number;
}

interface Linea extends Variante {
  cantidad: number;
}

interface Pago {
  clave: string;
  metodo: string;
  moneda: "USD" | "BS";
  monto: string;
}

const METODOS: { id: string; nombre: string; moneda: "USD" | "BS" }[] = [
  { id: "efectivo_usd", nombre: "Efectivo $", moneda: "USD" },
  { id: "zelle", nombre: "Zelle", moneda: "USD" },
  { id: "binance", nombre: "Binance", moneda: "USD" },
  { id: "zinli", nombre: "Zinli", moneda: "USD" },
  { id: "pago_movil", nombre: "Pago móvil", moneda: "BS" },
  { id: "efectivo_bs", nombre: "Efectivo Bs", moneda: "BS" },
  { id: "transferencia", nombre: "Transferencia", moneda: "BS" },
  { id: "punto", nombre: "Punto", moneda: "BS" },
];

const usd = new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" });
const bs = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 });

export default function PuntoDeVenta({ tasaInicial }: { tasaInicial: number | null }) {
  const router = useRouter();

  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<Variante[]>([]);
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cobrando, setCobrando] = useState(false);
  const [cliente, setCliente] = useState<Elegida | null>(null);
  const [tasa, setTasa] = useState<number | null>(tasaInicial);
  const [tasaTexto, setTasaTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const supabase = crearClienteNavegador();
      const { data } = await supabase.rpc("buscar_variantes", {
        p_termino: termino,
      });
      setResultados(((data ?? []) as Variante[]).filter((v) => v.disponible > 0));
    }, 200);
    return () => clearTimeout(t);
  }, [termino]);

  const total = useMemo(
    () => carrito.reduce((s, l) => s + l.cantidad * Number(l.precio_usd), 0),
    [carrito],
  );

  const pagadoUsd = useMemo(
    () =>
      pagos.reduce((s, p) => {
        const m = Number(p.monto || 0);
        return s + (p.moneda === "BS" ? (tasa ? m / tasa : 0) : m);
      }, 0),
    [pagos, tasa],
  );

  const falta = Math.max(0, total - pagadoUsd);

  function agregar(v: Variante) {
    setCarrito((prev) => {
      const i = prev.findIndex((l) => l.variante_id === v.variante_id);
      if (i >= 0) {
        // No se bloquea pasarse del stock: si la prenda está en la mano de la
        // clienta, la venta es real y el equivocado es el sistema.
        const copia = [...prev];
        copia[i] = { ...copia[i], cantidad: copia[i].cantidad + 1 };
        return copia;
      }
      return [...prev, { ...v, cantidad: 1 }];
    });
  }

  function cambiar(id: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((l) =>
          l.variante_id === id ? { ...l, cantidad: l.cantidad + delta } : l,
        )
        .filter((l) => l.cantidad > 0),
    );
  }

  async function guardarTasa() {
    const valor = Number(tasaTexto);
    if (!valor || valor <= 0) return;
    const supabase = crearClienteNavegador();
    await supabase.from("tasas_venta").upsert({
      fecha: diaEnCaracas(),
      bs_por_usd: valor,
      base: "manual",
    });
    setTasa(valor);
  }

  async function cobrar() {
    setGuardando(true);
    setError(null);
    const supabase = crearClienteNavegador();
    const { error: fallo } = await supabase.rpc("registrar_venta_mostrador", {
      p_lineas: carrito.map((l) => ({
        variante_id: l.variante_id,
        cantidad: l.cantidad,
        precio_unitario_usd: Number(l.precio_usd),
      })),
      p_pagos: pagos.map((p) => ({
        metodo: p.metodo,
        moneda: p.moneda,
        monto: Number(p.monto || 0),
      })),
      p_canal: "tienda",
      p_tasa: tasa,
      p_cliente_id: cliente?.id ?? null,
    });

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setListo(total);
    setCarrito([]);
    setPagos([]);
    setCliente(null);
    setCobrando(false);
    setGuardando(false);
    setTermino("");
    router.refresh();
  }

  if (listo !== null) {
    return (
      <div className="mx-auto max-w-sm py-16 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-marron-suave bg-marron-tenue text-2xl text-marron-hondo">
          ✓
        </div>
        <p className="text-xl text-tinta">Venta registrada</p>
        <p className="mt-1 text-tinta-suave">{usd.format(listo)}</p>
        <button
          type="button"
          onClick={() => setListo(null)}
          className="mt-8 w-full rounded-xl bg-tinta px-4 py-3.5 text-crema-alto"
        >
          Nueva venta
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <input
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          placeholder="top blanco, talla s…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-xl border border-borde bg-crema-alto px-4 py-3.5 text-base outline-none placeholder:text-tinta-suave/50 focus:border-marron"
        />

        <ul className="grid gap-2 sm:grid-cols-2">
          {resultados.map((v) => (
            <li key={v.variante_id}>
              <button
                type="button"
                onClick={() => agregar(v)}
                className="flex w-full items-center gap-3 rounded-xl border border-borde bg-crema-alto p-3 text-left transition-colors hover:border-marron-suave"
              >
                <span
                  aria-hidden
                  className="h-12 w-12 shrink-0 rounded-lg border border-borde"
                  style={{ backgroundColor: v.color_hex ?? "#efe9dd" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-tinta">
                    {v.producto_nombre}
                  </span>
                  <span className="block text-xs text-tinta-suave">
                    {v.color_nombre} · {v.talla} · quedan {v.disponible}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-tinta">
                  {usd.format(Number(v.precio_usd))}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {resultados.length === 0 && (
          <p className="rounded-xl border border-borde bg-crema-alto px-5 py-10 text-center text-sm text-tinta-suave">
            {termino ? "Nada disponible con esa búsqueda." : "Busca una prenda para empezar."}
          </p>
        )}
      </section>

      <aside className="space-y-3 lg:sticky lg:top-5 lg:self-start">
        <div className="rounded-2xl border border-borde bg-crema-alto p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-tinta-suave">
            Venta
          </p>

          {carrito.length === 0 ? (
            <p className="py-6 text-center text-sm text-tinta-suave">
              Sin prendas todavía
            </p>
          ) : (
            <ul className="divide-y divide-borde">
              {carrito.map((l) => (
                <li key={l.variante_id} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-tinta">
                      {l.producto_nombre}
                    </p>
                    <p className="text-xs text-tinta-suave">
                      {l.color_nombre} · {l.talla}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => cambiar(l.variante_id, -1)}
                    className="h-8 w-8 rounded-lg border border-borde"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm tabular-nums">
                    {l.cantidad}
                  </span>
                  <button
                    type="button"
                    onClick={() => cambiar(l.variante_id, 1)}
                    className="h-8 w-8 rounded-lg border border-borde"
                  >
                    +
                  </button>
                  <span className="w-16 shrink-0 text-right text-sm tabular-nums text-tinta">
                    {usd.format(l.cantidad * Number(l.precio_usd))}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-baseline justify-between border-t border-borde pt-3">
            <span className="text-tinta-suave">Total</span>
            <span className="text-2xl tabular-nums text-tinta">
              {usd.format(total)}
            </span>
          </div>
          {tasa && total > 0 && (
            <p className="mt-1 text-right text-sm text-tinta-suave tabular-nums">
              {bs.format(total * tasa)} Bs
            </p>
          )}

          {carrito.length > 0 && !cobrando && (
            <button
              type="button"
              onClick={() => setCobrando(true)}
              className="mt-4 w-full rounded-xl bg-tinta px-4 py-3.5 text-crema-alto"
            >
              Cobrar
            </button>
          )}
        </div>

        {cobrando && (
          <div className="space-y-3 rounded-2xl border border-borde bg-crema-alto p-4">
            <SelectorCliente elegida={cliente} onElegir={setCliente} />

            {!tasa && (
              <div className="rounded-xl bg-marron-tenue p-3">
                <p className="mb-2 text-sm text-tinta">
                  Falta la tasa de hoy para poder cobrar en bolívares.
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={tasaTexto}
                    onChange={(e) => setTasaTexto(e.target.value)}
                    placeholder="Bs por dólar"
                    className="min-w-0 flex-1 rounded-lg border border-borde bg-crema px-3 py-2 text-sm tabular-nums outline-none focus:border-marron"
                  />
                  <button
                    type="button"
                    onClick={guardarTasa}
                    className="shrink-0 rounded-lg bg-tinta px-4 py-2 text-sm text-crema-alto"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {METODOS.filter((m) => m.moneda === "USD" || tasa).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    setPagos((p) => [
                      ...p,
                      {
                        clave: crypto.randomUUID(),
                        metodo: m.id,
                        moneda: m.moneda,
                        // Sugiere lo que falta: en la mayoría de las ventas se
                        // paga todo con un solo método y no hay que teclear.
                        monto:
                          m.moneda === "BS" && tasa
                            ? (falta * tasa).toFixed(2)
                            : falta.toFixed(2),
                      },
                    ])
                  }
                  className="rounded-full border border-borde bg-crema px-3 py-2 text-sm text-tinta"
                >
                  {m.nombre}
                </button>
              ))}
            </div>

            {pagos.map((p) => {
              const m = METODOS.find((x) => x.id === p.metodo)!;
              return (
                <div key={p.clave} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-sm text-tinta-suave">
                    {m.nombre}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={p.monto}
                    onChange={(e) =>
                      setPagos((prev) =>
                        prev.map((x) =>
                          x.clave === p.clave ? { ...x, monto: e.target.value } : x,
                        ),
                      )
                    }
                    className="min-w-0 flex-1 rounded-lg border border-borde bg-crema px-3 py-2 text-sm tabular-nums outline-none focus:border-marron"
                  />
                  <span className="w-7 shrink-0 text-xs text-tinta-suave">
                    {p.moneda === "BS" ? "Bs" : "$"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPagos((prev) => prev.filter((x) => x.clave !== p.clave))
                    }
                    aria-label="Quitar"
                    className="shrink-0 px-1 text-tinta-suave"
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            {pagos.length > 0 && (
              <p className="text-right text-sm tabular-nums text-tinta-suave">
                {falta > 0.01
                  ? `Falta ${usd.format(falta)}`
                  : pagadoUsd - total > 0.01
                    ? `Vuelto ${usd.format(pagadoUsd - total)}`
                    : "Cuadra exacto"}
              </p>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-alerta-tenue px-3 py-2 text-sm text-alerta">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCobrando(false)}
                className="rounded-xl border border-borde px-4 py-3 text-sm text-tinta-suave"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={cobrar}
                disabled={guardando || pagos.length === 0 || falta > 0.01}
                className="flex-1 rounded-xl bg-tinta px-4 py-3 text-crema-alto disabled:opacity-40"
              >
                {guardando ? "Registrando…" : "Confirmar venta"}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
