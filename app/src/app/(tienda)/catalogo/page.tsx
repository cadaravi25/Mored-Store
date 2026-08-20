import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { FilaCatalogo } from "../piezas";
import Interruptor from "../interruptor";
import Vista from "./vista";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catálogo · Mored",
  description:
    "Todo el catálogo de Mored Active y Mored Swim, con filtros por talla, color y tipo de prenda.",
};

export default async function Catalogo({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; tipo?: string }>;
}) {
  const { c, tipo } = await searchParams;
  const supabase = await crearClienteServidor();

  const { data } = await supabase.rpc("catalogo_publico");

  return (
    <>
      {/* Solo aquí: es la pantalla donde se comparan precios de corrido. La
          moneda escogida la respetan igual la portada y la ficha, que siguen
          leyendo la misma preferencia. */}
      <Interruptor />
      <Vista
        filas={(data ?? []) as FilaCatalogo[]}
        whatsapp={process.env.NEXT_PUBLIC_WHATSAPP ?? null}
        coleccionInicial={c === "swim" ? "swim" : "active"}
        tipoInicial={tipo ?? ""}
      />
    </>
  );
}
