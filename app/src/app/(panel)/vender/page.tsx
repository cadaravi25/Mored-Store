import { crearClienteServidor } from "@/lib/supabase/server";
import PuntoDeVenta from "./punto-de-venta";

export const dynamic = "force-dynamic";

export default async function Vender() {
  const supabase = await crearClienteServidor();

  // La tasa del día, para poder cobrar en bolívares. Si no está cargada, la
  // pantalla la pide en el momento del cobro.
  const { data: tasa } = await supabase
    .from("tasas_venta")
    .select("bs_por_usd")
    .lte("fecha", new Date().toISOString().slice(0, 10))
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-7">
      <header className="mb-6">
        <h1 className="text-2xl text-tinta">Vender</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Busca la prenda y tócala para agregarla
        </p>
      </header>

      <PuntoDeVenta tasaInicial={tasa ? Number(tasa.bs_por_usd) : null} />
    </main>
  );
}
