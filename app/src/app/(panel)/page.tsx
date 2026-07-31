import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { diaEnCaracas, inicioDelDia, finDelDia, enPalabras } from "@/lib/fechas";

export const dynamic = "force-dynamic";

const dinero = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const dineroFino = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

/** Con dos o menos de una talla, esa talla se acaba con la próxima clienta.
 *  Avisar ahí da margen para reponer antes de quedarse en cero. */
const POCO_STOCK = 2;

function Tarjeta({
  etiqueta,
  valor,
  pie,
  acento,
}: {
  etiqueta: string;
  valor: string;
  pie?: string;
  acento?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        acento
          ? "border-marron-suave bg-marron-tenue"
          : "border-borde bg-crema-alto"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-tinta-suave">
        {etiqueta}
      </p>
      <p className="mt-1.5 text-2xl tabular-nums text-tinta">{valor}</p>
      {pie && <p className="mt-1 text-xs text-tinta-suave">{pie}</p>}
    </div>
  );
}

export default async function Panel() {
  const supabase = await crearClienteServidor();
  const hoy = diaEnCaracas();

  const [{ data: variantes }, { data: ventasHoy }, { data: ultimas }] =
    await Promise.all([
      supabase
        .from("variantes")
        .select("id,stock,costo_promedio_usd,precio_usd")
        .eq("activa", true),
      supabase
        .from("ventas")
        .select("id,total_usd")
        .gte("creado_at", inicioDelDia(hoy))
        .lt("creado_at", finDelDia(hoy))
        .neq("estado", "anulada"),
      supabase
        .from("ventas")
        .select("id,numero,total_usd,canal,creado_at")
        .neq("estado", "anulada")
        .order("creado_at", { ascending: false })
        .limit(5),
    ]);

  const v = variantes ?? [];
  const prendas = v.reduce((s, x) => s + x.stock, 0);
  const costo = v.reduce(
    (s, x) => s + x.stock * Number(x.costo_promedio_usd ?? 0),
    0,
  );
  const venta = v.reduce((s, x) => s + x.stock * Number(x.precio_usd ?? 0), 0);
  const margen = venta > 0 ? ((venta - costo) / venta) * 100 : 0;

  const pocas = v.filter((x) => x.stock > 0 && x.stock <= POCO_STOCK).length;
  const agotadas = v.filter((x) => x.stock <= 0).length;

  const nVentas = (ventasHoy ?? []).length;
  const montoHoy = (ventasHoy ?? []).reduce(
    (s, x) => s + Number(x.total_usd ?? 0),
    0,
  );
  const ticket = nVentas > 0 ? montoHoy / nVentas : 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-7">
      <header className="mb-7">
        <h1 className="text-2xl text-tinta">Panel</h1>
        <p className="mt-1 text-sm capitalize text-tinta-suave">
          {enPalabras(hoy)}
        </p>
      </header>

      <section className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta
          etiqueta="Ventas hoy"
          valor={String(nVentas)}
          pie={nVentas > 0 ? dineroFino.format(montoHoy) : "Sin ventas aún"}
          acento
        />
        <Tarjeta
          etiqueta="Ticket promedio"
          valor={nVentas > 0 ? dineroFino.format(ticket) : "—"}
          pie="Hoy"
        />
        <Tarjeta
          etiqueta="Prendas"
          valor={String(prendas)}
          pie={`${v.length} ${v.length === 1 ? "variante" : "variantes"}`}
        />
        <Tarjeta
          etiqueta="Margen"
          valor={venta > 0 ? `${margen.toFixed(0)}%` : "—"}
          pie="Sobre el inventario actual"
        />
      </section>

      <section className="mb-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-borde bg-crema-alto p-5">
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Valor del inventario
          </p>
          <div className="mt-3 flex items-baseline gap-7">
            <div>
              <p className="text-2xl tabular-nums text-tinta">
                {dinero.format(costo)}
              </p>
              <p className="text-xs text-tinta-suave">a costo</p>
            </div>
            <div>
              <p className="text-2xl tabular-nums text-marron-hondo">
                {dinero.format(venta)}
              </p>
              <p className="text-xs text-tinta-suave">a precio de venta</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-borde bg-crema-alto p-5">
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Atención
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-tinta-suave">Tallas por agotarse</dt>
              <dd
                className={`tabular-nums ${pocas > 0 ? "text-alerta" : "text-tinta"}`}
              >
                {pocas}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-tinta-suave">Tallas agotadas</dt>
              <dd className="tabular-nums text-tinta">{agotadas}</dd>
            </div>
          </dl>
          <Link
            href="/inventario"
            className="mt-4 inline-block text-sm text-marron-hondo underline-offset-4 hover:underline"
          >
            Ver inventario
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-borde bg-crema-alto p-5">
        <p className="text-xs uppercase tracking-wide text-tinta-suave">
          Últimas ventas
        </p>
        {(ultimas ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-tinta-suave">
            Todavía no hay ventas registradas.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-borde">
            {(ultimas ?? []).map((x) => (
              <li
                key={x.id}
                className="flex items-baseline justify-between gap-3 py-2.5"
              >
                <span className="text-sm text-tinta">NE-{x.numero}</span>
                <span className="text-sm capitalize text-tinta-suave">
                  {x.canal}
                </span>
                <span className="text-sm tabular-nums text-tinta">
                  {dineroFino.format(Number(x.total_usd ?? 0))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
