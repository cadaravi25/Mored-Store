import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { correoAUsuario } from "@/lib/auth";

export const dynamic = "force-dynamic";

const dinero = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

export default async function Inicio() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: variantes } = await supabase
    .from("variantes")
    .select("stock,costo_promedio_usd,precio_usd")
    .gt("stock", 0);

  const prendas = (variantes ?? []).reduce((s, v) => s + v.stock, 0);
  const costo = (variantes ?? []).reduce(
    (s, v) => s + v.stock * Number(v.costo_promedio_usd ?? 0),
    0,
  );
  const venta = (variantes ?? []).reduce(
    (s, v) => s + v.stock * Number(v.precio_usd ?? 0),
    0,
  );

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-8">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl tracking-[0.2em] text-tinta">MORED</h1>
          <p className="mt-1 text-sm text-tinta-suave">Sistema interno</p>
        </div>
        <span className="shrink-0 text-sm text-tinta-suave">
          {correoAUsuario(user.email)}
        </span>
      </header>

      <dl className="mb-8 grid grid-cols-3 gap-3">
        {[
          ["Prendas", String(prendas)],
          ["Costo", dinero.format(costo)],
          ["Venta", dinero.format(venta)],
        ].map(([etiqueta, valor]) => (
          <div
            key={etiqueta}
            className="rounded-xl border border-borde bg-crema-alto px-4 py-3"
          >
            <dt className="text-xs uppercase tracking-wide text-tinta-suave">
              {etiqueta}
            </dt>
            <dd className="mt-1 text-lg tabular-nums text-tinta">{valor}</dd>
          </div>
        ))}
      </dl>

      <nav className="space-y-3">
        {[
          ["/recibir", "Recibir", "Cargar lo que llegó en una caja"],
          ["/inventario", "Inventario", "Buscar por prenda, color o talla"],
        ].map(([href, titulo, descripcion]) => (
          <Link
            key={href}
            href={href}
            className="block rounded-xl border border-borde bg-crema-alto px-5 py-4 transition-colors hover:border-dorado-claro"
          >
            <p className="text-lg text-tinta">{titulo}</p>
            <p className="mt-0.5 text-sm text-tinta-suave">{descripcion}</p>
          </Link>
        ))}
      </nav>
    </main>
  );
}
