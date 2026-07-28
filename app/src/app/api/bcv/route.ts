import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { consultarBcv } from "@/lib/bcv";

export const dynamic = "force-dynamic";

/**
 * Consulta el BCV y guarda las tasas por fecha efectiva.
 *
 * Se llama desde la pantalla de finanzas cuando falta la del día. Requiere
 * sesión: no es un endpoint abierto, aunque el dato en sí sea público.
 */
export async function POST() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const { usd, eur } = await consultarBcv();
  if (!usd && !eur) {
    return NextResponse.json(
      { error: "No se pudo consultar el BCV en este momento." },
      { status: 502 },
    );
  }

  // Las dos monedas pueden traer fechas efectivas distintas si una se
  // actualizó antes que la otra, así que se agrupan por fecha.
  const porFecha = new Map<string, { usd?: number; eur?: number }>();
  if (usd) porFecha.set(usd.fechaEfectiva, { ...porFecha.get(usd.fechaEfectiva), usd: usd.tasa });
  if (eur) porFecha.set(eur.fechaEfectiva, { ...porFecha.get(eur.fechaEfectiva), eur: eur.tasa });

  const filas = [...porFecha.entries()].map(([fecha, v]) => ({
    fecha,
    bs_por_usd: v.usd ?? null,
    bs_por_eur: v.eur ?? null,
    fuente: "Banco Central de Venezuela · dolarapi.com",
    obtenido_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("tasas_bcv")
    .upsert(filas, { onConflict: "fecha" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ guardadas: filas });
}
