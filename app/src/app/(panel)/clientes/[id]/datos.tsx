"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  instagram: string | null;
  cedula: string | null;
  direccion: string | null;
  nota: string | null;
}

const CAMPOS = [
  { id: "nombre", etiqueta: "Nombre" },
  { id: "telefono", etiqueta: "Teléfono" },
  { id: "instagram", etiqueta: "Instagram" },
  { id: "cedula", etiqueta: "Cédula" },
  { id: "direccion", etiqueta: "Dirección" },
  { id: "nota", etiqueta: "Nota" },
] as const;

export default function Datos({ cliente }: { cliente: Cliente }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState(cliente);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!valores.nombre.trim()) return;
    setGuardando(true);
    setError(null);

    const { error: fallo } = await crearClienteNavegador()
      .from("clientes")
      .update({
        nombre: valores.nombre.trim(),
        telefono: valores.telefono?.trim() || null,
        instagram: valores.instagram?.trim() || null,
        cedula: valores.cedula?.trim() || null,
        direccion: valores.direccion?.trim() || null,
        nota: valores.nota?.trim() || null,
      })
      .eq("id", cliente.id);

    if (fallo) {
      setError(
        fallo.code === "23505"
          ? "Esa cédula ya es de otro cliente."
          : fallo.message,
      );
      setGuardando(false);
      return;
    }

    setEditando(false);
    setGuardando(false);
    router.refresh();
  }

  const llenos = CAMPOS.filter(
    (c) => c.id !== "nombre" && valores[c.id],
  );

  if (!editando) {
    return (
      <section className="rounded-2xl border border-borde bg-crema-alto p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Datos
          </p>
          <button
            type="button"
            onClick={() => {
              setValores(cliente);
              setEditando(true);
            }}
            className="text-sm text-marron-hondo underline-offset-4 hover:underline"
          >
            Editar
          </button>
        </div>

        {llenos.length === 0 ? (
          <p className="mt-3 text-sm text-tinta-suave">
            Solo está el nombre. Lo demás se puede llenar cuando haga falta.
          </p>
        ) : (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {llenos.map((c) => (
              <div key={c.id}>
                <dt className="text-xs text-tinta-suave">{c.etiqueta}</dt>
                <dd className="text-sm text-tinta">
                  {c.id === "instagram" ? `@${valores[c.id]}` : valores[c.id]}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-borde bg-crema-alto p-5">
      <p className="text-xs uppercase tracking-wide text-tinta-suave">Datos</p>

      {CAMPOS.map((c) => (
        <label key={c.id} className="block">
          <span className="mb-1 block text-xs text-tinta-suave">
            {c.etiqueta}
          </span>
          <input
            value={valores[c.id] ?? ""}
            onChange={(e) =>
              setValores({ ...valores, [c.id]: e.target.value })
            }
            inputMode={c.id === "telefono" ? "tel" : undefined}
            autoCapitalize={c.id === "instagram" ? "none" : undefined}
            className="w-full rounded-lg border border-borde bg-crema px-4 py-2.5 text-sm outline-none focus:border-marron"
          />
        </label>
      ))}

      {error && (
        <p role="alert" className="rounded-lg bg-alerta-tenue px-3 py-2 text-sm text-alerta">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="rounded-xl border border-borde px-4 py-2.5 text-sm text-tinta-suave"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || !valores.nombre.trim()}
          className="flex-1 rounded-xl bg-tinta px-4 py-2.5 text-sm text-crema-alto disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </section>
  );
}
