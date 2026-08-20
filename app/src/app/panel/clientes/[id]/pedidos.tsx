"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { enCorto } from "@/lib/fechas";

const usd = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

const METODOS = [
  { id: "efectivo_usd", nombre: "Efectivo $", moneda: "USD" as const },
  { id: "zelle", nombre: "Zelle", moneda: "USD" as const },
  { id: "binance", nombre: "Binance", moneda: "USD" as const },
  { id: "efectivo_bs", nombre: "Efectivo Bs", moneda: "BS" as const },
  { id: "pago_movil", nombre: "Pago móvil", moneda: "BS" as const },
  { id: "transferencia", nombre: "Transferencia", moneda: "BS" as const },
];

interface Pieza {
  linea_id: string;
  variante_id: string;
  cantidad: number;
  precio_unitario_usd: number;
  producto: string;
  descripcion: string | null;
  color: string;
  talla: string;
  foto_url: string | null;
  ya_cambiadas: number;
}

interface Pedido {
  venta_id: string;
  serie: string;
  numero: number;
  creado_at: string;
  estado: string;
  total_usd: number;
  es_cambio: boolean;
  lineas: Pieza[];
}

interface Candidata {
  variante_id: string;
  producto_nombre: string;
  color_nombre: string;
  talla: string;
  precio_usd: number;
  disponible: number;
  foto_url: string | null;
}

/** Lo que se lleva a cambio, ya escogido. */
interface Escogida extends Candidata {
  cantidad: number;
}

/**
 * Los pedidos de una clienta, con el cambio de prenda dentro.
 *
 * El cambio empieza donde empieza en la vida real: alguien llega con una
 * prenda y se pregunta de qué compra salió. Por eso vive en su ficha y no en
 * una pantalla de ventas aparte.
 */
export default function Pedidos({
  clienteId,
  tasa,
}: {
  clienteId: string;
  tasa: number | null;
}) {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState<Pieza | null>(null);

  const traer = useCallback(async () => {
    setCargando(true);
    const { data } = await crearClienteNavegador().rpc("ventas_de_cliente", {
      p_cliente: clienteId,
    });
    setPedidos((data ?? []) as Pedido[]);
    setCargando(false);
  }, [clienteId]);

  useEffect(() => {
    traer();
  }, [traer]);

  if (cargando) {
    return (
      <section className="mt-3 rounded-2xl border border-borde bg-crema-alto p-5">
        <p className="py-10 text-center text-sm text-tinta-suave">Buscando…</p>
      </section>
    );
  }

  return (
    <section className="mt-3 rounded-2xl border border-borde bg-crema-alto p-5">
      <p className="text-xs uppercase tracking-wide text-tinta-suave">
        Pedidos realizados
      </p>

      {pedidos.length === 0 ? (
        <p className="py-10 text-center text-sm text-tinta-suave">
          Todavía no tiene compras registradas.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-borde">
          {pedidos.map((v) => {
            const desplegado = abierto === v.venta_id;
            return (
              <li key={v.venta_id} className="py-3">
                <button
                  type="button"
                  onClick={() => setAbierto(desplegado ? null : v.venta_id)}
                  className="flex w-full items-baseline justify-between gap-3 text-left"
                >
                  <span className="text-sm text-tinta">
                    {v.serie}-{v.numero}
                    {v.es_cambio && (
                      <span className="ml-2 rounded-full border border-borde px-2 py-0.5 text-xs text-tinta-suave">
                        cambio
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-tinta-suave">
                    {enCorto(v.creado_at.slice(0, 10))} ·{" "}
                    {v.lineas.length}{" "}
                    {v.lineas.length === 1 ? "prenda" : "prendas"}
                  </span>
                  <span className="text-sm tabular-nums text-tinta">
                    {usd.format(Number(v.total_usd))}
                    <span
                      aria-hidden
                      className="ml-2 inline-block text-tinta-suave transition-transform"
                      style={{ transform: desplegado ? "rotate(180deg)" : undefined }}
                    >
                      ⌄
                    </span>
                  </span>
                </button>

                {desplegado && (
                  <ul className="mt-3 space-y-2">
                    {v.lineas.map((l) => {
                      const quedan = l.cantidad - l.ya_cambiadas;
                      return (
                        <li
                          key={l.linea_id}
                          className="flex items-center gap-3 rounded-xl border border-borde bg-crema p-2.5"
                        >
                          {l.foto_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={l.foto_url}
                              alt=""
                              className="h-14 w-14 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <span className="h-14 w-14 shrink-0 rounded-lg border border-dashed border-marron-suave" />
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-tinta">
                              {l.cantidad > 1 && `${l.cantidad}× `}
                              {l.producto}
                            </p>
                            <p className="truncate text-xs capitalize text-tinta-suave">
                              {l.color} · {l.talla}
                            </p>
                            <p className="text-xs tabular-nums text-tinta-suave">
                              {usd.format(Number(l.precio_unitario_usd))}
                            </p>
                          </div>

                          {quedan > 0 ? (
                            <button
                              type="button"
                              onClick={() => setCambiando(l)}
                              className="shrink-0 rounded-lg border border-marron-suave bg-marron-tenue px-3 py-1.5 text-xs text-tinta"
                            >
                              Cambiar
                            </button>
                          ) : (
                            <span className="shrink-0 text-xs text-tinta-suave">
                              ya cambiada
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {cambiando && (
        <Cambio
          pieza={cambiando}
          tasa={tasa}
          onCerrar={() => setCambiando(null)}
          onHecho={() => {
            setCambiando(null);
            traer();
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

/**
 * El cambio en sí.
 *
 * Se escoge del inventario completo, sin restricción de tipo ni de precio por
 * pieza: lo único que manda es que la suma quede igual o por encima de lo que
 * se devuelve. Si queda por encima, se cobra la diferencia antes de cerrar.
 */
function Cambio({
  pieza,
  tasa,
  onCerrar,
  onHecho,
}: {
  pieza: Pieza;
  tasa: number | null;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [termino, setTermino] = useState("");
  const [candidatas, setCandidatas] = useState<Candidata[]>([]);
  const [escogidas, setEscogidas] = useState<Escogida[]>([]);
  const [metodo, setMetodo] = useState(METODOS[0]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const credito = Number(pieza.precio_unitario_usd);
  const llevado = escogidas.reduce(
    (s, x) => s + x.cantidad * Number(x.precio_usd),
    0,
  );
  const diferencia = Number((llevado - credito).toFixed(2));
  const alcanza = escogidas.length > 0 && diferencia >= 0;

  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await crearClienteNavegador().rpc("buscar_variantes", {
        p_termino: termino,
        p_limite: 60,
      });
      setCandidatas((data ?? []) as Candidata[]);
    }, 250);
    return () => clearTimeout(t);
  }, [termino]);

  function agregar(c: Candidata) {
    setEscogidas((prev) => {
      const i = prev.findIndex((x) => x.variante_id === c.variante_id);
      if (i >= 0) {
        const copia = [...prev];
        copia[i] = { ...copia[i], cantidad: copia[i].cantidad + 1 };
        return copia;
      }
      return [...prev, { ...c, cantidad: 1 }];
    });
  }

  function quitar(id: string) {
    setEscogidas((prev) =>
      prev
        .map((x) => (x.variante_id === id ? { ...x, cantidad: x.cantidad - 1 } : x))
        .filter((x) => x.cantidad > 0),
    );
  }

  async function guardar() {
    if (!alcanza) {
      setError("Lo que se lleva tiene que valer igual o más que lo que devuelve.");
      return;
    }
    if (diferencia > 0 && metodo.moneda === "BS" && !tasa) {
      setError("Falta la tasa del día para cobrar en bolívares.");
      return;
    }

    setGuardando(true);
    setError(null);

    const pagos =
      diferencia > 0
        ? [
            {
              metodo: metodo.id,
              moneda: metodo.moneda,
              monto:
                metodo.moneda === "BS"
                  ? Number((diferencia * tasa!).toFixed(2))
                  : diferencia,
            },
          ]
        : [];

    const { error: fallo } = await crearClienteNavegador().rpc("registrar_cambio", {
      p_linea_id: pieza.linea_id,
      p_cantidad: 1,
      p_nuevas: escogidas.map((x) => ({
        variante_id: x.variante_id,
        cantidad: x.cantidad,
        precio_unitario_usd: Number(x.precio_usd),
      })),
      p_pagos: pagos,
      p_tasa: tasa,
    });

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setGuardando(false);
    onHecho();
  }

  return (
    <div className="mt-4 rounded-2xl border border-marron-suave bg-crema p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-tinta">
          Cambio de{" "}
          <b className="capitalize">
            {pieza.producto} {pieza.color} · {pieza.talla}
          </b>
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="shrink-0 text-sm text-tinta-suave underline-offset-4 hover:underline"
        >
          Cancelar
        </button>
      </div>
      <p className="mt-0.5 text-xs text-tinta-suave">
        Se le abonan {usd.format(credito)}
      </p>

      {escogidas.length > 0 && (
        <ul className="mt-3 divide-y divide-borde rounded-xl border border-borde bg-crema-alto px-3">
          {escogidas.map((x) => (
            <li key={x.variante_id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-tinta">
                  {x.cantidad > 1 && `${x.cantidad}× `}
                  {x.producto_nombre}
                </p>
                <p className="truncate text-xs capitalize text-tinta-suave">
                  {x.color_nombre} · {x.talla}
                </p>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-tinta">
                {usd.format(x.cantidad * Number(x.precio_usd))}
              </span>
              <button
                type="button"
                onClick={() => quitar(x.variante_id)}
                aria-label={`Quitar ${x.producto_nombre}`}
                className="shrink-0 rounded-lg border border-borde px-2 py-1 text-xs text-tinta-suave"
              >
                −
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* La cuenta a la vista antes de cerrar: es lo que hay que decirle a la
          clienta en voz alta. */}
      <div
        className={`mt-3 rounded-xl px-3 py-2.5 text-sm ${
          escogidas.length === 0
            ? "bg-crema-alto text-tinta-suave"
            : diferencia < 0
              ? "bg-alerta-tenue text-alerta"
              : "bg-marron-tenue text-tinta"
        }`}
      >
        {escogidas.length === 0 ? (
          "Escoge del inventario lo que se lleva."
        ) : diferencia < 0 ? (
          <>
            Falta {usd.format(-diferencia)}. Lo que se lleva vale{" "}
            {usd.format(llevado)} y devuelve {usd.format(credito)}.
          </>
        ) : diferencia === 0 ? (
          <>Cambio parejo, no hay nada que cobrar.</>
        ) : (
          <>
            Debe pagar <b className="tabular-nums">{usd.format(diferencia)}</b>
            {tasa && (
              <span className="text-tinta-suave">
                {" "}
                · {(diferencia * tasa).toLocaleString("es-VE", {
                  maximumFractionDigits: 2,
                })}{" "}
                Bs
              </span>
            )}
          </>
        )}
      </div>

      {diferencia > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {METODOS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetodo(m)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                metodo.id === m.id
                  ? "border-marron bg-marron text-crema-alto"
                  : "border-borde bg-crema-alto text-tinta"
              }`}
            >
              {m.nombre}
            </button>
          ))}
        </div>
      )}

      <input
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder="Buscar en el inventario…"
        autoCapitalize="none"
        className="mt-3 w-full rounded-lg border border-borde bg-crema-alto px-4 py-2.5 text-sm outline-none focus:border-marron"
      />

      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        {candidatas.map((c) => (
          <li key={c.variante_id}>
            <button
              type="button"
              onClick={() => agregar(c)}
              disabled={c.disponible <= 0}
              className="flex w-full items-center gap-2.5 rounded-xl border border-borde bg-crema-alto p-2 text-left disabled:opacity-40"
            >
              {c.foto_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={c.foto_url}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="h-10 w-10 shrink-0 rounded-lg border border-dashed border-marron-suave" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-tinta">
                  {c.producto_nombre}
                </span>
                <span className="block truncate text-xs capitalize text-tinta-suave">
                  {c.color_nombre} · {c.talla} · quedan {c.disponible}
                </span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-tinta">
                {usd.format(Number(c.precio_usd))}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-alerta-tenue px-3 py-2 text-sm text-alerta">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={!alcanza || guardando}
        className="mt-3 w-full rounded-xl bg-tinta px-4 py-3 text-sm text-crema-alto disabled:opacity-40"
      >
        {guardando
          ? "Guardando…"
          : diferencia > 0
            ? `Cobrar ${usd.format(diferencia)} y cerrar el cambio`
            : "Cerrar el cambio"}
      </button>
    </div>
  );
}
