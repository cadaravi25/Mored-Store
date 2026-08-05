import { crearClienteServidor } from "@/lib/supabase/server";
import Vitrina, { type FilaCatalogo } from "./vitrina";

export const dynamic = "force-dynamic";

export default async function Tienda() {
  const supabase = await crearClienteServidor();

  // catalogo_publico es lo único que el rol anónimo puede llamar en toda la
  // base. Ya viene ordenado por producto, color y talla.
  const { data } = await supabase.rpc("catalogo_publico");

  return (
    <Vitrina
      filas={(data ?? []) as FilaCatalogo[]}
      whatsapp={process.env.NEXT_PUBLIC_WHATSAPP ?? null}
    />
  );
}
