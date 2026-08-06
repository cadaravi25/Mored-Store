import { crearClienteServidor } from "@/lib/supabase/server";
import Portada, { type FilaCatalogo } from "./portada";

export const dynamic = "force-dynamic";

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const supabase = await crearClienteServidor();

  // catalogo_publico es lo único que el rol anónimo puede llamar en toda la
  // base. Ya viene ordenado por producto, color y talla.
  const { data } = await supabase.rpc("catalogo_publico");

  return (
    <Portada
      filas={(data ?? []) as FilaCatalogo[]}
      whatsapp={process.env.NEXT_PUBLIC_WHATSAPP ?? null}
      coleccionInicial={c === "swim" ? "swim" : "active"}
    />
  );
}
