"use client";

import { useEffect, useMemo, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import Foto from "./foto";

interface Variante {
  variante_id: string;
  producto_id: string;
  producto_nombre: string;
  tipo: string | null;
  estilo: string | null;
  coleccion: string;
  color_nombre: string;
  color_hex: string | null;
  foto_url: string | null;
  talla: string;
  sku: string;
  precio_usd: number;
  stock: number;
  disponible: number;
}

const ORDEN_TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];

const dinero = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

/** Desplegable nativo: en el teléfono abre el selector del sistema, que es
 *  grande y familiar, y no ocupa nada de pantalla mientras está cerrado. */
function Selector({
  etiqueta,
  opciones,
  valor,
  onChange,
}: {
  etiqueta: string;
  opciones: string[];
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      aria-label={etiqueta}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      disabled={opciones.length === 0}
      className={`min-w-0 flex-1 rounded-lg border bg-crema-alto px-3 py-2.5 text-sm outline-none disabled:opacity-40 ${
        valor ? "border-marron text-tinta" : "border-borde text-tinta-suave"
      }`}
    >
      <option value="">{etiqueta}</option>
      {opciones.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export default function Buscador() {
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<Variante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [color, setColor] = useState("");
  const [talla, setTalla] = useState("");
  const [estilo, setEstilo] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      setCargando(true);
      const supabase = crearClienteNavegador();
      const { data } = await supabase.rpc("buscar_variantes", {
        p_termino: termino,
      });
      setResultados((data ?? []) as Variante[]);
      setCargando(false);
    }, 250);
    return () => clearTimeout(t);
  }, [termino]);

  // Las opciones salen de los resultados, no de un catálogo fijo: así los
  // desplegables no ofrecen nada que lleve a una pantalla vacía.
  const opciones = useMemo(() => {
    const unicos = (f: (v: Variante) => string | null) =>
      [...new Set(resultados.map(f).filter(Boolean) as string[])];
    return {
      colores: unicos((v) => v.color_nombre).sort(),
      tallas: unicos((v) => v.talla).sort(
        (a, b) => ORDEN_TALLAS.indexOf(a) - ORDEN_TALLAS.indexOf(b),
      ),
      estilos: unicos((v) => v.estilo).sort(),
    };
  }, [resultados]);

  const visibles = useMemo(
    () =>
      resultados.filter(
        (v) =>
          (!color || v.color_nombre === color) &&
          (!talla || v.talla === talla) &&
          (!estilo || v.estilo === estilo),
      ),
    [resultados, color, talla, estilo],
  );

  // Agrupado por producto y color: es como preguntan las clientas. "El top
  // blanco, ¿en qué tallas lo tienes?"
  const grupos = useMemo(() => {
    const mapa = new Map<string, { v: Variante; tallas: Variante[] }>();
    for (const v of visibles) {
      const clave = v.producto_id + "|" + v.color_nombre;
      if (!mapa.has(clave)) mapa.set(clave, { v, tallas: [] });
      mapa.get(clave)!.tallas.push(v);
    }
    return [...mapa.values()];
  }, [visibles]);

  const totalPrendas = visibles.reduce((s, v) => s + v.disponible, 0);
  // Sin foto, la prenda no sale en la tienda pública.
  const sinFoto = grupos.filter((g) => !g.v.foto_url).length;
  const hayFiltro = Boolean(color || talla || estilo);

  return (
    <div className="space-y-4">
      <input
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder="top blanco, top talla s…"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-xl border border-borde bg-crema-alto px-4 py-3.5 text-base outline-none placeholder:text-tinta-suave/50 focus:border-marron"
      />

      <div className="flex gap-2">
        <Selector etiqueta="Color" opciones={opciones.colores} valor={color} onChange={setColor} />
        <Selector etiqueta="Talla" opciones={opciones.tallas} valor={talla} onChange={setTalla} />
        <Selector etiqueta="Estilo" opciones={opciones.estilos} valor={estilo} onChange={setEstilo} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-tinta-suave">
          {cargando
            ? "Buscando…"
            : `${grupos.length} ${grupos.length === 1 ? "resultado" : "resultados"} · ${totalPrendas} ${totalPrendas === 1 ? "prenda" : "prendas"}`}
          {!cargando && sinFoto > 0 && (
            <span className="text-alerta">
              {" · "}
              {sinFoto} sin foto
            </span>
          )}
        </p>
        {hayFiltro && (
          <button
            type="button"
            onClick={() => {
              setColor("");
              setTalla("");
              setEstilo("");
            }}
            className="shrink-0 text-sm text-marron-hondo underline-offset-4 hover:underline"
          >
            Quitar filtros
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {grupos.map(({ v, tallas }) => (
          <li
            key={v.producto_id + v.color_nombre}
            className="flex gap-3.5 rounded-xl border border-borde bg-crema-alto p-3"
          >
            {/* El cuadro es el botón de la foto. Mientras no haya, muestra el
                color de la prenda: se reconoce mejor que un recuadro gris. */}
            <Foto
              productoId={v.producto_id}
              color={v.color_nombre}
              hex={v.color_hex}
              inicial={v.foto_url}
              letra={v.producto_nombre.charAt(0)}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-tinta">{v.producto_nombre}</p>
                  <p className="mt-0.5 text-sm text-tinta-suave">
                    {v.color_nombre}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-tinta-suave">
                  {dinero.format(v.precio_usd)}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {tallas
                  .sort(
                    (a, b) =>
                      ORDEN_TALLAS.indexOf(a.talla) -
                      ORDEN_TALLAS.indexOf(b.talla),
                  )
                  .map((t) => {
                    const agotado = t.disponible <= 0;
                    return (
                      <span
                        key={t.variante_id}
                        className={`rounded-lg border px-2.5 py-1 text-sm tabular-nums ${
                          agotado
                            ? "border-borde bg-crema text-tinta-suave/50 line-through"
                            : "border-marron-suave bg-marron-tenue text-tinta"
                        }`}
                      >
                        {t.talla}
                        <span className="ml-1.5 text-tinta-suave">
                          {t.disponible}
                        </span>
                      </span>
                    );
                  })}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!cargando && grupos.length === 0 && (
        <p className="rounded-xl border border-borde bg-crema-alto px-5 py-10 text-center text-tinta-suave">
          {termino || hayFiltro
            ? "Nada coincide con esa búsqueda."
            : "Todavía no hay nada en inventario."}
        </p>
      )}
    </div>
  );
}
