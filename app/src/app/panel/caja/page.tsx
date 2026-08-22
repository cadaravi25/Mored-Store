import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  diaEnCaracas,
  enCorto,
  limitesDelMes,
  mesDe,
  mesEnPalabras,
  mesEnSiglas,
} from "@/lib/fechas";
import Arqueo, { type Resumen } from "./arqueo";
import Periodo from "./periodo";

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
  hasta: string;
  diferencia_usd: number | null;
  diferencia_bs: number | null;
  total_ventas_usd: number | null;
  cantidad_ventas: number | null;
}

interface MesConCaja {
  mes: string;
  ventas: number;
  total_usd: number;
  cerrado: boolean;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * La caja se cierra por mes.
 *
 * Yolima y Sara hacen el cierre mensual, no diario, así que la pantalla ya no
 * pide cuadrar el efectivo cada noche. Entra mostrando el mes en curso, y el
 * detalle por día se puede mirar dentro del mes sin tener que cerrar nada.
 *
 * El rango a mano existe porque no todos los cortes caen en un mes limpio: si
 * se fueron de viaje y quieren cuadrar lo de una semana suelta, se puede.
 */
export default async function Caja({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; m?: string }>;
}) {
  const { desde: d, hasta: h, m } = await searchParams;
  const hoy = diaEnCaracas();

  // Un rango a mano manda sobre el mes. Si no hay nada, el mes en curso.
  let desde: string;
  let hasta: string;
  if (d && h && FECHA.test(d) && FECHA.test(h) && d <= h) {
    desde = d;
    hasta = h;
  } else {
    const limites = limitesDelMes(m && /^\d{4}-\d{2}$/.test(m) ? m : mesDe(hoy));
    desde = limites.desde;
    hasta = limites.hasta;
  }
  // Cuadrar contra días que todavía no llegaron no tiene sentido, y además
  // haría ver el mes en curso como si ya hubiera terminado.
  if (hasta > hoy) hasta = hoy;

  const esMesCompleto =
    desde === limitesDelMes(mesDe(desde)).desde &&
    (hasta === limitesDelMes(mesDe(desde)).hasta || mesDe(desde) === mesDe(hoy));

  const supabase = await crearClienteServidor();
  const [{ data: resumen, error }, { data: meses }, { data: anteriores }] =
    await Promise.all([
      supabase.rpc("resumen_caja_rango", { p_desde: desde, p_hasta: hasta }),
      supabase.rpc("meses_de_caja"),
      supabase
        .from("cierres_caja")
        .select(
          "fecha,hasta,diferencia_usd,diferencia_bs,total_ventas_usd,cantidad_ventas",
        )
        .eq("estado", "cerrado")
        .order("fecha", { ascending: false })
        .limit(8),
    ]);

  if (error || !resumen) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-7">
        <h1 className="text-2xl text-tinta">Caja</h1>
        <p className="mt-4 rounded-2xl bg-alerta-tenue px-4 py-3 text-sm text-alerta">
          No se pudo cargar el corte. {error?.message}
        </p>
      </main>
    );
  }

  const r = resumen as Resumen;
  const cerrado = r.cierre?.estado === "cerrado";
  const detalle = r.detalle ?? [];
  const dias = r.dias ?? [];
  const enEspera = r.por_verificar?.cantidad ?? 0;
  const mesActivo = mesDe(desde);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-7">
      <header className="mb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl text-tinta">Caja</h1>
          {cerrado && (
            <span className="rounded-full bg-marron-tenue px-2.5 py-1 text-xs uppercase tracking-wide text-marron-hondo">
              cerrada
            </span>
          )}
        </div>
        <p className="mt-1 text-sm capitalize text-tinta-suave">
          {esMesCompleto
            ? mesEnPalabras(mesActivo)
            : `${enCorto(desde)} — ${enCorto(hasta)}`}
        </p>
      </header>

      {/* Los meses primero, que es como cierran. El rango a mano queda detrás
          de un toque, para lo que no cuadre con un mes. */}
      <nav className="mb-4 flex flex-wrap gap-1.5">
        {((meses ?? []) as MesConCaja[]).slice(0, 12).map((x) => (
          <Link
            key={x.mes}
            href={`/panel/caja?m=${x.mes.slice(0, 7)}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              esMesCompleto && mesDe(x.mes) === mesActivo
                ? "border-marron bg-marron text-crema-alto"
                : "border-borde bg-crema-alto text-tinta-suave"
            }`}
          >
            {mesEnSiglas(mesDe(x.mes))}
            {x.cerrado && <span className="ml-1 text-xs opacity-60">·</span>}
          </Link>
        ))}
      </nav>

      <Periodo desde={desde} hasta={hasta} aMano={!esMesCompleto} />

      <section className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-borde bg-crema-alto p-4">
          {/* "Cobrado" y no "vendido": un apartado a medio pagar entra por lo
              que pagaron, que es lo que tiene que cuadrar con la caja. */}
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
            Todavía no hay cobros en este período.
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

      {/* El desglose por día no decide nada del cierre: está para que al
          cuadrar se vea qué día se salió de lo normal. */}
      {dias.length > 1 && (
        <section className="mb-3 rounded-2xl border border-borde bg-crema-alto p-5">
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Día por día
          </p>
          <ul className="mt-2 divide-y divide-borde">
            {dias.map((x) => (
              <li
                key={x.dia}
                className="flex items-baseline justify-between gap-3 py-2"
              >
                <span className="text-sm text-tinta">{enCorto(x.dia)}</span>
                <span className="text-xs text-tinta-suave">
                  {x.ventas} {x.ventas === 1 ? "venta" : "ventas"}
                </span>
                <span className="text-sm tabular-nums text-tinta">
                  {usd.format(Number(x.total_usd))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Arqueo desde={desde} hasta={hasta} resumen={r} />

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
              const unDia = c.fecha === c.hasta;
              return (
                <li key={`${c.fecha}-${c.hasta}`}>
                  <Link
                    href={`/panel/caja?desde=${c.fecha}&hasta=${c.hasta}`}
                    className="flex items-baseline justify-between gap-3 py-2.5 hover:text-marron-hondo"
                  >
                    <span className="text-sm capitalize text-tinta">
                      {unDia
                        ? enCorto(c.fecha)
                        : c.fecha === limitesDelMes(mesDe(c.fecha)).desde &&
                            c.hasta === limitesDelMes(mesDe(c.fecha)).hasta
                          ? mesEnPalabras(mesDe(c.fecha))
                          : `${enCorto(c.fecha)} — ${enCorto(c.hasta)}`}
                    </span>
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
