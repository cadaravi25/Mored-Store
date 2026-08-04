"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

export interface Elegido {
  id: string;
  nombre: string;
}

interface Encontrado {
  id: string;
  nombre: string;
  cedula: string | null;
  telefono: string | null;
  compras: number;
  total_usd: number;
}

const usd = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

/**
 * Primer paso del cobro: quién está comprando.
 *
 * Va por cédula porque es lo único que no cambia. El teléfono se cambia, se
 * presta, y a veces la mamá paga con el suyo por la hija; la cédula no. Si ya
 * compró antes aparece sola y no hay que escribir nada más.
 */
export default function PasoCliente({
  elegido,
  onElegir,
  onOmitir,
}: {
  elegido: Elegido | null;
  onElegir: (c: Elegido) => void;
  onOmitir: () => void;
}) {
  const [cedula, setCedula] = useState("");
  const [encontrado, setEncontrado] = useState<Encontrado | null>(null);
  const [buscado, setBuscado] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digitos = cedula.replace(/\D/g, "");

  // Se busca sola mientras escriben. Una cédula venezolana tiene entre 6 y 8
  // dígitos, así que antes de 6 no vale la pena preguntar.
  useEffect(() => {
    if (digitos.length < 6) {
      setEncontrado(null);
      setBuscado(false);
      return;
    }
    let vivo = true;
    const t = setTimeout(async () => {
      setBuscando(true);
      const { data } = await crearClienteNavegador().rpc("cliente_por_cedula", {
        p_cedula: cedula,
      });
      if (!vivo) return;
      setEncontrado(((data ?? [])[0] as Encontrado | undefined) ?? null);
      setBuscado(true);
      setBuscando(false);
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [cedula, digitos.length]);

  async function guardar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    setError(null);

    const { data, error: fallo } = await crearClienteNavegador().rpc(
      "obtener_o_crear_cliente",
      {
        p_nombre: nombre.trim(),
        p_cedula: cedula.trim() || null,
        p_telefono: telefono.trim() || null,
      },
    );

    if (fallo || !data) {
      setError(fallo?.message ?? "No se pudo guardar.");
      setGuardando(false);
      return;
    }
    setGuardando(false);
    onElegir({ id: data as string, nombre: nombre.trim() });
  }

  if (elegido) return null;

  return (
    <div className="space-y-3 rounded-xl border border-borde p-3">
      <div>
        <label htmlFor="cedula" className="mb-1.5 block text-sm text-tinta-suave">
          Cédula
        </label>
        <input
          id="cedula"
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          inputMode="numeric"
          autoFocus
          placeholder="12345678"
          className="w-full rounded-lg border border-borde bg-crema px-3 py-2.5 text-base tabular-nums outline-none focus:border-marron"
        />
      </div>

      {/* Ya compró antes: no hay nada más que escribir. */}
      {encontrado && (
        <div className="rounded-lg bg-marron-tenue p-3">
          <p className="text-sm text-tinta">{encontrado.nombre}</p>
          <p className="mt-0.5 text-xs text-tinta-suave">
            {encontrado.compras > 0
              ? `${encontrado.compras} ${
                  encontrado.compras === 1 ? "compra" : "compras"
                } · ${usd.format(Number(encontrado.total_usd))}`
              : "Sin compras todavía"}
            {encontrado.telefono && ` · ${encontrado.telefono}`}
          </p>
          <button
            type="button"
            onClick={() =>
              onElegir({ id: encontrado.id, nombre: encontrado.nombre })
            }
            className="mt-2.5 w-full rounded-lg bg-tinta px-3 py-2 text-sm text-crema-alto"
          >
            Continuar
          </button>
        </div>
      )}

      {/* No está: se piden los dos datos que hacen falta y se guarda. */}
      {buscado && !encontrado && !buscando && (
        <>
          <div>
            <label
              htmlFor="nombre"
              className="mb-1.5 block text-sm text-tinta-suave"
            >
              Nombre
            </label>
            <input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellido"
              className="w-full rounded-lg border border-borde bg-crema px-3 py-2.5 text-base outline-none focus:border-marron"
            />
          </div>
          <div>
            <label
              htmlFor="celular"
              className="mb-1.5 block text-sm text-tinta-suave"
            >
              Celular
            </label>
            <input
              id="celular"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              inputMode="tel"
              placeholder="04141234567"
              className="w-full rounded-lg border border-borde bg-crema px-3 py-2.5 text-base tabular-nums outline-none focus:border-marron"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-alerta-tenue px-3 py-2 text-sm text-alerta"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !nombre.trim()}
            className="w-full rounded-lg bg-tinta px-3 py-2.5 text-sm text-crema-alto disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar y continuar"}
          </button>
        </>
      )}

      {buscando && <p className="text-xs text-tinta-suave">Buscando…</p>}

      {/* La salida existe a propósito: si alguien no quiere dar la cédula, la
          venta tiene que poder hacerse igual. Una caja trancada es una caja
          que dejan de usar, y datos inventados para poder cobrar son peores
          que no tener ninguno. */}
      <button
        type="button"
        onClick={onOmitir}
        className="text-xs text-tinta-suave underline-offset-4 hover:underline"
      >
        Cobrar sin registrar al cliente
      </button>
    </div>
  );
}
