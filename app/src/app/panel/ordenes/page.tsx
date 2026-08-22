import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import Lista, { type FilaOrden } from "./lista";
import Avisos from "../avisos";

export const dynamic = "force-dynamic";

export default async function Ordenes() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const [{ data: filas }, { data: tasa }] = await Promise.all([
    supabase.rpc("ordenes_del_catalogo", { p_dias: 60 }),
    supabase
      .from("tasas_bcv")
      .select("bs_por_eur")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6">
      <header className="mb-6">
        <h1 className="text-2xl text-tinta">Órdenes</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Lo que piden desde la tienda, con foto
        </p>
      </header>

      <Avisos />

      <Lista
        filas={(filas ?? []) as FilaOrden[]}
        tasa={tasa ? Number(tasa.bs_por_eur) : null}
      />
    </main>
  );
}
