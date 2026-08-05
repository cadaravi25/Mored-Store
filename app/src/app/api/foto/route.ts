import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAXIMO = 6 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Guarda una foto a partir de un enlace.
 *
 * La baja y la sube al depósito propio en vez de apuntar al enlace original.
 * Enlazar la foto de otro sitio parece más simple, pero se rompe de dos
 * maneras: el sitio la borra, o bloquea que se vea desde fuera. En los dos
 * casos la tienda queda con un cuadro roto y nadie se entera hasta que una
 * clienta pregunta.
 *
 * Además se baja desde el servidor, no desde el navegador, porque el navegador
 * choca contra CORS con casi cualquier sitio ajeno.
 */
export async function POST(peticion: Request) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const cuerpo = (await peticion.json().catch(() => null)) as {
    producto_id?: string;
    color?: string;
    url?: string;
  } | null;

  const { producto_id, color, url } = cuerpo ?? {};
  if (!producto_id || !color || !url) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  let origen: URL;
  try {
    origen = new URL(url);
  } catch {
    return NextResponse.json({ error: "Ese enlace no es válido." }, { status: 400 });
  }
  if (origen.protocol !== "https:" && origen.protocol !== "http:") {
    return NextResponse.json({ error: "Ese enlace no es válido." }, { status: 400 });
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(origen, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      // Algunos sitios devuelven 403 si no reconocen quién pide.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MoredStore/1.0)" },
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo abrir ese enlace." },
      { status: 502 },
    );
  }

  if (!respuesta.ok) {
    return NextResponse.json(
      { error: `El sitio respondió ${respuesta.status}. Prueba subiendo la foto.` },
      { status: 502 },
    );
  }

  const tipo = (respuesta.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json(
      {
        error:
          "Ese enlace no es una imagen. Tiene que terminar en la foto, no en la página del producto.",
      },
      { status: 400 },
    );
  }

  const datos = await respuesta.arrayBuffer();
  if (datos.byteLength > MAXIMO) {
    return NextResponse.json({ error: "Esa imagen pesa demasiado." }, { status: 400 });
  }

  const extension = tipo.split("/")[1].replace("jpeg", "jpg");
  const ruta = `${producto_id}/${encodeURIComponent(color)}-${Date.now()}.${extension}`;

  const { error: falloSubida } = await supabase.storage
    .from("fotos")
    .upload(ruta, datos, { contentType: tipo, cacheControl: "31536000", upsert: true });

  if (falloSubida) {
    return NextResponse.json({ error: falloSubida.message }, { status: 500 });
  }

  const { data: publica } = supabase.storage.from("fotos").getPublicUrl(ruta);

  const { error: falloGuardar } = await supabase
    .from("colores")
    .update({ foto_url: publica.publicUrl })
    .eq("producto_id", producto_id)
    .eq("nombre", color);

  if (falloGuardar) {
    return NextResponse.json({ error: falloGuardar.message }, { status: 500 });
  }

  return NextResponse.json({ url: publica.publicUrl });
}
