"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

export interface Tipo {
  id: string;
  coleccion: "active" | "swim";
  nombre: string;
}
export interface Color {
  id: string;
  nombre: string;
  hex: string | null;
}
export interface Estilo {
  id: string;
  nombre: string;
}

interface Linea {
  clave: string;
  coleccion: "active" | "swim";
  tipo_id: string;
  tipo_nombre: string;
  detalle: string;
  color: string;
  talla: string;
  cantidad: number;
  costo_unitario_usd: number;
  precio_venta_usd: number | null;
}

const TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];

const dinero = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2.5 text-sm transition-colors ${
        activo
          ? "border-dorado bg-dorado text-crema-alto"
          : "border-borde bg-crema-alto text-tinta"
      }`}
    >
      {children}
    </button>
  );
}

export default function Formulario({
  tipos,
  colores,
  estilos,
}: {
  tipos: Tipo[];
  colores: Color[];
  estilos: Estilo[];
}) {
  const router = useRouter();

  const [coleccion, setColeccion] = useState<"active" | "swim">("active");
  const [tipoId, setTipoId] = useState("");
  const [detalle, setDetalle] = useState("");
  const [estiloNuevo, setEstiloNuevo] = useState(false);
  const [listaEstilos, setListaEstilos] = useState(estilos);
  const [talla, setTalla] = useState("");
  const [piezas, setPiezas] = useState(1);
  // Cuántas piezas de cada color trae esta línea. Un pack de 3 puede venir con
  // tres colores distintos, o con dos negros y un blanco: cualquier reparto.
  const [asignado, setAsignado] = useState<Record<string, number>>({});
  const [precioPagado, setPrecioPagado] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");

  const [lineas, setLineas] = useState<Linea[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tiposVisibles = useMemo(
    () => tipos.filter((t) => t.coleccion === coleccion),
    [tipos, coleccion],
  );

  const asignadas = Object.values(asignado).reduce((s, n) => s + n, 0);
  const faltan = piezas - asignadas;

  // SHEIN cobra el pack completo. Que dividan de cabeza es donde se cuelan los
  // errores de costo, así que lo hace la app.
  const costoUnitario = piezas > 0 ? Number(precioPagado || 0) / piezas : 0;

  const completa =
    Boolean(tipoId) && Boolean(talla) && Number(precioPagado) > 0 && faltan === 0;

  function sumarColor(nombre: string) {
    if (asignadas >= piezas) return;
    setAsignado((prev) => ({ ...prev, [nombre]: (prev[nombre] ?? 0) + 1 }));
  }

  function restarColor(nombre: string) {
    setAsignado((prev) => {
      const n = (prev[nombre] ?? 0) - 1;
      const copia = { ...prev };
      if (n <= 0) delete copia[nombre];
      else copia[nombre] = n;
      return copia;
    });
  }

  function cambiarPiezas(n: number) {
    setPiezas(n);
    // Si bajan la cantidad por debajo de lo ya repartido, se limpia: es más
    // claro volver a repartir que adivinar cuál color sobra.
    if (asignadas > n) setAsignado({});
  }

  async function agregar() {
    if (!completa) return;
    const tipo = tipos.find((t) => t.id === tipoId)!;
    const estilo = detalle.trim();

    if (estiloNuevo && estilo && !listaEstilos.some((e) => e.nombre === estilo)) {
      const supabase = crearClienteNavegador();
      const { data: id } = await supabase.rpc("obtener_o_crear_estilo", {
        p_nombre: estilo,
      });
      if (id)
        setListaEstilos((prev) => [...prev, { id: id as string, nombre: estilo }]);
      setEstiloNuevo(false);
    }

    // Un color por línea: el pack se reparte en tantas líneas como colores.
    const nuevas: Linea[] = Object.entries(asignado).map(([color, cantidad]) => ({
      clave: crypto.randomUUID(),
      coleccion,
      tipo_id: tipoId,
      tipo_nombre: tipo.nombre,
      detalle: estilo,
      color,
      talla,
      cantidad,
      costo_unitario_usd: Number(costoUnitario.toFixed(2)),
      precio_venta_usd: precioVenta ? Number(precioVenta) : null,
    }));

    setLineas((prev) => [...prev, ...nuevas]);
    // Se conservan tipo y estilo: lo normal es cargar la misma prenda en
    // varias tallas seguidas.
    setAsignado({});
    setTalla("");
  }

  async function guardar() {
    setGuardando(true);
    setError(null);

    const supabase = crearClienteNavegador();
    const { error: fallo } = await supabase.rpc("registrar_entrada", {
      p_lineas: lineas.map(({ clave: _c, tipo_nombre: _t, ...resto }) => resto),
      p_flete_usd: 0,
    });

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setLineas([]);
    setGuardando(false);
    router.refresh();
  }

  const totalPrendas = lineas.reduce((s, l) => s + l.cantidad, 0);
  const totalCosto = lineas.reduce(
    (s, l) => s + l.cantidad * l.costo_unitario_usd,
    0,
  );

  return (
    <div className="space-y-6">
      {lineas.length > 0 && (
        <ul className="space-y-2">
          {lineas.map((l) => (
            <li
              key={l.clave}
              className="flex items-center gap-3 rounded-xl border border-borde bg-crema-alto px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-tinta">
                  {l.tipo_nombre}
                  {l.detalle ? ` ${l.detalle}` : ""}
                </p>
                <p className="text-sm text-tinta-suave">
                  {l.color} · {l.talla} · {l.cantidad}{" "}
                  {l.cantidad === 1 ? "prenda" : "prendas"} ·{" "}
                  {dinero.format(l.costo_unitario_usd)} c/u
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setLineas((prev) => prev.filter((x) => x.clave !== l.clave))
                }
                aria-label="Quitar"
                className="shrink-0 rounded-lg px-3 py-2 text-tinta-suave"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-5 rounded-2xl border border-borde bg-crema-alto p-4">
        <div className="flex gap-2">
          {(["active", "swim"] as const).map((c) => (
            <Chip
              key={c}
              activo={coleccion === c}
              onClick={() => {
                setColeccion(c);
                setTipoId("");
              }}
            >
              {c === "active" ? "Active" : "Swim"}
            </Chip>
          ))}
        </div>

        <div>
          <p className="mb-2 text-sm text-tinta-suave">Tipo</p>
          <div className="flex flex-wrap gap-2">
            {tiposVisibles.map((t) => (
              <Chip
                key={t.id}
                activo={tipoId === t.id}
                onClick={() => setTipoId(t.id)}
              >
                {t.nombre}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-tinta-suave">
            Estilo <span className="text-tinta-suave/60">(opcional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {listaEstilos.map((e) => (
              <Chip
                key={e.id}
                activo={!estiloNuevo && detalle === e.nombre}
                onClick={() => {
                  setEstiloNuevo(false);
                  setDetalle(detalle === e.nombre ? "" : e.nombre);
                }}
              >
                {e.nombre}
              </Chip>
            ))}
            <Chip
              activo={estiloNuevo}
              onClick={() => {
                setEstiloNuevo(!estiloNuevo);
                setDetalle("");
              }}
            >
              + Otro
            </Chip>
          </div>
          {estiloNuevo && (
            <input
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder="cómo le dicen ustedes"
              autoCapitalize="none"
              className="mt-2 w-full rounded-lg border border-borde bg-crema px-4 py-3 text-base outline-none focus:border-dorado"
            />
          )}
        </div>

        <div>
          <p className="mb-2 text-sm text-tinta-suave">Talla</p>
          <div className="flex flex-wrap gap-2">
            {TALLAS.map((t) => (
              <Chip key={t} activo={talla === t} onClick={() => setTalla(t)}>
                {t}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-tinta-suave">¿Cuántas piezas trae?</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Chip key={n} activo={piezas === n} onClick={() => cambiarPiezas(n)}>
                {n === 1 ? "Suelta" : n}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-sm text-tinta-suave">
              {piezas === 1 ? "Color" : "Colores"}
            </p>
            <p
              className={`text-sm tabular-nums ${
                faltan === 0 ? "text-tinta-suave" : "text-alerta"
              }`}
            >
              {faltan > 0
                ? `Faltan ${faltan} por repartir`
                : `${asignadas} de ${piezas}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {colores.map((c) => {
              const n = asignado[c.nombre] ?? 0;
              const lleno = asignadas >= piezas && n === 0;
              return (
                <span
                  key={c.id}
                  className={`flex items-center rounded-full border text-sm ${
                    n > 0
                      ? "border-dorado bg-dorado text-crema-alto"
                      : `border-borde bg-crema text-tinta ${lleno ? "opacity-35" : ""}`
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => sumarColor(c.nombre)}
                    disabled={lleno}
                    className={`flex items-center gap-2 py-2.5 pl-4 ${n > 0 ? "pr-1.5" : "pr-4"}`}
                  >
                    {c.hex && (
                      <span
                        aria-hidden
                        className="h-3.5 w-3.5 rounded-full border border-black/15"
                        style={{ backgroundColor: c.hex }}
                      />
                    )}
                    {c.nombre}
                    {n > 0 && <span className="tabular-nums">×{n}</span>}
                  </button>
                  {n > 0 && (
                    <button
                      type="button"
                      onClick={() => restarColor(c.nombre)}
                      aria-label={`Quitar un ${c.nombre}`}
                      className="py-2.5 pl-1.5 pr-3.5 text-crema-alto/80"
                    >
                      −
                    </button>
                  )}
                </span>
              );
            })}
          </div>

          {piezas > 1 && (
            <p className="mt-2 text-xs text-tinta-suave">
              Toca un color una vez por cada pieza de ese color. Si vienen dos
              negros y un blanco, toca Negro dos veces y Blanco una.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pagado" className="mb-2 block text-sm text-tinta-suave">
              Precio pagado
              {piezas > 1 && (
                <span className="text-tinta-suave/60"> por el pack</span>
              )}
            </label>
            <input
              id="pagado"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={precioPagado}
              onChange={(e) => setPrecioPagado(e.target.value)}
              className="w-full rounded-lg border border-borde bg-crema px-4 py-3 text-base tabular-nums outline-none focus:border-dorado"
            />
            {piezas > 1 && Number(precioPagado) > 0 && (
              <p className="mt-1.5 text-sm text-tinta-suave">
                {dinero.format(costoUnitario)} por prenda
              </p>
            )}
          </div>
          <div>
            <label htmlFor="venta" className="mb-2 block text-sm text-tinta-suave">
              Precio de venta
            </label>
            <input
              id="venta"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={precioVenta}
              onChange={(e) => setPrecioVenta(e.target.value)}
              className="w-full rounded-lg border border-borde bg-crema px-4 py-3 text-base tabular-nums outline-none focus:border-dorado"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={agregar}
          disabled={!completa}
          className="w-full rounded-lg border border-dorado bg-dorado-tenue px-4 py-3.5 text-base text-dorado disabled:opacity-40"
        >
          Agregar a la lista
        </button>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-alerta-tenue px-4 py-3 text-sm text-alerta"
        >
          {error}
        </p>
      )}

      {lineas.length > 0 && (
        <div className="fixed inset-x-0 bottom-14 border-t border-borde bg-crema/95 px-4 py-3 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="flex-1 text-sm text-tinta-suave">
              {totalPrendas} {totalPrendas === 1 ? "prenda" : "prendas"} ·{" "}
              {dinero.format(totalCosto)}
            </div>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="rounded-lg bg-tinta px-6 py-3 text-base text-crema-alto disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar entrada"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
