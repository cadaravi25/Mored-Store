"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import Foto from "./foto";
import Destacar from "./destacar";
import Completar from "./completar";
import Precios from "./precios";
import { COLOR_PENDIENTE, SIN_DEFINIR } from "@/lib/prendas";

interface Variante {
  variante_id: string;
  producto_id: string;
  producto_nombre: string;
  tipo: string | null;
  estilo: string | null;
  coleccion: string;
  color_id: string;
  color_nombre: string;
  color_hex: string | null;
  foto_url: string | null;
  talla: string;
  sku: string;
  precio_usd: number;
  precio_bs: number;
  stock: number;
  disponible: number;
  destacado: boolean;
}

const ORDEN_TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];

// Los precios de la tienda son euros pese al nombre de la columna.
const dinero = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "EUR",
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

export default function Buscador({ tasa }: { tasa: number | null }) {
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<Variante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [color, setColor] = useState("");
  const [talla, setTalla] = useState("");
  const [estilo, setEstilo] = useState("");
  const [soloSinFoto, setSoloSinFoto] = useState(false);
  const [orden, setOrden] = useState("");

  // El tope existe para que la pantalla no se ahogue, pero tiene que quedar
  // por encima del inventario real: con 231 variantes y un tope de 200, la
  // lista escondía 31 prendas sin decir nada.
  const TOPE = 800;

  const buscar = useCallback(async () => {
    setCargando(true);
    const supabase = crearClienteNavegador();
    const { data } = await supabase.rpc("buscar_variantes", {
      p_termino: termino,
      p_limite: TOPE,
    });
    setResultados((data ?? []) as Variante[]);
    setCargando(false);
  }, [termino]);

  useEffect(() => {
    const t = setTimeout(buscar, 250);
    return () => clearTimeout(t);
  }, [buscar]);

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

  // Un color sin foto propia no es una prenda invisible: la tienda le presta
  // la primera foto del producto. La que no sale es la que no tiene ninguna
  // foto en ningún color, y esa es la que hay que avisar en rojo.
  const conFoto = useMemo(() => {
    const s = new Set<string>();
    for (const v of resultados) if (v.foto_url) s.add(v.producto_id);
    return s;
  }, [resultados]);

  const sinFotoLista = grupos.filter((g) => !conFoto.has(g.v.producto_id));
  const sinFoto = sinFotoLista.length;

  // El aviso de "sin foto" es la lista de trabajo pendiente, así que además de
  // contarlas deja verlas: contarlas y que después haya que ir buscándolas a
  // mano por la lista entera no sirve de nada.
  const base = soloSinFoto ? sinFotoLista : grupos;

  /**
   * Ordenar por lo que queda, para ver qué se está acabando.
   *
   * El stock del grupo es la suma de sus tallas: lo que interesa saber es si
   * de ese top blanco queda una sola pieza entre todas las tallas, no si la M
   * está en cero mientras hay seis de la S.
   */
  const quedan = (g: { tallas: Variante[] }) =>
    g.tallas.reduce((s, t) => s + t.disponible, 0);

  const mostrados = useMemo(() => {
    if (!orden) return base;
    const lista = [...base];
    lista.sort((a, b) =>
      orden === "menos" ? quedan(a) - quedan(b) : quedan(b) - quedan(a),
    );
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, orden]);

  const hayFiltro = Boolean(color || talla || estilo || soloSinFoto);

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

      {/* Este no filtra, ordena: no esconde nada, solo pone delante lo que se
          está acabando. Por eso va aparte de los tres de arriba. */}
      <select
        aria-label="Ordenar"
        value={orden}
        onChange={(e) => setOrden(e.target.value)}
        className={`w-full rounded-lg border bg-crema-alto px-3 py-2.5 text-sm outline-none sm:w-auto ${
          orden ? "border-marron text-tinta" : "border-borde text-tinta-suave"
        }`}
      >
        <option value="">Orden: como salen</option>
        <option value="menos">Lo que se está acabando primero</option>
        <option value="mas">Lo que más queda primero</option>
      </select>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-tinta-suave">
          {cargando
            ? "Buscando…"
            : `${grupos.length} ${grupos.length === 1 ? "resultado" : "resultados"} · ${totalPrendas} ${totalPrendas === 1 ? "prenda" : "prendas"}`}
          {!cargando && sinFoto > 0 && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => setSoloSinFoto(!soloSinFoto)}
                aria-pressed={soloSinFoto}
                className={`text-alerta underline-offset-4 hover:underline ${
                  soloSinFoto ? "underline" : ""
                }`}
              >
                {sinFoto} sin foto
              </button>
            </>
          )}
          {/* Si se llegó al tope hay más y no se ven. Callarlo haría creer que
              el inventario es más pequeño de lo que es. */}
          {!cargando && resultados.length >= TOPE && (
            <span className="text-alerta">
              {" · "}
              hay más, afina la búsqueda
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
              setSoloSinFoto(false);
              setOrden("");
            }}
            className="shrink-0 text-sm text-marron-hondo underline-offset-4 hover:underline"
          >
            Quitar filtros
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {mostrados.map(({ v, tallas }) => {
          // Lo que entró del catálogo de Treinta sin saber el reparto queda
          // bajo una talla marcada. No se muestra como una talla más: se
          // muestra como lo que es, trabajo pendiente.
          const reales = tallas.filter((t) => t.talla !== SIN_DEFINIR);
          const sinRepartir = tallas
            .filter((t) => t.talla === SIN_DEFINIR)
            .reduce((s, t) => s + t.stock, 0);
          const aMedias =
            sinRepartir > 0 || v.color_nombre === COLOR_PENDIENTE;

          return (
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
                  <p
                    className={`mt-0.5 text-sm ${
                      v.color_nombre === COLOR_PENDIENTE
                        ? "text-alerta"
                        : "text-tinta-suave"
                    }`}
                  >
                    {v.color_nombre === COLOR_PENDIENTE
                      ? "Sin color"
                      : v.color_nombre}
                  </p>
                  {/* Sin foto la prenda no sale en la tienda, y eso desde el
                      panel no se notaba: se cargaba el inventario, se miraba
                      la web y no estaba, sin ninguna explicación.
                      Que este color no tenga la suya es otra cosa: sale, pero
                      enseñando la foto de otro color, así que conviene saberlo
                      sin que parezca una avería. */}
                  {!conFoto.has(v.producto_id) ? (
                    <p className="mt-1 text-xs text-alerta">
                      Sin foto · no sale en la tienda
                    </p>
                  ) : (
                    !v.foto_url && (
                      <p className="mt-1 text-xs text-tinta-suave">
                        Sale con la foto de otro color
                      </p>
                    )
                  )}
                  <Destacar
                    productoId={v.producto_id}
                    inicial={v.destacado}
                  />
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-sm tabular-nums text-tinta-suave">
                    {dinero.format(v.precio_usd)}
                  </span>
                  <Precios
                    colorId={v.color_id}
                    precioEur={Number(v.precio_usd)}
                    precioBs={Number(v.precio_bs ?? v.precio_usd)}
                    tasa={tasa}
                    onGuardado={buscar}
                  />
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {reales
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

              {aMedias && (
                <Completar
                  productoId={v.producto_id}
                  colorId={v.color_id}
                  color={v.color_nombre}
                  pendiente={sinRepartir}
                  onListo={buscar}
                />
              )}
            </div>
          </li>
          );
        })}
      </ul>

      {!cargando && mostrados.length === 0 && (
        <p className="rounded-xl border border-borde bg-crema-alto px-5 py-10 text-center text-tinta-suave">
          {termino || hayFiltro
            ? "Nada coincide con esa búsqueda."
            : "Todavía no hay nada en inventario."}
        </p>
      )}
    </div>
  );
}
