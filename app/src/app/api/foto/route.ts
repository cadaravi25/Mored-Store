import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { rutaDeFoto } from "@/lib/fotos";

export const dynamic = "force-dynamic";

const MAXIMO = 6 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/avif"];

// Un navegador de verdad. Varias tiendas devuelven 403 a cualquier otra cosa.
const NAVEGADOR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Saca la foto principal de la página de un producto.
 *
 * Se busca la que la propia tienda declara para cuando comparten el enlace por
 * WhatsApp o Instagram: es la foto grande del producto, elegida por ellos. No
 * hay que adivinar cuál del montón de imágenes de la página es la buena.
 *
 * Sirve para SHEIN, Temu, AliExpress y casi cualquier tienda, porque todas
 * necesitan que su enlace se vea bien al compartirse.
 */
function fotoDeLaPagina(html: string, base: string): string | null {
  const patrones = [
    /<meta[^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["']/i,
    /<meta[^>]+(?:name|property)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    // Los datos estructurados que usa Google, cuando no hay etiquetas sociales.
    /"image"\s*:\s*"([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i,
    /"image"\s*:\s*\[\s*"([^"]+)"/i,
  ];

  for (const patron of patrones) {
    const encontrado = html.match(patron)?.[1];
    if (!encontrado) continue;
    const limpio = encontrado.replace(/&amp;/g, "&").trim();
    try {
      // Muchas vienen sin protocolo (//img.shein.com/...) o relativas.
      return new URL(limpio, base).toString();
    } catch {
      continue;
    }
  }
  return null;
}

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

  async function abrir(destino: string | URL) {
    return fetch(destino, {
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
      headers: {
        "User-Agent": NAVEGADOR,
        Accept: "text/html,image/avif,image/webp,image/*,*/*;q=0.8",
      },
    });
  }

  let respuesta: Response;
  try {
    respuesta = await abrir(origen);
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

  let tipo = (respuesta.headers.get("content-type") ?? "").split(";")[0].trim();

  // Si pegaron la página del producto y no la foto, se busca cuál es la foto
  // principal y se sigue con esa. Es lo normal desde un teléfono: sacar el
  // enlace de la imagen ahí es un fastidio, el del producto está a un toque.
  if (!TIPOS.includes(tipo)) {
    if (!tipo.startsWith("text/html")) {
      return NextResponse.json(
        { error: "Ese enlace no lleva a una foto ni a una página de producto." },
        { status: 400 },
      );
    }

    const html = await respuesta.text();
    const foto = fotoDeLaPagina(html, respuesta.url || origen.toString());
    if (!foto) {
      // SHEIN y Temu arman su página con JavaScript y no declaran su foto en
      // ninguna parte, ni siquiera para WhatsApp. Comprobado. No es que el
      // enlace esté mal, es que de ahí no se puede sacar.
      const conocida = /shein|temu|aliexpress/i.test(origen.hostname);
      return NextResponse.json(
        {
          error: conocida
            ? "SHEIN no publica su foto para que otros la lean. Mantén presionada la imagen en el teléfono, guárdala, y súbela con el botón de arriba."
            : "Esa página no dice cuál es su foto principal. Prueba con el enlace de la imagen o sube la foto.",
        },
        { status: 422 },
      );
    }

    try {
      respuesta = await abrir(foto);
    } catch {
      return NextResponse.json(
        { error: "Se encontró la foto pero no se pudo bajar." },
        { status: 502 },
      );
    }

    tipo = (respuesta.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!respuesta.ok || !TIPOS.includes(tipo)) {
      return NextResponse.json(
        { error: "La foto de esa página no se pudo bajar." },
        { status: 502 },
      );
    }
  }

  const datos = await respuesta.arrayBuffer();
  if (datos.byteLength > MAXIMO) {
    return NextResponse.json({ error: "Esa imagen pesa demasiado." }, { status: 400 });
  }

  const extension = tipo.split("/")[1].replace("jpeg", "jpg");
  const ruta = rutaDeFoto(producto_id, color, extension);

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
