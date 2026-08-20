"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { COLOR_PENDIENTE } from "@/lib/prendas";

const TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];

/**
 * Le pone color y tallas a una prenda que entró a medias.
 *
 * Vive dentro de la tarjeta del inventario, no en una pantalla aparte: quien
 * completa la prenda la tiene en la mano y está mirando su foto. Mandarla a
 * otra pantalla a buscarla otra vez sobra.
 *
 * Las cantidades son un reconteo, no una suma. Si la prenda decía 2 y al
 * contarla hay 1 en S y 1 en M, se escribe 1 y 1. Si al contarla solo aparece
 * una, se escribe 1 y ya: la diferencia queda registrada como ajuste, que es
 * exactamente lo que fue.
 */
export default function Completar({
  productoId,
  colorId,
  color,
  pendiente,
  onListo,
}: {
  productoId: string;
  colorId: string;
  color: string;
  /** Unidades sin repartir, las que están bajo POR DEFINIR. */
  pendiente: number;
  onListo: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(
    color === COLOR_PENDIENTE ? "" : color,
  );
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diferencia, setDiferencia] = useState<number | null>(null);
  const [nota, setNota] = useState<string | null>(null);

  // La nota con que venía la prenda de Treinta: "Ref 29€/ talla XS y M". Dice
  // qué tallas existen, aunque no cuántas de cada una. Sin ella habría que
  // abrir el catálogo viejo al lado para completar cada prenda.
  useEffect(() => {
    if (!abierto || nota !== null) return;
    let vigente = true;
    crearClienteNavegador()
      .from("productos")
      .select("descripcion")
      .eq("id", productoId)
      .single()
      .then(({ data }) => {
        if (vigente) setNota(data?.descripcion ?? "");
      });
    return () => {
      vigente = false;
    };
  }, [abierto, nota, productoId]);

  const puestas = Object.entries(cantidades).filter(([, n]) => n > 0);
  const total = puestas.reduce((s, [, n]) => s + n, 0);

  function sumar(talla: string, paso: number) {
    setCantidades((c) => ({
      ...c,
      [talla]: Math.max(0, (c[talla] ?? 0) + paso),
    }));
  }

  async function guardar() {
    if (!nombre.trim()) {
      setError("Falta el color.");
      return;
    }
    if (puestas.length === 0) {
      setError("Pon al menos una talla.");
      return;
    }

    setGuardando(true);
    setError(null);

    const { data, error: fallo } = await crearClienteNavegador().rpc(
      "completar_prenda",
      {
        p_color_id: colorId,
        p_color: nombre.trim(),
        p_tallas: puestas.map(([talla, cantidad]) => ({ talla, cantidad })),
      },
    );

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setGuardando(false);

    // Si el conteo no cuadró con lo que decía Treinta, se dice. Corregirlo en
    // silencio dejaría a la tienda con un número distinto al de la mesa y
    // nadie sabría por qué.
    const salto = Number((data as { diferencia?: number } | null)?.diferencia ?? 0);
    if (salto !== 0) {
      setDiferencia(salto);
      return;
    }

    setAbierto(false);
    onListo();
  }

  function cerrar() {
    setDiferencia(null);
    setAbierto(false);
    onListo();
  }

  if (diferencia !== null) {
    return (
      <div className="mt-2 rounded-xl border border-borde bg-crema p-3">
        <p className="text-sm text-tinta">
          Guardado. El catálogo decía{" "}
          {diferencia > 0
            ? `${diferencia} ${diferencia === 1 ? "prenda" : "prendas"} más de las que contaste`
            : `${-diferencia} ${-diferencia === 1 ? "prenda" : "prendas"} menos de las que contaste`}
          .
        </p>
        <p className="mt-1 text-xs text-tinta-suave">
          Vale el conteo. La diferencia quedó registrada como ajuste.
        </p>
        <button
          type="button"
          onClick={cerrar}
          className="mt-2.5 rounded-lg bg-tinta px-4 py-2 text-sm text-crema-alto"
        >
          Entendido
        </button>
      </div>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-1.5 rounded-lg border border-alerta/40 bg-alerta-tenue px-2.5 py-1 text-xs text-alerta"
      >
        Completar
        {pendiente > 0 && (
          <span className="ml-1.5 tabular-nums">
            {pendiente} sin repartir
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-marron-suave bg-crema p-3">
      {nota && (
        <p className="mb-3 rounded-lg bg-crema-alto px-2.5 py-2 text-xs text-tinta-suave">
          Venía anotado: <span className="text-tinta">{nota}</span>
        </p>
      )}

      <label className="block text-xs text-tinta-suave">Color</label>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="negro, azul, animal print…"
        autoCapitalize="none"
        className="mt-1 w-full rounded-lg border border-borde bg-crema-alto px-3 py-2 text-sm outline-none focus:border-marron"
      />

      <p className="mt-3 text-xs text-tinta-suave">
        Cuántas hay de cada talla
        {pendiente > 0 && (
          <span> · el catálogo decía {pendiente} en total</span>
        )}
      </p>

      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {TALLAS.map((t) => {
          const n = cantidades[t] ?? 0;
          return (
            <div
              key={t}
              className={`flex items-center justify-between rounded-lg border px-2 py-1.5 ${
                n > 0
                  ? "border-marron bg-marron-tenue"
                  : "border-borde bg-crema-alto"
              }`}
            >
              <span className="text-sm">{t}</span>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => sumar(t, -1)}
                  disabled={n === 0}
                  aria-label={`Quitar una talla ${t}`}
                  className="grid h-6 w-6 place-items-center rounded-md border border-borde text-tinta-suave disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-4 text-center text-sm tabular-nums">{n}</span>
                <button
                  type="button"
                  onClick={() => sumar(t, 1)}
                  aria-label={`Agregar una talla ${t}`}
                  className="grid h-6 w-6 place-items-center rounded-md border border-borde text-tinta-suave"
                >
                  +
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-2 text-xs text-alerta">{error}</p>}

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-sm text-tinta-suave underline-offset-4 hover:underline"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-lg bg-tinta px-4 py-2 text-sm text-crema-alto disabled:opacity-50"
        >
          {guardando
            ? "Guardando…"
            : `Guardar ${total} ${total === 1 ? "prenda" : "prendas"}`}
        </button>
      </div>
    </div>
  );
}
