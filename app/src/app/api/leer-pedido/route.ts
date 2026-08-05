import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { leerPedido } from "@/lib/lector";

export const dynamic = "force-dynamic";

/** Una captura de pantalla de un teléfono no pasa de un par de megas. */
const MAXIMO_BYTES = 6 * 1024 * 1024;
const TIPOS = ["image/png", "image/jpeg", "image/webp"];

/**
 * Lee la captura de un pedido y propone las líneas.
 *
 * No escribe nada en la base: devuelve una propuesta para que la revisen en
 * pantalla. La clave del modelo vive solo acá, en el servidor; si estuviera en
 * el navegador cualquiera podría gastarla.
 */
export async function POST(peticion: Request) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "Falta configurar la clave de OpenRouter." },
      { status: 503 },
    );
  }

  const formulario = await peticion.formData().catch(() => null);
  const archivos = (formulario?.getAll("imagenes") ?? []).filter(
    (a): a is File => a instanceof File,
  );

  if (archivos.length === 0) {
    return NextResponse.json({ error: "No llegó ninguna imagen." }, { status: 400 });
  }
  if (archivos.length > 4) {
    return NextResponse.json(
      { error: "Máximo cuatro capturas por vez." },
      { status: 400 },
    );
  }
  for (const a of archivos) {
    if (!TIPOS.includes(a.type)) {
      return NextResponse.json(
        { error: "Solo capturas de pantalla: PNG, JPG o WEBP." },
        { status: 400 },
      );
    }
    if (a.size > MAXIMO_BYTES) {
      return NextResponse.json(
        { error: "Esa imagen pesa demasiado. Recórtala o bájale la calidad." },
        { status: 400 },
      );
    }
  }

  // El vocabulario sale de la base, no de una lista escrita acá: así el modelo
  // propone con las mismas palabras que usan ellas y no inventa sinónimos.
  const [{ data: tipos }, { data: estilos }, { data: colores }] =
    await Promise.all([
      supabase.from("tipos_prenda").select("nombre").eq("activo", true),
      supabase.from("estilos").select("nombre").eq("activo", true),
      supabase.from("colores_catalogo").select("nombre").eq("activo", true),
    ]);

  const imagenes = await Promise.all(
    archivos.map(async (a) => {
      const base64 = Buffer.from(await a.arrayBuffer()).toString("base64");
      return `data:${a.type};base64,${base64}`;
    }),
  );

  try {
    const lineas = await leerPedido(imagenes, {
      tipos: (tipos ?? []).map((t) => t.nombre),
      estilos: (estilos ?? []).map((e) => e.nombre),
      colores: (colores ?? []).map((c) => c.nombre),
    });
    return NextResponse.json({ lineas });
  } catch (fallo) {
    return NextResponse.json(
      { error: fallo instanceof Error ? fallo.message : "No se pudo leer." },
      { status: 502 },
    );
  }
}
