import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import Encabezado from "./encabezado";
import { ProveedorMoneda } from "@/lib/usar-moneda";
import Pie from "./pie";

export const metadata: Metadata = {
  title: "Mored · Ropa deportiva y de playa",
  description:
    "Mored Active y Mored Swim. Ropa deportiva y trajes de baño en Caracas, con tienda física en Chacaíto.",
};

/**
 * La tienda no comparte armazón con el panel. Es lo primero que ve alguien que
 * llega desde Instagram, y tiene que leerse como una tienda de ropa y no como
 * la extensión de un sistema de trabajo: fondo blanco, mucho aire, y la foto
 * como lo único que grita. El marrón y el rosa entran solo como acento.
 */
export default async function TiendaLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  /** La ficha de una prenda abierta encima, sin sacar a nadie del catálogo. */
  modal: React.ReactNode;
}) {
  // La tasa del euro vive aquí y no en cada página: el interruptor está en
  // todas, y pedirla tres veces sería tres viajes para el mismo número.
  const supabase = await crearClienteServidor();
  const { data: tasa } = await supabase
    .from("tasas_bcv")
    .select("bs_por_eur")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <ProveedorMoneda tasa={tasa ? Number(tasa.bs_por_eur) : null}>
      <div className="paradas min-h-dvh bg-nieve text-carbon">
        <Encabezado />
        {children}
        <Pie />
        {modal}
      </div>
    </ProveedorMoneda>
  );
}
