import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { FilaCatalogo } from "../vitrina";
import Ficha from "./ficha";

export const dynamic = "force-dynamic";

async function traer(id: string): Promise<FilaCatalogo[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("catalogo_publico", { p_producto: id });
  return (data ?? []) as FilaCatalogo[];
}

/** Para que al compartir el enlace por Instagram salga la prenda y no el
 *  nombre de la tienda a secas. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const filas = await traer(id);
  if (filas.length === 0) return { title: "Mored" };

  const p = filas[0];
  return {
    title: `${p.producto} · Mored`,
    openGraph: {
      title: p.producto,
      description: `Mored ${p.coleccion === "swim" ? "Swim" : "Active"}`,
      images: [p.foto_url],
    },
  };
}

export default async function Producto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ color?: string }>;
}) {
  const [{ id }, { color }] = await Promise.all([params, searchParams]);
  const filas = await traer(id);
  if (filas.length === 0) notFound();

  return (
    <Ficha
      filas={filas}
      colorInicial={color ?? null}
      whatsapp={process.env.NEXT_PUBLIC_WHATSAPP ?? null}
    />
  );
}
