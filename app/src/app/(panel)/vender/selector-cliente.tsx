"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

interface Sugerencia {
  id: string;
  nombre: string;
  telefono: string | null;
  instagram: string | null;
}

export interface Elegida {
  id: string;
  nombre: string;
}

/**
 * A nombre de quién va la venta. Es opcional a propósito: en el mostrador la
 * mayoría de las ventas son a alguien que pasó, y obligar a llenar una ficha
 * para cobrar haría que dejen de usar el sistema en hora pico.
 */
export default function SelectorCliente({
  elegida,
  onElegir,
}: {
  elegida: Elegida | null;
  onElegir: (c: Elegida | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [termino, setTermino] = useState("");
  const [telefono, setTelefono] = useState("");
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || termino.trim().length < 2) {
      setSugerencias([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscando(true);
      const { data } = await crearClienteNavegador().rpc("buscar_clientes", {
        p_termino: termino,
        p_limite: 5,
      });
      setSugerencias((data ?? []) as Sugerencia[]);
      setBuscando(false);
    }, 250);
    return () => clearTimeout(t);
  }, [termino, abierto]);

  async function crear() {
    const nombre = termino.trim();
    if (!nombre) return;
    setError(null);

    const { data, error: fallo } = await crearClienteNavegador().rpc(
      "obtener_o_crear_cliente",
      { p_nombre: nombre, p_telefono: telefono.trim() || null },
    );

    if (fallo || !data) {
      setError(fallo?.message ?? "No se pudo guardar.");
      return;
    }
    elegir({ id: data as string, nombre });
  }

  function elegir(c: Elegida) {
    onElegir(c);
    setAbierto(false);
    setTermino("");
    setTelefono("");
    setSugerencias([]);
  }

  if (elegida) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-marron-tenue px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm text-tinta">
          {elegida.nombre}
        </span>
        <button
          type="button"
          onClick={() => onElegir(null)}
          aria-label="Quitar la clienta"
          className="shrink-0 text-sm text-tinta-suave hover:text-tinta"
        >
          ×
        </button>
      </div>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full rounded-xl border border-dashed border-borde px-3 py-2 text-left text-sm text-tinta-suave hover:border-marron-suave"
      >
        + A nombre de una clienta
      </button>
    );
  }

  const exacta = sugerencias.some(
    (s) => s.nombre.toLowerCase() === termino.trim().toLowerCase(),
  );

  return (
    <div className="space-y-2 rounded-xl border border-borde p-3">
      <input
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder="Nombre, teléfono o Instagram"
        autoFocus
        className="w-full rounded-lg border border-borde bg-crema px-3 py-2 text-sm outline-none focus:border-marron"
      />

      {sugerencias.length > 0 && (
        <ul className="space-y-1">
          {sugerencias.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => elegir({ id: s.id, nombre: s.nombre })}
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-tinta hover:bg-crema"
              >
                {s.nombre}
                {(s.telefono || s.instagram) && (
                  <span className="ml-2 text-xs text-tinta-suave">
                    {s.telefono ?? `@${s.instagram}`}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Solo se ofrece crear cuando no hay una con ese mismo nombre: es la
          forma barata de no llenar la base de Marías repetidas. */}
      {termino.trim().length >= 2 && !buscando && !exacta && (
        <div className="space-y-2 border-t border-borde pt-2">
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            inputMode="tel"
            placeholder="Teléfono (opcional)"
            className="w-full rounded-lg border border-borde bg-crema px-3 py-2 text-sm outline-none focus:border-marron"
          />
          <button
            type="button"
            onClick={crear}
            className="w-full rounded-lg bg-tinta px-3 py-2 text-sm text-crema-alto"
          >
            Guardar &laquo;{termino.trim()}&raquo; como nueva
          </button>
        </div>
      )}

      {error && <p className="text-xs text-alerta">{error}</p>}

      <button
        type="button"
        onClick={() => {
          setAbierto(false);
          setTermino("");
        }}
        className="text-xs text-tinta-suave underline-offset-4 hover:underline"
      >
        Cancelar
      </button>
    </div>
  );
}
