"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { enCorto } from "@/lib/fechas";

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  instagram: string | null;
  cedula: string | null;
  nota: string | null;
  compras: number;
  total_usd: number;
  ultima_compra: string | null;
}

const usd = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

/** Iniciales para el redondel, que es más rápido de reconocer que leer. */
function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Nuevo({ onListo }: { onListo: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [cedula, setCedula] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [instagram, setInstagram] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    setError(null);

    const { error: fallo } = await crearClienteNavegador()
      .from("clientes")
      .insert({
        nombre: nombre.trim(),
        cedula: cedula.trim() || null,
        telefono: telefono.trim() || null,
        instagram: instagram.trim() || null,
        nota: nota.trim() || null,
      });

    if (fallo) {
      // La cédula es lo único único: el teléfono se puede repetir.
      setError(
        fallo.code === "23505"
          ? "Ya hay un cliente con esa cédula. Búscalo arriba."
          : fallo.message,
      );
      setGuardando(false);
      return;
    }

    setCedula("");
    setNombre("");
    setTelefono("");
    setInstagram("");
    setNota("");
    setAbierto(false);
    setGuardando(false);
    onListo();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="shrink-0 rounded-xl border border-borde bg-crema-alto px-4 py-2.5 text-sm text-tinta hover:border-marron-suave"
      >
        Nuevo cliente
      </button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-2xl border border-borde bg-crema-alto p-4">
      <input
        value={cedula}
        onChange={(e) => setCedula(e.target.value)}
        inputMode="numeric"
        placeholder="Cédula"
        autoFocus
        className="w-full rounded-lg border border-borde bg-crema px-4 py-2.5 text-sm tabular-nums outline-none focus:border-marron"
      />
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre"
        className="w-full rounded-lg border border-borde bg-crema px-4 py-2.5 text-sm outline-none focus:border-marron"
      />
      <div className="flex flex-wrap gap-2">
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          inputMode="tel"
          placeholder="Teléfono"
          className="min-w-0 flex-1 rounded-lg border border-borde bg-crema px-4 py-2.5 text-sm outline-none focus:border-marron"
        />
        <input
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="Instagram"
          autoCapitalize="none"
          className="min-w-0 flex-1 rounded-lg border border-borde bg-crema px-4 py-2.5 text-sm outline-none focus:border-marron"
        />
      </div>
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota (opcional)"
        className="w-full rounded-lg border border-borde bg-crema px-4 py-2.5 text-sm outline-none focus:border-marron"
      />

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
          disabled={guardando || !nombre.trim()}
          className="flex-1 rounded-xl bg-tinta px-4 py-2.5 text-sm text-crema-alto disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

export default function Lista({ iniciales: primeras }: { iniciales: Cliente[] }) {
  const router = useRouter();
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>(primeras);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setCargando(true);
      const { data } = await crearClienteNavegador().rpc("buscar_clientes", {
        p_termino: termino,
      });
      setResultados((data ?? []) as Cliente[]);
      setCargando(false);
    }, 250);
    return () => clearTimeout(t);
  }, [termino]);

  function recargar() {
    setTermino("");
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start gap-2">
        <input
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          placeholder="Buscar por cédula, nombre, teléfono o Instagram"
          className="min-w-0 flex-1 rounded-xl border border-borde bg-crema-alto px-4 py-2.5 text-base outline-none placeholder:text-tinta-suave/60 focus:border-marron"
        />
        <Nuevo onListo={recargar} />
      </div>

      {resultados.length === 0 ? (
        <p className="rounded-2xl border border-borde bg-crema-alto py-14 text-center text-sm text-tinta-suave">
          {cargando
            ? "Buscando…"
            : termino
              ? "Ningún cliente con ese dato."
              : "Todavía no hay clientes registrados."}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {resultados.map((c) => (
            <li key={c.id}>
              <Link
                href={`/panel/clientes/${c.id}`}
                className="flex items-center gap-3 rounded-2xl border border-borde bg-crema-alto p-3.5 hover:border-marron-suave"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-marron-tenue text-sm text-marron-hondo">
                  {iniciales(c.nombre)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-tinta">
                    {c.nombre}
                  </span>
                  <span className="block truncate text-xs text-tinta-suave">
                    {[c.cedula, c.telefono ?? (c.instagram ? `@${c.instagram}` : null)]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm tabular-nums text-tinta">
                    {c.compras > 0 ? usd.format(Number(c.total_usd)) : "—"}
                  </span>
                  <span className="block text-xs text-tinta-suave">
                    {c.ultima_compra ? enCorto(c.ultima_compra.slice(0, 10)) : "sin compras"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
