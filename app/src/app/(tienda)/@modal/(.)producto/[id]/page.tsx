import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { FilaCatalogo } from "../../../portada";
import Ficha from "../../../producto/[id]/ficha";
import Overlay from "./overlay";

export const dynamic = "force-dynamic";

/**
 * La ficha encima del catálogo, sin salir de él.
 *
 * Es la misma ficha de /producto/[id], no una copia: lo único que cambia es
 * que va dentro de un recuadro y que el carrito no se pinta otra vez, porque
 * el del catálogo de atrás sigue estando ahí.
 *
 * Esto solo se usa al tocar una prenda desde dentro de la tienda. Quien llegue
 * por un enlace compartido, o recargue, ve la página entera de siempre: es lo
 * que hace Next con las rutas interceptadas y es lo que se quiere, porque un
 * enlace de Instagram tiene que abrir la prenda, no media prenda flotando
 * sobre un catálogo que nadie pidió.
 */
export default async function FichaEncima({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ color?: string }>;
}) {
  const [{ id }, { color }] = await Promise.all([params, searchParams]);

  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("catalogo_publico", { p_producto: id });
  const filas = (data ?? []) as FilaCatalogo[];
  if (filas.length === 0) notFound();

  return (
    <Overlay titulo={filas[0].producto}>
      <Ficha
        filas={filas}
        colorInicial={color ?? null}
        whatsapp={process.env.NEXT_PUBLIC_WHATSAPP ?? null}
        enOverlay
      />
    </Overlay>
  );
}
