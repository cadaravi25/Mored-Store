import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { consultarBcv } from "@/lib/bcv";
import { diaEnCaracas } from "@/lib/fechas";

export const dynamic = "force-dynamic";

/** Cada cuánto se vuelve a preguntarle a la fuente, en horas. El BCV publica
 *  a las 4 p.m. la tasa del día siguiente, así que preguntar cada tres horas
 *  la trae el mismo día sin castigar la fuente. */
const REFRESCO_HORAS = 3;

interface Fila {
  fecha: string;
  bs_por_usd: number | null;
  bs_por_eur: number | null;
  obtenido_at: string;
}

async function guardar(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
): Promise<boolean> {
  const { usd, eur } = await consultarBcv();
  if (!usd && !eur) return false;

  // Las dos monedas pueden traer fechas efectivas distintas si una se
  // actualizó antes que la otra, así que se agrupan por fecha.
  const porFecha = new Map<string, { usd?: number; eur?: number }>();
  if (usd)
    porFecha.set(usd.fechaEfectiva, {
      ...porFecha.get(usd.fechaEfectiva),
      usd: usd.tasa,
    });
  if (eur)
    porFecha.set(eur.fechaEfectiva, {
      ...porFecha.get(eur.fechaEfectiva),
      eur: eur.tasa,
    });

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

  return !error;
}

/**
 * Estado de las tasas para la barra de finanzas.
 *
 * Se consulta la fuente sola cuando hace falta: si no hay tasa para hoy, o si
 * la última consulta ya tiene rato. Nadie debería tener que acordarse de
 * apretar un botón para poder cobrar.
 */
export async function GET() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const hoy = diaEnCaracas();

  async function leer() {
    const { data } = await supabase
      .from("tasas_bcv")
      .select("fecha,bs_por_usd,bs_por_eur,obtenido_at")
      .order("fecha", { ascending: false })
      .limit(4);
    return (data ?? []) as Fila[];
  }

  let filas = await leer();
  const ultima = filas[0];
  const rato =
    !ultima ||
    Date.now() - new Date(ultima.obtenido_at).getTime() >
      REFRESCO_HORAS * 3600_000;
  const faltaHoy = !filas.some((f) => f.fecha === hoy);

  let sinConexion = false;
  if (faltaHoy || rato) {
    const bien = await guardar(supabase);
    if (bien) filas = await leer();
    // Sin conexión no es un error: se sigue trabajando con la última guardada.
    else sinConexion = true;
  }

  const vigente = filas.find((f) => f.fecha <= hoy) ?? null;
  const proxima = filas.find((f) => f.fecha > hoy) ?? null;

  // La tasa con la que se cobra. Si no hay ninguna para hoy, se deja puesta la
  // del euro del BCV, que es como cobran: así el punto de venta nunca tiene
  // que parar a preguntarla.
  let { data: venta } = await supabase
    .from("tasas_venta")
    .select("fecha,bs_por_usd,base")
    .lte("fecha", hoy)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (venta?.fecha !== hoy && vigente?.bs_por_eur) {
    const { data: puesta } = await supabase
      .from("tasas_venta")
      .upsert(
        { fecha: hoy, bs_por_usd: vigente.bs_por_eur, base: "bcv_eur" },
        { onConflict: "fecha" },
      )
      .select("fecha,bs_por_usd,base")
      .maybeSingle();
    if (puesta) venta = puesta;
  }

  return NextResponse.json({ vigente, proxima, venta, sinConexion });
}

/** Igual que el GET pero forzando la consulta: es el botón de refrescar. */
export async function POST() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const bien = await guardar(supabase);
  if (!bien) {
    return NextResponse.json(
      { error: "No se pudo consultar el BCV en este momento." },
      { status: 502 },
    );
  }
  return GET();
}
