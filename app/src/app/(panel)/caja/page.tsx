import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { diaEnCaracas, enPalabras, enCorto } from "@/lib/fechas";
import Arqueo, { type Resumen } from "./arqueo";

export const dynamic = "force-dynamic";

const usd = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});
const num = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 });

const NOMBRE_METODO: Record<string, string> = {
  efectivo_usd: "Efectivo $",
  efectivo_bs: "Efectivo Bs",
  zelle: "Zelle",
  binance: "Binance",
  zinli: "Zinli",
  pago_movil: "Pago móvil",
  transferencia: "Transferencia",
  punto: "Punto",
};

interface Cierre {
  fecha: string;
  diferencia_usd: number | null;
  diferencia_bs: number | null;
  total_ventas_usd: number | null;
  cantidad_ventas: number | null;
}

/** Un día anterior, en formato aaaa-mm-dd. */
function diaAntes(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default async function Caja({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f } = await searchParams;
  const hoy = diaEnCaracas();
  // Solo se acepta una fecha con forma de fecha, y nunca del futuro.
  const fecha =
    f && /^\d{4}-\d{2}-\d{2}$/.test(f) && f <= hoy ? f : hoy;

  const supabase = await crearClienteServidor();
  const [{ data: resumen, error }, { data: anteriores }] = await Promise.all([
    supabase.rpc("resumen_caja", { p_fecha: fecha }),
    supabase
      .from("cierres_caja")
      .select("fecha,diferencia_usd,diferencia_bs,total_ventas_usd,cantidad_ventas")
      .eq("estado", "cerrado")
      .order("fecha", { ascending: false })
      .limit(8),
  ]);

  if (error || !resumen) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-7">
        <h1 className="text-2xl text-tinta">Caja</h1>
        <p className="mt-4 rounded-2xl bg-alerta-tenue px-4 py-3 text-sm text-alerta">
          No se pudo cargar el corte del día. {error?.message}
        </p>
      </main>
    );
  }

  const r = resumen as Resumen;
  const cerrado = r.cierre?.estado === "cerrado";
  const detalle = r.detalle ?? [];
  const enEspera = r.por_verificar?.cantidad ?? 0;
  const ayer = diaAntes(hoy);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-7">
      <header className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl text-tinta">Caja</h1>
          <nav className="flex gap-1.5">
            {[
              { id: hoy, nombre: "Hoy" },
              { id: ayer, nombre: "Ayer" },
            ].map((x) => (
              <Link
                key={x.id}
                href={`/caja?f=${x.id}`}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  x.id === fecha
                    ? "border-marron bg-marron text-crema-alto"
                    : "border-borde bg-crema-alto text-tinta-suave"
                }`}
              >
                {x.nombre}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-1 text-sm capitalize text-tinta-suave">
          {enPalabras(fecha)}
          {cerrado && (
            <span className="ml-2 rounded-full bg-marron-tenue px-2 py-0.5 text-xs uppercase not-italic tracking-wide text-marron-hondo">
              cerrada
            </span>
          )}
        </p>
      </header>

      <section className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-borde bg-crema-alto p-4">
          {/* "Cobrado" y no "vendido": un apartado a medio pagar entra por lo
              que pagaron hoy, que es lo que tiene que cuadrar con la caja. */}
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Cobrado
          </p>
          <p className="mt-1.5 text-2xl tabular-nums text-tinta">
            {usd.format(r.total_ventas_usd ?? 0)}
          </p>
          <p className="mt-1 text-xs text-tinta-suave">
            {r.cantidad_ventas ?? 0}{" "}
            {r.cantidad_ventas === 1 ? "venta" : "ventas"}
          </p>
        </div>
        <div className="rounded-2xl border border-marron-suave bg-marron-tenue p-4">
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Efectivo $
          </p>
          <p className="mt-1.5 text-2xl tabular-nums text-tinta">
            {usd.format(r.efectivo_usd_esperado ?? 0)}
          </p>
          <p className="mt-1 text-xs text-tinta-suave">Debería haber en caja</p>
        </div>
        <div className="rounded-2xl border border-marron-suave bg-marron-tenue p-4">
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Efectivo Bs
          </p>
          <p className="mt-1.5 text-2xl tabular-nums text-tinta">
            {num.format(r.efectivo_bs_esperado ?? 0)}
          </p>
          <p className="mt-1 text-xs text-tinta-suave">Debería haber en caja</p>
        </div>
      </section>

      {enEspera > 0 && (
        <p className="mb-3 rounded-2xl bg-alerta-tenue px-4 py-3 text-sm text-alerta">
          Hay {enEspera} {enEspera === 1 ? "pago reportado" : "pagos reportados"}{" "}
          sin verificar, por {usd.format(r.por_verificar?.monto_usd ?? 0)}. No
          están contados aquí: si los verifican, estos números cambian.
        </p>
      )}

      <section className="mb-3 rounded-2xl border border-borde bg-crema-alto p-5">
        <p className="text-xs uppercase tracking-wide text-tinta-suave">
          Cómo entró la plata
        </p>
        {detalle.length === 0 ? (
          <p className="py-8 text-center text-sm text-tinta-suave">
            Todavía no hay cobros en este día.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-borde">
            {detalle.map((d) => (
              <li
                key={`${d.metodo}-${d.moneda}`}
                className="flex items-baseline justify-between gap-3 py-2.5"
              >
                <span className="text-sm text-tinta">
                  {NOMBRE_METODO[d.metodo] ?? d.metodo}
                </span>
                <span className="text-xs text-tinta-suave">
                  {d.cantidad} {d.cantidad === 1 ? "cobro" : "cobros"}
                </span>
                <span className="text-right text-sm tabular-nums text-tinta">
                  {d.moneda === "BS"
                    ? `${num.format(d.monto)} Bs`
                    : usd.format(d.monto)}
                  {d.moneda === "BS" && (
                    <span className="block text-xs text-tinta-suave">
                      {usd.format(d.monto_usd)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {(r.movimientos_usd !== 0 || r.movimientos_bs !== 0) && (
          <p className="mt-3 border-t border-borde pt-3 text-xs text-tinta-suave">
            Incluye movimientos de caja hechos a mano:{" "}
            {r.movimientos_usd !== 0 && `${usd.format(r.movimientos_usd)} `}
            {r.movimientos_bs !== 0 && `${num.format(r.movimientos_bs)} Bs`}
          </p>
        )}
      </section>

      <Arqueo fecha={fecha} resumen={r} />

      {(anteriores ?? []).length > 0 && (
        <section className="mt-3 rounded-2xl border border-borde bg-crema-alto p-5">
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Cierres anteriores
          </p>
          <ul className="mt-2 divide-y divide-borde">
            {((anteriores ?? []) as Cierre[]).map((c) => {
              const dif = Number(c.diferencia_usd ?? 0);
              const difBs = Number(c.diferencia_bs ?? 0);
              const cuadra = dif === 0 && difBs === 0;
              return (
                <li key={c.fecha}>
                  <Link
                    href={`/caja?f=${c.fecha}`}
                    className="flex items-baseline justify-between gap-3 py-2.5 hover:text-marron-hondo"
                  >
                    <span className="text-sm text-tinta">{enCorto(c.fecha)}</span>
                    <span className="text-xs text-tinta-suave">
                      {c.cantidad_ventas ?? 0}{" "}
                      {c.cantidad_ventas === 1 ? "venta" : "ventas"} ·{" "}
                      {usd.format(Number(c.total_ventas_usd ?? 0))}
                    </span>
                    <span
                      className={`text-sm tabular-nums ${
                        cuadra ? "text-tinta-suave" : "text-alerta"
                      }`}
                    >
                      {cuadra
                        ? "cuadró"
                        : [
                            dif !== 0 &&
                              `${dif > 0 ? "+" : "−"}${usd.format(Math.abs(dif))}`,
                            difBs !== 0 &&
                              `${difBs > 0 ? "+" : "−"}${num.format(Math.abs(difBs))} Bs`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
