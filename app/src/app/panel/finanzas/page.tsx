import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  diaEnCaracas,
  inicioDelDia,
  limitesDelMes,
  mesEnPalabras,
  mesEnSiglas,
} from "@/lib/fechas";
import { NuevoCambio, NuevoMovimiento } from "./acciones";
import { BarraTasas, TasaDeVenta } from "./tasas";

export const dynamic = "force-dynamic";

const usd = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});
const num = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 });

const PERIODOS = [
  { id: "hoy", nombre: "Hoy", dias: 0 },
  { id: "7", nombre: "7 días", dias: 6 },
  { id: "30", nombre: "30 días", dias: 29 },
  { id: "90", nombre: "90 días", dias: 89 },
];

/** Hace `dias` días, contado sobre el calendario de Caracas. */
function fecha(dias: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - dias);
  return diaEnCaracas(d);
}

function Dato({
  etiqueta,
  valor,
  pie,
  tono,
}: {
  etiqueta: string;
  valor: string;
  pie?: string;
  tono?: "bueno" | "alerta";
}) {
  return (
    <div className="rounded-2xl border border-borde bg-crema-alto p-4">
      <p className="text-xs uppercase tracking-wide text-tinta-suave">{etiqueta}</p>
      <p
        className={`mt-1.5 text-2xl tabular-nums ${
          tono === "bueno" ? "text-marron-hondo" : tono === "alerta" ? "text-alerta" : "text-tinta"
        }`}
      >
        {valor}
      </p>
      {pie && <p className="mt-1 text-xs text-tinta-suave">{pie}</p>}
    </div>
  );
}

export default async function Finanzas({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; m?: string }>;
}) {
  const { p, m } = await searchParams;

  // Un mes manda sobre los días corridos. Los dos conviven porque responden
  // preguntas distintas: los días dicen cómo va la racha, el mes es el que
  // cuadra con el cierre de caja.
  const mes = m && /^\d{4}-\d{2}$/.test(m) ? m : null;
  const periodo = mes ? null : (PERIODOS.find((x) => x.id === p) ?? PERIODOS[2]);
  const hoy = diaEnCaracas();
  const limites = mes ? limitesDelMes(mes) : null;
  const desde = limites ? limites.desde : fecha(periodo!.dias);
  // Un mes en curso llega hasta hoy: mostrar el mes entero haría creer que las
  // cifras están cerradas cuando todavía faltan días por vender.
  const hasta = limites ? (limites.hasta > hoy ? hoy : limites.hasta) : hoy;

  /** Los últimos meses, para el selector. */
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${hoy.slice(0, 7)}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    return d.toISOString().slice(0, 7);
  });

  const supabase = await crearClienteServidor();

  const [{ data: reporte }, { data: tasaVenta }, { data: movimientos }] =
    await Promise.all([
      supabase.rpc("reporte_finanzas", { p_desde: desde, p_hasta: hasta }),
      supabase
        .from("tasas_venta")
        .select("fecha,bs_por_usd,base")
        .order("fecha", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("movimientos_financieros")
        .select("id,tipo,concepto,categoria,monto_original,moneda,monto_usd,metodo_pago,ocurrido_at")
        .gte("ocurrido_at", inicioDelDia(desde))
        .order("ocurrido_at", { ascending: false })
        .limit(25),
    ]);

  const r = (reporte?.[0] ?? {}) as Record<string, number>;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-7">
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <div className="shrink-0">
          <h1 className="text-2xl text-tinta">Finanzas</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {mes
              ? mesEnPalabras(mes)
              : periodo!.dias === 0
                ? "Hoy"
                : `Últimos ${periodo!.dias + 1} días`}
          </p>
        </div>

        {/* En pantalla ancha la barra de tasas va entre el título y los
            períodos; en la tablet en vertical se baja a su propia línea. */}
        <div className="order-last w-full lg:order-none lg:w-auto lg:flex-1">
          <BarraTasas
            tasaVenta={tasaVenta ? Number(tasaVenta.bs_por_usd) : null}
          />
        </div>

        <nav className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
          {PERIODOS.map((x) => (
            <Link
              key={x.id}
              href={`/panel/finanzas?p=${x.id}`}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                !mes && x.id === periodo!.id
                  ? "border-marron bg-marron text-crema-alto"
                  : "border-borde bg-crema-alto text-tinta-suave"
              }`}
            >
              {x.nombre}
            </Link>
          ))}
          <span aria-hidden className="mx-1 h-5 w-px bg-borde" />
          {meses.map((x) => (
            <Link
              key={x}
              href={`/panel/finanzas?m=${x}`}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                mes === x
                  ? "border-marron bg-marron text-crema-alto"
                  : "border-borde bg-crema-alto text-tinta-suave"
              }`}
            >
              {mesEnSiglas(x)}
            </Link>
          ))}
        </nav>
      </header>

      <section className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato
          etiqueta="Vendido"
          valor={usd.format(r.ventas_usd ?? 0)}
          pie={`${r.ventas_cantidad ?? 0} ventas · ${r.unidades ?? 0} prendas`}
        />
        <Dato
          etiqueta="Utilidad bruta"
          valor={usd.format(r.utilidad_bruta_usd ?? 0)}
          pie={`Margen ${r.margen_pct ?? 0}%`}
          tono="bueno"
        />
        <Dato
          etiqueta="Gastos"
          valor={usd.format(r.egresos_usd ?? 0)}
          pie="Del período"
          tono={r.egresos_usd > 0 ? "alerta" : undefined}
        />
        <Dato
          etiqueta="Utilidad neta"
          valor={usd.format(r.utilidad_neta_usd ?? 0)}
          pie="Bruta menos gastos"
        />
      </section>

      <section className="mb-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-borde bg-crema-alto p-5">
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Cómo cobraron
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-tinta-suave">En divisa</span>
              <span className="tabular-nums text-tinta">
                {usd.format(r.cobrado_divisa_usd ?? 0)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-tinta-suave">En bolívares</span>
              <span className="tabular-nums text-tinta">
                {usd.format(r.cobrado_bs_usd ?? 0)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-borde pt-2">
              <span className="text-tinta-suave">Ticket promedio</span>
              <span className="tabular-nums text-tinta">
                {usd.format(r.ticket_promedio_usd ?? 0)}
              </span>
            </div>
          </div>
        </div>

        <TasaDeVenta
          tasa={tasaVenta ? Number(tasaVenta.bs_por_usd) : null}
          base={tasaVenta?.base ?? null}
          fecha={tasaVenta?.fecha ?? null}
        />
      </section>

      <section className="rounded-2xl border border-borde bg-crema-alto p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Movimientos
          </p>
          <div className="flex flex-wrap gap-2">
            <NuevoMovimiento
              tasa={tasaVenta ? Number(tasaVenta.bs_por_usd) : null}
            />
            <NuevoCambio />
          </div>
        </div>

        {(movimientos ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-tinta-suave">
            Sin movimientos en este período.
          </p>
        ) : (
          <ul className="divide-y divide-borde">
            {(movimientos ?? []).map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                {/* Un cambio no es ni ingreso ni gasto: el dinero solo se mudó
                    de caja. Pintarlo en rojo como un gasto haría creer que el
                    negocio perdió esa plata. */}
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    m.tipo === "ingreso"
                      ? "bg-marron"
                      : m.tipo === "cambio"
                        ? "bg-tinta-suave"
                        : "bg-alerta"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-tinta">{m.concepto}</p>
                  <p className="text-xs capitalize text-tinta-suave">
                    {[
                      m.categoria,
                      m.tipo === "cambio" ? m.metodo_pago?.replace(/_/g, " ") : null,
                      new Date(m.ocurrido_at).toLocaleDateString("es-VE"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 text-right text-sm tabular-nums text-tinta">
                  {m.tipo === "egreso" ? "−" : m.tipo === "cambio" ? "⇄ " : "+"}
                  {usd.format(Number(m.monto_usd))}
                  {m.moneda === "BS" && (
                    <span className="block text-xs text-tinta-suave">
                      {num.format(Number(m.monto_original))} Bs
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
