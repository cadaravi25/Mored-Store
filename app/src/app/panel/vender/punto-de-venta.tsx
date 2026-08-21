"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { diaEnCaracas, enCorto } from "@/lib/fechas";
import PasoCliente, { type Elegido } from "./selector-cliente";

interface Variante {
  variante_id: string;
  producto_id: string;
  producto_nombre: string;
  color_nombre: string;
  color_hex: string | null;
  foto_url: string | null;
  talla: string;
  precio_usd: number;
  precio_bs: number;
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

// Los precios de la tienda son euros. La columna se llama precio_usd por
// herencia del esquema inicial, pero nunca tuvo dólares dentro.
const usd = new Intl.NumberFormat("es-VE", { style: "currency", currency: "EUR" });
const bs = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 });

export default function PuntoDeVenta({ tasaInicial }: { tasaInicial: number | null }) {
  const router = useRouter();

  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<Variante[]>([]);
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cobrando, setCobrando] = useState(false);
  const [cliente, setCliente] = useState<Elegido | null>(null);
  // Se puede cobrar sin registrar a nadie, pero tiene que ser una decisión.
  const [sinCliente, setSinCliente] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const [tasa, setTasa] = useState<number | null>(tasaInicial);
  const [tasaTexto, setTasaTexto] = useState("");
  const [vigencia, setVigencia] = useState<string | null>(null);
  const [tasaManual, setTasaManual] = useState(false);
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

  // La tasa se pone al día al abrir la pantalla, no solo al entrar a Finanzas.
  // Cobrar con la de ayer es un error silencioso: la venta se registra, nadie
  // ve nada raro, y el monto en bolívares queda mal.
  useEffect(() => {
    let vivo = true;
    fetch("/api/bcv", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => {
        if (!vivo || !d?.venta) return;
        setTasa(Number(d.venta.bs_por_usd));
        setVigencia(d.vigente?.fecha ?? null);
        setTasaManual(d.venta.base === "manual");
      })
      .catch(() => {
        // Sin conexión se sigue con la última guardada: no cobrar no es opción.
      });
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * El panel de la venta se queda mirando el final.
   *
   * Cada prenda entra por abajo y empuja el total y el botón de cobrar fuera
   * de la vista. En una venta de cinco o seis piezas eso obligaba a bajar a
   * mano cada vez, que con la tablet en la mano y la clienta esperando es lo
   * último que se quiere estar haciendo.
   *
   * Baja solo, y el desplazamiento queda para subir a revisar lo de arriba, que
   * es lo que casi nunca hace falta.
   */
  useEffect(() => {
    const caja = panel.current;
    if (!caja) return;
    caja.scrollTop = caja.scrollHeight;
  }, [carrito, pagos]);

  /**
   * Qué precio se cobra.
   *
   * Cada prenda tiene dos, y no son una conversión: el de divisas y el de
   * bolívares los fijan ellas por separado. Manda el método de pago que
   * escogieron. Mientras no haya ninguno, se enseña el de divisas, que es el
   * más bajo y el que la gente pregunta primero.
   *
   * Si mezclan divisas y bolívares en la misma venta, manda el primero: es
   * raro que pase y partir la venta en dos precios daría un total que no
   * cuadra con ninguno de los dos.
   */
  /**
   * La foto de una prenda, aunque ese color no tenga la suya.
   *
   * En la base la foto cuelga del color, y hay colores que todavía no tienen
   * una propia: heredan la primera del producto. La tienda ya resuelve esa
   * herencia, pero la búsqueda del panel devuelve el color pelado, así que
   * aquí se rearma. Si no, media pantalla de Vender sale con cuadros de color
   * y no se reconoce nada de un vistazo, que es justo para lo que sirve.
   */
  const fotoPorProducto = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const v of resultados) {
      if (v.foto_url && !mapa.has(v.producto_id)) mapa.set(v.producto_id, v.foto_url);
    }
    return mapa;
  }, [resultados]);

  const fotoDe = (v: Variante) => v.foto_url ?? fotoPorProducto.get(v.producto_id) ?? null;

  const enBs = pagos.length > 0 && pagos[0].moneda === "BS";
  const precioDe = (l: { precio_usd: number; precio_bs: number }) =>
    Number(enBs ? (l.precio_bs || l.precio_usd) : l.precio_usd);
  const mezclan =
    pagos.length > 1 && new Set(pagos.map((p) => p.moneda)).size > 1;

  const total = useMemo(
    () => carrito.reduce((s, l) => s + l.cantidad * precioDe(l), 0),
    [carrito, enBs],
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
        precio_unitario_usd: precioDe(l),
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
    setSinCliente(false);
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
                {/* La foto, que es como reconocen la prenda de un vistazo.
                    El cuadro de color se queda solo para las que todavía no
                    tienen: es más útil que un recuadro gris, porque al menos
                    dice de qué color es. */}
                {fotoDe(v) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={fotoDe(v)!}
                    alt=""
                    loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-lg border border-borde object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="h-12 w-12 shrink-0 rounded-lg border border-borde"
                    style={{ backgroundColor: v.color_hex ?? "#efe9dd" }}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-tinta">
                    {v.producto_nombre}
                  </span>
                  <span className="block text-xs text-tinta-suave">
                    {v.color_nombre} · {v.talla} · quedan {v.disponible}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-tinta">
                  {usd.format(precioDe(v))}
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

      {/* Se queda fija al desplazar la lista de prendas, pero con su propio
          desplazamiento por dentro. Sin eso, en cuanto la venta tiene cuatro o
          cinco líneas el panel crece más que la pantalla, y como está fijo, la
          página ya no lo mueve: el botón de cobrar queda debajo del borde y no
          hay forma de llegar a él. */}
      <aside
        ref={panel}
        className="space-y-3 lg:sticky lg:top-5 lg:max-h-[calc(100dvh-2.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1"
      >
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
                    {usd.format(l.cantidad * precioDe(l))}
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

          {/* Con qué tasa se está cobrando, a la vista. Si está mal, se nota
              antes de cobrar y no tres días después cuadrando la caja. */}
          <p className="mt-3 flex flex-wrap items-baseline justify-between gap-x-2 border-t border-borde pt-2 text-xs text-tinta-suave">
            <span>Tasa de hoy</span>
            {tasa ? (
              <span className="tabular-nums text-tinta">
                {bs.format(tasa)} Bs
                <span className="ml-1.5 text-tinta-suave">
                  {tasaManual
                    ? "puesta a mano"
                    : vigencia
                      ? `euro BCV del ${enCorto(vigencia)}`
                      : "euro BCV"}
                </span>
              </span>
            ) : (
              <span className="text-alerta">sin cargar</span>
            )}
          </p>

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
            <PasoCliente
              elegido={cliente}
              onElegir={setCliente}
              onOmitir={() => setSinCliente(true)}
            />

            {cliente && (
              <div className="flex items-center gap-2 rounded-xl bg-marron-tenue px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-tinta">
                  {cliente.nombre}
                </span>
                <button
                  type="button"
                  onClick={() => setCliente(null)}
                  aria-label="Cambiar de cliente"
                  className="shrink-0 text-sm text-tinta-suave hover:text-tinta"
                >
                  ×
                </button>
              </div>
            )}

            {sinCliente && !cliente && (
              <div className="flex items-center gap-2 rounded-xl border border-borde px-3 py-2">
                <span className="min-w-0 flex-1 text-sm text-tinta-suave">
                  Venta sin cliente
                </span>
                <button
                  type="button"
                  onClick={() => setSinCliente(false)}
                  className="shrink-0 text-xs text-marron-hondo underline-offset-4 hover:underline"
                >
                  registrar
                </button>
              </div>
            )}

            {(cliente || sinCliente) && (
              <>

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
                        {mezclan
                          ? "Métodos en divisas y en bolívares a la vez: se cobra el precio del primero"
                          : falta > 0.01
                          ? `Falta ${usd.format(falta)}`
                          : pagadoUsd - total > 0.01
                            ? `Vuelto ${usd.format(pagadoUsd - total)}`
                            : "Cuadra exacto"}
                      </p>
                    )}
              </>
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
                disabled={
                  guardando ||
                  pagos.length === 0 ||
                  falta > 0.01 ||
                  !(cliente || sinCliente)
                }
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
