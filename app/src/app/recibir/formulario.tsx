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

/** Botón de opción. Grande a propósito: se usa con el pulgar y con prisa. */
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
  const [color, setColor] = useState("");
  const [talla, setTalla] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [precioPagado, setPrecioPagado] = useState("");
  const [piezasPack, setPiezasPack] = useState(1);
  const [precioVenta, setPrecioVenta] = useState("");

  const [lineas, setLineas] = useState<Linea[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tiposVisibles = useMemo(
    () => tipos.filter((t) => t.coleccion === coleccion),
    [tipos, coleccion],
  );

  // SHEIN cobra el pack completo. Que dividan de cabeza es justo donde se
  // cuelan los errores de costo, así que lo hace la app.
  const costoUnitario =
    piezasPack > 0 ? Number(precioPagado || 0) / piezasPack : 0;

  const completa = tipoId && color && talla && Number(precioPagado) > 0;

  async function agregar() {
    if (!completa) return;
    const tipo = tipos.find((t) => t.id === tipoId)!;
    const estilo = detalle.trim();

    // Un estilo escrito a mano se suma a la lista para que la próxima vez sea
    // un toque. La función de la base descarta duplicados por su cuenta, así
    // que "Musera" y "musera" no crean dos entradas.
    if (estiloNuevo && estilo && !listaEstilos.some((e) => e.nombre === estilo)) {
      const supabase = crearClienteNavegador();
      const { data: id } = await supabase.rpc("obtener_o_crear_estilo", {
        p_nombre: estilo,
      });
      if (id) setListaEstilos((prev) => [...prev, { id: id as string, nombre: estilo }]);
      setEstiloNuevo(false);
    }

    setLineas((prev) => [
      ...prev,
      {
        clave: crypto.randomUUID(),
        coleccion,
        tipo_id: tipoId,
        tipo_nombre: tipo.nombre,
        detalle: detalle.trim(),
        color,
        talla,
        cantidad,
        costo_unitario_usd: Number(costoUnitario.toFixed(2)),
        precio_venta_usd: precioVenta ? Number(precioVenta) : null,
      },
    ]);
    // Se conserva el tipo y el detalle: lo normal es cargar la misma prenda en
    // varias tallas o colores seguidos.
    setColor("");
    setTalla("");
    setCantidad(1);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);

    const supabase = crearClienteNavegador();
    const { error: fallo } = await supabase.rpc("registrar_entrada", {
      p_lineas: lineas.map(({ clave, tipo_nombre, ...resto }) => resto),
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
                  {l.detalle && ` ${l.detalle}`}
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
              <Chip key={t.id} activo={tipoId === t.id} onClick={() => setTipoId(t.id)}>
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
          <p className="mb-2 text-sm text-tinta-suave">Color</p>
          <div className="flex flex-wrap gap-2">
            {colores.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.nombre)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm ${
                  color === c.nombre
                    ? "border-dorado bg-dorado text-crema-alto"
                    : "border-borde bg-crema text-tinta"
                }`}
              >
                {c.hex && (
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 rounded-full border border-black/15"
                    style={{ backgroundColor: c.hex }}
                  />
                )}
                {c.nombre}
              </button>
            ))}
          </div>
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pagado" className="mb-2 block text-sm text-tinta-suave">
              Precio pagado
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

        <div>
          <p className="mb-2 text-sm text-tinta-suave">
            ¿Ese precio era por un pack?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip key={n} activo={piezasPack === n} onClick={() => setPiezasPack(n)}>
                {n === 1 ? "Suelta" : `Pack de ${n}`}
              </Chip>
            ))}
          </div>
          {piezasPack > 1 && Number(precioPagado) > 0 && (
            <p className="mt-2 text-sm text-tinta-suave">
              Costo por prenda: <strong>{dinero.format(costoUnitario)}</strong>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm text-tinta-suave">Cantidad</p>
          <button
            type="button"
            onClick={() => setCantidad((n) => Math.max(1, n - 1))}
            className="h-11 w-11 rounded-lg border border-borde bg-crema text-lg"
          >
            −
          </button>
          <span className="w-8 text-center text-lg tabular-nums">{cantidad}</span>
          <button
            type="button"
            onClick={() => setCantidad((n) => n + 1)}
            className="h-11 w-11 rounded-lg border border-borde bg-crema text-lg"
          >
            +
          </button>
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
        <p role="alert" className="rounded-lg bg-alerta-tenue px-4 py-3 text-sm text-alerta">
          {error}
        </p>
      )}

      {lineas.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-borde bg-crema/95 px-4 py-3 backdrop-blur">
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
