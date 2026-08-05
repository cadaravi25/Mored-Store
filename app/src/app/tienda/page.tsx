import { crearClienteServidor } from "@/lib/supabase/server";
import Vitrina, { type FilaCatalogo } from "./vitrina";

export const dynamic = "force-dynamic";

export default async function Tienda() {
  const supabase = await crearClienteServidor();

  // v_catalogo es lo único que el rol anónimo puede leer en toda la base.
  const { data } = await supabase
    .from("v_catalogo")
    .select("*")
    .order("producto");

  return (
    <Vitrina
      filas={(data ?? []) as FilaCatalogo[]}
      whatsapp={process.env.NEXT_PUBLIC_WHATSAPP ?? null}
    />
  );
}
