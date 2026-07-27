import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { correoAUsuario } from "@/lib/auth";

/** Fila de v_prendas_pendientes. */
interface PrendaPendiente {
  componente_id: string;
  numero_externo: string | null;
  producto: string;
  color: string;
  talla: string;
  piezas_faltantes: number;
  monto_faltante_usd: number | null;
  dias_esperando: number;
}

// El pendiente cambia con cada recepción: nunca servir esto cacheado.
export const dynamic = "force-dynamic";

const dinero = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export default async function PorLlegar() {
  const supabase = await crearClienteServidor();

  // La verificación real va aquí, en el servidor. El proxy solo mejora la
  // experiencia: puede desplegarse en el CDN, separado del render.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data, error } = await supabase
    .from("v_prendas_pendientes")
    .select(
      "componente_id,numero_externo,producto,color,talla,piezas_faltantes,monto_faltante_usd,dias_esperando",
    )
    .order("dias_esperando", { ascending: false })
    .order("producto");

  const prendas = (data ?? []) as PrendaPendiente[];
  const totalPrendas = prendas.reduce((s, p) => s + p.piezas_faltantes, 0);
  const totalMonto = prendas.reduce(
    (s, p) => s + Number(p.monto_faltante_usd ?? 0),
    0,
  );
  const pedidos = new Set(prendas.map((p) => p.numero_externo)).size;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl text-tinta">Por llegar</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Lo que falta de los pedidos abiertos
          </p>
        </div>
        <span className="shrink-0 text-sm text-tinta-suave">
          {correoAUsuario(user.email)}
        </span>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-alerta-tenue px-5 py-4 text-sm text-alerta"
        >
          No se pudo leer el pendiente: {error.message}
        </p>
      ) : prendas.length === 0 ? (
        <p className="rounded-xl border border-borde bg-crema-alto px-5 py-10 text-center text-tinta-suave">
          No hay nada pendiente por llegar.
        </p>
      ) : (
        <>
          <dl className="mb-7 grid grid-cols-3 gap-3">
            {[
              ["Prendas", String(totalPrendas)],
              ["Valor", dinero.format(totalMonto)],
              ["Pedidos", String(pedidos)],
            ].map(([etiqueta, valor]) => (
              <div
                key={etiqueta}
                className="rounded-xl border border-borde bg-crema-alto px-4 py-3"
              >
                <dt className="text-xs uppercase tracking-wide text-tinta-suave">
                  {etiqueta}
                </dt>
                <dd className="mt-1 text-xl tabular-nums text-tinta">{valor}</dd>
              </div>
            ))}
          </dl>

          <ul className="space-y-2">
            {prendas.map((p) => {
              // Pasadas tres semanas, la espera ya merece una decisión.
              const demorada = p.dias_esperando >= 21;
              return (
                <li
                  key={p.componente_id}
                  className="flex items-center gap-4 rounded-xl border border-borde bg-crema-alto px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-tinta">{p.producto}</p>
                    <p className="mt-0.5 text-sm text-tinta-suave">
                      {p.color} · Talla {p.talla}
                      {p.numero_externo ? ` · ${p.numero_externo}` : ""}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="tabular-nums text-tinta">
                      {p.piezas_faltantes}{" "}
                      <span className="text-sm text-tinta-suave">
                        {p.piezas_faltantes === 1 ? "prenda" : "prendas"}
                      </span>
                    </p>
                    <p className="text-sm tabular-nums text-tinta-suave">
                      {dinero.format(Number(p.monto_faltante_usd ?? 0))}
                    </p>
                  </div>

                  <span
                    className={`w-20 shrink-0 rounded-lg px-2 py-1.5 text-center text-sm tabular-nums ${
                      demorada
                        ? "bg-alerta-tenue text-alerta"
                        : "bg-dorado-tenue text-dorado"
                    }`}
                  >
                    {p.dias_esperando} d
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
