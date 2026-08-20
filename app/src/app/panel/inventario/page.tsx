import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import Buscador from "./buscador";

export const dynamic = "force-dynamic";

export default async function Inventario() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  // La tasa del euro, para enseñar en qué se convierte el precio de bolívares.
  const { data: tasa } = await supabase
    .from("tasas_bcv")
    .select("bs_por_eur")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl text-tinta">Inventario</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Busca por prenda, color o talla
          </p>
        </div>
        
      </header>

      <Buscador tasa={tasa ? Number(tasa.bs_por_eur) : null} />
    </main>
  );
}
