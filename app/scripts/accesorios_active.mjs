/**
 * Le pone foto a los accesorios deportivos y arregla la talla de la faja.
 *
 *   node scripts/accesorios_active.mjs --ensayo --fotos=<carpeta>
 *   node scripts/accesorios_active.mjs          --fotos=<carpeta>
 *
 * POR QUÉ ESTOS SEIS QUEDARON FUERA
 *
 * Los otros 164 productos de Active traen su foto recortada de la captura que
 * les corresponde en el vídeo. Los seis accesorios no: en el vídeo 48 esa parte
 * está ampliada sobre la lista de WhatsApp, no sobre la ficha, así que no había
 * ficha que recortar y entraron sin foto. Sin foto no salen en la tienda.
 *
 * Pero la lista ampliada sí enseña la miniatura de cada uno, y en cinco de los
 * seis hay algún cuadro donde se ve nítida. De ahí salen estas fotos. La de la
 * faja no: sus seis cuadros están todos movidos.
 *
 * LA TALLA DE LA FAJA
 *
 * Entró como accesorio sin talla porque se leyó de una captura recortada donde
 * el "Ref 14€" aparecía solo. La ficha completa dice "Ref 14€/ talla M y L".
 * Así que no es un accesorio sin talla: es una prenda con dos.
 */

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { rutaDeFoto } from "./rutas.mjs";

const MARCA = "ACTIVE-WHATSAPP";
const ensayo = process.argv.includes("--ensayo");
const RECORTES = process.argv.find((a) => a.startsWith("--fotos="))?.slice(8);

/** Qué captura del catálogo le toca a cada accesorio. */
const FOTOS = {
  "48/0003": "0003.jpg",
  "48/0006": "0006.jpg",
  "48/0008": "0008.jpg",
  "48/0021": "0021.jpg",
  "48/0025": "0025.jpg",
};

const entorno = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim(),
    ]),
);

const supabase = createClient(
  entorno.NEXT_PUBLIC_SUPABASE_URL,
  entorno.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function subir(productoId, color, archivo) {
  const ruta = rutaDeFoto(productoId, color, "jpg");
  const { error } = await supabase.storage
    .from("fotos")
    .upload(ruta, readFileSync(archivo), {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: true,
    });
  if (error) throw new Error(error.message);

  const url = supabase.storage.from("fotos").getPublicUrl(ruta).data.publicUrl;

  // No basta con que suba: la primera vez que se hizo esto, el depósito
  // guardaba el archivo y después devolvía 400 al pedirlo.
  const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`subió pero responde ${r.status}`);

  return url;
}

async function fotos() {
  for (const [cuadro, archivo] of Object.entries(FOTOS)) {
    const ruta = `${RECORTES}/${archivo}`;
    if (!existsSync(ruta)) {
      console.log(`  ${cuadro}: no encuentro ${ruta}`);
      continue;
    }

    const { data: producto } = await supabase
      .from("productos")
      .select("id,nombre,descripcion")
      .eq("vendedor_externo", MARCA)
      .eq("id_externo", cuadro)
      .maybeSingle();

    if (!producto) {
      console.log(`  ${cuadro}: no está en el inventario`);
      continue;
    }

    const { data: color } = await supabase
      .from("colores")
      .select("id,nombre,foto_url")
      .eq("producto_id", producto.id)
      .limit(1)
      .maybeSingle();

    if (color?.foto_url) {
      console.log(`  ${cuadro}: ya tenía foto, no la toco`);
      continue;
    }

    if (ensayo) {
      console.log(`  ${cuadro}  ${producto.descripcion} -> ${archivo}`);
      continue;
    }

    try {
      const url = await subir(producto.id, color.nombre, ruta);
      const { error } = await supabase
        .from("colores")
        .update({ foto_url: url })
        .eq("id", color.id);
      if (error) throw new Error(error.message);
      console.log(`  ${cuadro}  ${producto.descripcion}: foto puesta`);
    } catch (e) {
      console.log(`  ${cuadro}: FALLÓ (${e.message})`);
    }
  }
}

/**
 * La faja pasa de "sin talla" a M y L.
 *
 * La variante que ya existe se reetiqueta en vez de borrarse y crearse otra:
 * así conserva su movimiento de stock y el libro sigue cuadrando. La segunda
 * talla sí es nueva y entra con su unidad, igual que entró todo lo demás.
 */
async function tallasDeLaFaja() {
  const { data: producto } = await supabase
    .from("productos")
    .select("id")
    .eq("vendedor_externo", MARCA)
    .eq("id_externo", "48/0012")
    .maybeSingle();

  if (!producto) {
    console.log("  la faja no está en el inventario");
    return;
  }

  const { data: variantes } = await supabase
    .from("variantes")
    .select("id,talla,color_id,precio_usd,precio_bs")
    .eq("producto_id", producto.id);

  const tiene = new Set((variantes ?? []).map((v) => v.talla));
  if (tiene.has("M") && tiene.has("L")) {
    console.log("  la faja ya tiene M y L");
    return;
  }

  const unica = variantes?.find((v) => v.talla === "ÚNICA");
  if (!unica) {
    console.log(`  la faja no tiene la talla ÚNICA que esperaba (${[...tiene].join(", ")})`);
    return;
  }

  if (ensayo) {
    console.log("  la faja: ÚNICA -> M, y se crea la L");
    return;
  }

  const { error: falloM } = await supabase
    .from("variantes")
    .update({ talla: "M", sku: "AC-480012-1-M" })
    .eq("id", unica.id);
  if (falloM) { console.log(`  FALLÓ al pasar a M: ${falloM.message}`); return; }

  const { data: nueva, error: falloL } = await supabase
    .from("variantes")
    .insert({
      producto_id: producto.id,
      color_id: unica.color_id,
      talla: "L",
      sku: "AC-480012-1-L",
      precio_usd: unica.precio_usd,
      precio_bs: unica.precio_bs,
    })
    .select("id")
    .single();
  if (falloL) { console.log(`  FALLÓ al crear la L: ${falloL.message}`); return; }

  const { error: falloMov } = await supabase.from("movimientos_stock").insert({
    variante_id: nueva.id,
    tipo: "ajuste",
    cantidad: 1,
    referencia_tipo: "manual",
    nota: "Catálogo de Active, captura 48/0012 (talla L)",
  });
  if (falloMov) { console.log(`  FALLÓ el movimiento de la L: ${falloMov.message}`); return; }

  console.log("  la faja: ahora tiene M y L");
}

console.log(ensayo ? "ENSAYO, no toca nada\n" : "");
console.log("Fotos:");
await fotos();
console.log("\nTalla de la faja:");
await tallasDeLaFaja();
