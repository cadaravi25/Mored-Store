"use client";

import { useEffect, useMemo, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

interface Variante {
  variante_id: string;
  producto_id: string;
  producto_nombre: string;
  tipo: string | null;
  estilo: string | null;
  coleccion: string;
  color_nombre: string;
  color_hex: string | null;
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

function Filtro({
  titulo,
  opciones,
  valor,
  onChange,
}: {
  titulo: string;
  opciones: string[];
  valor: string | null;
  onChange: (v: string | null) => void;
}) {
  if (opciones.length < 2) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs uppercase tracking-wide text-tinta-suave">
        {titulo}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(valor === o ? null : o)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              valor === o
                ? "border-dorado bg-dorado text-crema-alto"
                : "border-borde bg-crema-alto text-tinta"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Buscador() {
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<Variante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [color, setColor] = useState<string | null>(null);
  const [talla, setTalla] = useState<string | null>(null);
  const [estilo, setEstilo] = useState<string | null>(null);

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

  // Los filtros salen de los resultados, no de un catálogo fijo: así solo
  // ofrecen opciones que devuelven algo. Un filtro que lleva a una pantalla
  // vacía es peor que no tener filtro.
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

  return (
    <div className="space-y-5">
      <input
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder="top blanco, top talla s…"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-xl border border-borde bg-crema-alto px-4 py-3.5 text-base outline-none placeholder:text-tinta-suave/50 focus:border-dorado"
      />

      {(opciones.colores.length > 1 ||
        opciones.tallas.length > 1 ||
        opciones.estilos.length > 1) && (
        <div className="space-y-3 rounded-xl border border-borde bg-crema-alto p-3.5">
          <Filtro titulo="Color" opciones={opciones.colores} valor={color} onChange={setColor} />
          <Filtro titulo="Talla" opciones={opciones.tallas} valor={talla} onChange={setTalla} />
          <Filtro titulo="Estilo" opciones={opciones.estilos} valor={estilo} onChange={setEstilo} />
        </div>
      )}

      <p className="text-sm text-tinta-suave">
        {cargando
          ? "Buscando…"
          : `${grupos.length} ${grupos.length === 1 ? "resultado" : "resultados"} · ${totalPrendas} ${totalPrendas === 1 ? "prenda" : "prendas"}`}
      </p>

      <ul className="space-y-2">
        {grupos.map(({ v, tallas }) => (
          <li
            key={v.producto_id + v.color_nombre}
            className="rounded-xl border border-borde bg-crema-alto p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-tinta">{v.producto_nombre}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-tinta-suave">
                  {v.color_hex && (
                    <span
                      aria-hidden
                      className="h-3 w-3 shrink-0 rounded-full border border-black/15"
                      style={{ backgroundColor: v.color_hex }}
                    />
                  )}
                  {v.color_nombre}
                </p>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-tinta-suave">
                {dinero.format(v.precio_usd)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {tallas
                .sort(
                  (a, b) =>
                    ORDEN_TALLAS.indexOf(a.talla) - ORDEN_TALLAS.indexOf(b.talla),
                )
                .map((t) => {
                  const agotado = t.disponible <= 0;
                  return (
                    <span
                      key={t.variante_id}
                      className={`rounded-lg border px-3 py-1.5 text-sm tabular-nums ${
                        agotado
                          ? "border-borde bg-crema text-tinta-suave/50 line-through"
                          : "border-dorado-claro bg-dorado-tenue text-tinta"
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
          </li>
        ))}
      </ul>

      {!cargando && grupos.length === 0 && (
        <p className="rounded-xl border border-borde bg-crema-alto px-5 py-10 text-center text-tinta-suave">
          Nada coincide con esa búsqueda.
        </p>
      )}
    </div>
  );
}
