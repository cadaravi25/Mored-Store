import { crearClienteServidor } from "@/lib/supabase/server";
import Lista, { type Cliente } from "./lista";

export const dynamic = "force-dynamic";

export default async function Clientes() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("buscar_clientes", { p_termino: null });
  const clientes = (data ?? []) as Cliente[];

  const conCompras = clientes.filter((c) => c.compras > 0);
  const gastado = conCompras.reduce((s, c) => s + Number(c.total_usd), 0);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-7">
      <header className="mb-6">
        <h1 className="text-2xl text-tinta">Clientes</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          {clientes.length === 0
            ? "Se van registrando solos al vender"
            : `${clientes.length} registrados · ${conCompras.length} han comprado`}
          {gastado > 0 &&
            ` · ${new Intl.NumberFormat("es-VE", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(gastado)} en total`}
        </p>
      </header>

      <Lista iniciales={clientes} />
    </main>
  );
}
