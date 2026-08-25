"use client";

import { useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { SIN_DEFINIR } from "@/lib/prendas";

interface Talla {
  variante_id: string;
  talla: string;
  stock: number;
}

/**
 * Arreglar una prenda y, si hace falta, sacarla.
 *
 * Todo el catálogo salió de vídeos de WhatsApp leídos cuadro a cuadro, así que
 * hay descripciones con erratas y colores que se nombraron a ojo. Corregirlos
 * exigía entrar a la base, y eso no lo va a hacer nadie en mitad de una venta.
 *
 * EL CONTEO ES LO QUE MÁS FALTA
 *
 * Casi todas las prendas entraron con una unidad por talla porque nadie las
 * contó. Aquí se dice cuántas hay de verdad y la base calcula el movimiento
 * que falta: la columna del stock nunca se escribe a mano, se mueve por el
 * libro de movimientos, que es lo que deja saber después por qué cambió.
 *
 * QUITAR NO SIEMPRE ES BORRAR
 *
 * Si de ese color salió alguna venta no se borra: se desactiva. Borrarlo
 * dejaría a Caja y a Finanzas hablando de una prenda que ya no existe, y las
 * cifras de meses cerrados cambiarían solas. Lo que nunca se vendió sí se
 * borra entero, para que no quede stock fantasma de algo cargado por error.
 */
export default function Editar({
  productoId,
  colorId,
  nombre,
  descripcion,
  color,
  tallas,
  onGuardado,
}: {
  productoId: string;
  colorId: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  tallas: Talla[];
  onGuardado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nom, setNom] = useState(nombre);
  const [desc, setDesc] = useState(descripcion ?? "");
  const [col, setCol] = useState(color);
  const [cantidades, setCantidades] = useState<Record<string, string>>(() =>
    Object.fromEntries(tallas.map((t) => [t.variante_id, String(t.stock)])),
  );
  const [guardando, setGuardando] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reales = tallas.filter((t) => t.talla !== SIN_DEFINIR);

  async function guardar() {
    setGuardando(true);
    setError(null);
    const supabase = crearClienteNavegador();
    try {
      if (nom.trim() !== nombre || (desc.trim() || null) !== descripcion) {
        const { error: e } = await supabase.rpc("editar_prenda", {
          p_producto_id: productoId,
          p_nombre: nom,
          p_descripcion: desc,
        });
        if (e) throw new Error(e.message);
      }
      if (col.trim() !== color) {
        const { error: e } = await supabase.rpc("renombrar_color", {
          p_color_id: colorId,
          p_nombre: col,
        });
        if (e) throw new Error(e.message);
      }
      // Solo las que cambiaron: un ajuste que no mueve nada ensucia el libro.
      for (const t of reales) {
        const nueva = Number(cantidades[t.variante_id]);
        if (!Number.isFinite(nueva) || nueva === t.stock) continue;
        const { error: e } = await supabase.rpc("ajustar_existencias", {
          p_variante_id: t.variante_id,
          p_cantidad: nueva,
        });
        if (e) throw new Error(e.message);
      }
      setAbierto(false);
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar() {
    // Un toque de más antes de sacar algo del inventario. No es un diálogo del
    // navegador porque en el teléfono salen feos y se cierran solos.
    if (!quitando) {
      setQuitando(true);
      return;
    }
    setGuardando(true);
    setError(null);
    const { data, error: e } = await crearClienteNavegador().rpc("retirar_color", {
      p_color_id: colorId,
    });
    if (e) {
      setError(e.message);
      setGuardando(false);
      return;
    }
    const r = data as { borrado: boolean; prenda_retirada: boolean };
    if (!r.borrado) {
      // Que sepan que no desapareció del todo, y por qué.
      setError(
        "Se sacó de la tienda y del inventario, pero no se borró: tiene ventas y el historial tiene que seguir cuadrando.",
      );
      setGuardando(false);
      setTimeout(onGuardado, 2500);
      return;
    }
    onGuardado();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-1.5 text-xs text-marron-hondo underline-offset-4 hover:underline"
      >
        Editar
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-marron-suave bg-crema p-3">
      <div>
        <label className="mb-1 block text-xs text-tinta-suave">Prenda</label>
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="w-full rounded-lg border border-borde bg-crema-alto px-3 py-2 text-sm outline-none focus:border-marron"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-tinta-suave">
          Descripción{" "}
          <span className="text-tinta-suave/60">
            (es lo que distingue esta prenda de otra con el mismo nombre)
          </span>
        </label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-lg border border-borde bg-crema-alto px-3 py-2 text-sm outline-none focus:border-marron"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-tinta-suave">Color</label>
        <input
          value={col}
          onChange={(e) => setCol(e.target.value)}
          className="w-full rounded-lg border border-borde bg-crema-alto px-3 py-2 text-sm outline-none focus:border-marron"
        />
      </div>

      {reales.length > 0 && (
        <div>
          <label className="mb-1 block text-xs text-tinta-suave">
            Cuántas hay <span className="text-tinta-suave/60">(contadas)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {reales.map((t) => (
              <label key={t.variante_id} className="flex items-center gap-1.5">
                <span className="text-sm text-tinta">{t.talla}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={cantidades[t.variante_id] ?? ""}
                  onChange={(e) =>
                    setCantidades((c) => ({ ...c, [t.variante_id]: e.target.value }))
                  }
                  className="w-16 rounded-lg border border-borde bg-crema-alto px-2 py-1.5 text-sm tabular-nums outline-none focus:border-marron"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-alerta-tenue px-3 py-2 text-xs text-alerta">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-borde pt-2.5">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-lg bg-tinta px-4 py-2 text-sm text-crema-alto disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setQuitando(false);
            setError(null);
          }}
          className="rounded-lg border border-borde px-3 py-2 text-sm text-tinta-suave"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={quitar}
          disabled={guardando}
          className={`ml-auto rounded-lg px-3 py-2 text-sm disabled:opacity-50 ${
            quitando
              ? "bg-alerta text-nieve"
              : "border border-borde text-alerta"
          }`}
        >
          {quitando ? "Sí, quitar este color" : "Quitar"}
        </button>
      </div>

      {quitando && (
        <p className="text-xs text-tinta-suave">
          Se quita <span className="text-tinta">{color}</span> de esta prenda,
          con sus {reales.length} {reales.length === 1 ? "talla" : "tallas"}. Si
          era el único color, la prenda deja de salir en la tienda.
        </p>
      )}
    </div>
  );
}
