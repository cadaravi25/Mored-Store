import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { enCorto } from "@/lib/fechas";
import Datos from "./datos";

export const dynamic = "force-dynamic";

const usd = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

interface Linea {
  prenda: string;
  color: string;
  hex: string | null;
  talla: string;
  cantidad: number;
  precio_usd: number;
}

interface Compra {
  id: string;
  serie: string;
  numero: number;
  canal: string;
  tipo: string;
  estado: string;
  total_usd: number;
  creado_at: string;
  lineas: Linea[];
}

interface Ficha {
  cliente: {
    id: string;
    nombre: string;
    telefono: string | null;
    instagram: string | null;
    cedula: string | null;
    direccion: string | null;
    nota: string | null;
  } | null;
  compras: number;
  total_usd: number;
  prendas: number;
  ultima_compra: string | null;
  tallas: { talla: string; veces: number }[];
  colores: { color: string; hex: string | null; veces: number }[];
  historial: Compra[];
}

export default async function FichaCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("ficha_cliente", { p_cliente_id: id });

  const f = data as Ficha | null;
  if (!f?.cliente) notFound();

  const c = f.cliente;
  // La talla que más ha comprado es la respuesta a la pregunta de todos los
  // días: "¿qué talla usa?".
  const talla = f.tallas[0];

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-7">
      <Link
        href="/panel/clientes"
        className="text-sm text-tinta-suave underline-offset-4 hover:underline"
      >
        ← Clientes
      </Link>

      <header className="mb-6 mt-3">
        <h1 className="text-2xl text-tinta">{c.nombre}</h1>
        <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-tinta-suave">
          {c.telefono && <span>{c.telefono}</span>}
          {c.instagram && <span>@{c.instagram}</span>}
          {!c.telefono && !c.instagram && <span>Sin datos de contacto</span>}
        </p>
      </header>

      <section className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-marron-suave bg-marron-tenue p-4">
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Talla
          </p>
          <p className="mt-1.5 text-2xl text-tinta">{talla?.talla ?? "—"}</p>
          <p className="mt-1 text-xs text-tinta-suave">
            {talla
              ? `${talla.veces} ${talla.veces === 1 ? "prenda" : "prendas"}`
              : "Sin compras aún"}
          </p>
        </div>
        <div className="rounded-2xl border border-borde bg-crema-alto p-4">
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Compras
          </p>
          <p className="mt-1.5 text-2xl tabular-nums text-tinta">{f.compras}</p>
          <p className="mt-1 text-xs text-tinta-suave">
            {f.prendas} {f.prendas === 1 ? "prenda" : "prendas"}
          </p>
        </div>
        <div className="rounded-2xl border border-borde bg-crema-alto p-4">
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Ha gastado
          </p>
          <p className="mt-1.5 text-2xl tabular-nums text-tinta">
            {usd.format(Number(f.total_usd))}
          </p>
        </div>
        <div className="rounded-2xl border border-borde bg-crema-alto p-4">
          <p className="text-xs uppercase tracking-wide text-tinta-suave">
            Última
          </p>
          <p className="mt-1.5 text-2xl text-tinta">
            {f.ultima_compra ? enCorto(f.ultima_compra.slice(0, 10)) : "—"}
          </p>
        </div>
      </section>

      {(f.tallas.length > 1 || f.colores.length > 0) && (
        <section className="mb-3 grid gap-3 sm:grid-cols-2">
          {f.tallas.length > 1 && (
            <div className="rounded-2xl border border-borde bg-crema-alto p-5">
              <p className="text-xs uppercase tracking-wide text-tinta-suave">
                Tallas que ha comprado
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {f.tallas.map((t) => (
                  <li
                    key={t.talla}
                    className="rounded-full border border-borde px-3 py-1 text-sm text-tinta"
                  >
                    {t.talla}{" "}
                    <span className="text-tinta-suave">×{t.veces}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {f.colores.length > 0 && (
            <div className="rounded-2xl border border-borde bg-crema-alto p-5">
              <p className="text-xs uppercase tracking-wide text-tinta-suave">
                Colores que prefiere
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {f.colores.map((x) => (
                  <li
                    key={x.color}
                    className="flex items-center gap-1.5 rounded-full border border-borde px-3 py-1 text-sm capitalize text-tinta"
                  >
                    <span
                      aria-hidden
                      className="h-3 w-3 shrink-0 rounded-full border border-borde"
                      style={{ background: x.hex ?? "transparent" }}
                    />
                    {x.color}
                    <span className="text-tinta-suave">×{x.veces}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <Datos cliente={c} />

      <section className="mt-3 rounded-2xl border border-borde bg-crema-alto p-5">
        <p className="text-xs uppercase tracking-wide text-tinta-suave">
          Qué se ha llevado
        </p>

        {f.historial.length === 0 ? (
          <p className="py-10 text-center text-sm text-tinta-suave">
            Todavía no tiene compras registradas.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-borde">
            {f.historial.map((v) => (
              <li key={v.id} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-tinta">
                    {v.serie}-{v.numero}
                  </span>
                  <span className="text-xs capitalize text-tinta-suave">
                    {enCorto(v.creado_at.slice(0, 10))} · {v.canal}
                  </span>
                  <span className="text-sm tabular-nums text-tinta">
                    {usd.format(Number(v.total_usd))}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {v.lineas.map((l, i) => (
                    <li
                      key={i}
                      className="flex items-baseline gap-2 text-xs text-tinta-suave"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full border border-borde"
                        style={{ background: l.hex ?? "transparent" }}
                      />
                      <span className="capitalize">
                        {l.cantidad > 1 && `${l.cantidad}× `}
                        {l.prenda} {l.color} · {l.talla}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
