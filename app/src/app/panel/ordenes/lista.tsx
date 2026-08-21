"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { colorVisible, tallaVisible } from "@/lib/prendas";

export interface FilaOrden {
  venta_id: string;
  numero: number;
  estado: string;
  creado_at: string;
  total_usd: number;
  total_bs: number;
  linea_id: string;
  variante_id: string;
  producto_id: string;
  producto: string;
  descripcion: string | null;
  coleccion: string;
  color: string;
  hex: string | null;
  talla: string;
  cantidad: number;
  precio_usd: number;
  precio_bs: number;
  foto_url: string | null;
  disponible: number;
}

const eur = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "EUR",
});

const cuando = new Intl.DateTimeFormat("es-VE", {
  timeZone: "America/Caracas",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Cómo se llama cada estado para quien atiende. 'borrador' es vocabulario de
 *  la base; lo que ellas necesitan leer es si está atendida o no. */
const ESTADOS: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: "Sin atender", clase: "bg-marron-tenue text-marron-hondo" },
  atendida: { texto: "Cobrada", clase: "bg-crema text-tinta-suave" },
  anulada: { texto: "Cancelada", clase: "bg-alerta-tenue text-alerta" },
};

/**
 * La clave de la orden que se está por cobrar.
 *
 * Viaja por sessionStorage y no por la dirección porque son varias prendas con
 * sus fotos y sus precios: meter eso en la barra de direcciones sería una
 * dirección de mil caracteres que además se puede editar a mano.
 */
export const LLAVE_ORDEN = "mored-orden-a-cobrar";

export default function Lista({
  filas,
  tasa,
}: {
  filas: FilaOrden[];
  tasa: number | null;
}) {
  const router = useRouter();
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Una fila por prenda, pero se atiende por orden: se reagrupan.
  const ordenes = useMemo(() => {
    const mapa = new Map<string, { cabecera: FilaOrden; lineas: FilaOrden[] }>();
    for (const f of filas) {
      if (!mapa.has(f.venta_id)) mapa.set(f.venta_id, { cabecera: f, lineas: [] });
      mapa.get(f.venta_id)!.lineas.push(f);
    }
    return [...mapa.values()];
  }, [filas]);

  const pendientes = ordenes.filter((o) => o.cabecera.estado === "borrador");

  async function cancelar(venta_id: string) {
    setOcupada(venta_id);
    setError(null);
    const { error: fallo } = await crearClienteNavegador().rpc("cancelar_orden", {
      p_venta_id: venta_id,
    });
    if (fallo) {
      setError(fallo.message);
      setOcupada(null);
      return;
    }
    router.refresh();
    setOcupada(null);
  }

  /**
   * Cobrar no cobra aquí: manda la orden a Vender con todo cargado.
   *
   * Ahí están los métodos de pago, la tasa, el cliente y el arqueo, ya
   * probados. Y de paso ahí mismo pueden quitar una prenda, cambiar la
   * cantidad o agregar otra si la clienta cambió de idea, que es lo que
   * pediste poder hacer, sin construir una segunda pantalla que haga lo mismo.
   */
  function cobrar(o: { cabecera: FilaOrden; lineas: FilaOrden[] }) {
    const carrito = o.lineas.map((l) => ({
      variante_id: l.variante_id,
      producto_id: l.producto_id,
      producto_nombre: l.producto,
      color_nombre: l.color,
      color_hex: l.hex,
      foto_url: l.foto_url,
      talla: l.talla,
      precio_usd: Number(l.precio_usd),
      precio_bs: Number(l.precio_bs),
      disponible: l.disponible,
      cantidad: l.cantidad,
    }));
    window.sessionStorage.setItem(
      LLAVE_ORDEN,
      JSON.stringify({ id: o.cabecera.venta_id, numero: o.cabecera.numero, carrito }),
    );
    router.push(`/panel/vender?orden=${o.cabecera.venta_id}`);
  }

  if (ordenes.length === 0) {
    return (
      <p className="rounded-xl border border-borde bg-crema-alto px-5 py-12 text-center text-sm text-tinta-suave">
        Todavía no ha entrado ninguna orden por la tienda.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl bg-alerta-tenue px-4 py-3 text-sm text-alerta">
          {error}
        </p>
      )}

      <p className="text-sm text-tinta-suave">
        {pendientes.length === 0
          ? "Nada sin atender."
          : `${pendientes.length} sin atender`}
      </p>

      {ordenes.map(({ cabecera, lineas }) => {
        const estado = ESTADOS[cabecera.estado] ?? {
          texto: cabecera.estado,
          clase: "bg-crema text-tinta-suave",
        };
        const pendiente = cabecera.estado === "borrador";
        const piezas = lineas.reduce((s, l) => s + l.cantidad, 0);

        return (
          <article
            key={cabecera.venta_id}
            className={`rounded-xl border bg-crema-alto ${
              pendiente ? "border-marron-suave" : "border-borde opacity-75"
            }`}
          >
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-borde px-4 py-3">
              <div className="flex items-baseline gap-3">
                <span className="text-tinta">Pedido #{cabecera.numero}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${estado.clase}`}>
                  {estado.texto}
                </span>
              </div>
              <span className="text-xs text-tinta-suave">
                {cuando.format(new Date(cabecera.creado_at))} · {piezas}{" "}
                {piezas === 1 ? "pieza" : "piezas"}
              </span>
            </header>

            <ul className="divide-y divide-borde">
              {lineas.map((l) => {
                // Que la orden llegue no significa que la prenda siga estando.
                // Alguien pudo venderla en el local mientras tanto.
                const falta = l.disponible < l.cantidad;
                return (
                  <li key={l.linea_id} className="flex gap-3 px-4 py-3">
                    {l.foto_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={l.foto_url}
                        alt=""
                        loading="lazy"
                        className="h-16 w-16 shrink-0 rounded-lg border border-borde object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="h-16 w-16 shrink-0 rounded-lg border border-borde"
                        style={{ backgroundColor: l.hex ?? "#efe9dd" }}
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-tinta">
                        {l.cantidad > 1 && `${l.cantidad}× `}
                        {l.producto}
                      </p>
                      {l.descripcion && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-tinta-suave">
                          {l.descripcion}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-tinta-suave">
                        {[colorVisible(l.color), tallaVisible(l.talla)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {falta && (
                        <p className="mt-1 text-xs text-alerta">
                          {l.disponible === 0
                            ? "Ya no queda ninguna"
                            : `Solo quedan ${l.disponible}`}
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 text-sm tabular-nums text-tinta">
                      {eur.format(l.cantidad * Number(l.precio_usd))}
                    </span>
                  </li>
                );
              })}
            </ul>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-borde px-4 py-3">
              <div>
                <span className="text-sm tabular-nums text-tinta">
                  {eur.format(Number(cabecera.total_usd))}
                </span>
                {/* El de bolívares no es una conversión del de divisas: son dos
                    precios distintos, y este es el que se cobra si pagan en Bs. */}
                {tasa && Number(cabecera.total_bs) > 0 && (
                  <span className="ml-2 text-xs text-tinta-suave">
                    o Bs{" "}
                    {Number(cabecera.total_bs).toLocaleString("es-VE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                )}
              </div>

              {pendiente && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => cancelar(cabecera.venta_id)}
                    disabled={ocupada === cabecera.venta_id}
                    className="rounded-lg border border-borde px-3 py-1.5 text-xs text-tinta-suave disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => cobrar({ cabecera, lineas })}
                    disabled={ocupada === cabecera.venta_id}
                    className="rounded-lg bg-tinta px-4 py-1.5 text-xs text-crema-alto disabled:opacity-50"
                  >
                    Cobrar
                  </button>
                </div>
              )}
            </footer>
          </article>
        );
      })}
    </div>
  );
}
