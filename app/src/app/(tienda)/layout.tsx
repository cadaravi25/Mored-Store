import type { Metadata } from "next";
import Encabezado from "./encabezado";
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
export default function TiendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="paradas min-h-dvh bg-nieve text-carbon">
      <Encabezado />
      {children}
      <Pie />
    </div>
  );
}
