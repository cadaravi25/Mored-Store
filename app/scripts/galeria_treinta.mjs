/**
 * Sube las fotos de Treinta que quedaron sin usar.
 *
 *   node scripts/galeria_treinta.mjs --ensayo
 *   node scripts/galeria_treinta.mjs
 *
 * Al importar se guardó una foto por color y las demás se quedaron fuera. En
 * Treinta cada producto tiene hasta tres y se ven en una tira de miniaturas:
 * la prenda de frente, de espaldas y estirada. Eso es lo que la clienta mira
 * antes de pedir, así que entran todas.
 *
 * A QUÉ COLOR VA CADA UNA
 *
 * Si el producto tiene un solo color, todas sus fotos son de ese color.
 *
 * Si tiene varios, cada foto ya fue asignada a mano en separar_colores.mjs
 * mirándolas una por una, y esas no se tocan: una foto del bikini marrón en la
 * galería del azul sería peor que no tener galería.
 *
 * Las fotos se copian al depósito propio, igual que las principales. Enlazar
 * a Treinta funciona hasta el día que cierren esa cuenta.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MARCA = "TREINTA";
const ensayo = process.argv.includes("--ensayo");

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

const enRuta = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "color";

async function copiar(productoId, color, origen, i) {
  const r = await fetch(origen, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`respondió ${r.status}`);
  const ruta = `${productoId}/${enRuta(color)}-treinta-${i}.jpg`;
  const { error } = await supabase.storage
    .from("fotos")
    .upload(ruta, Buffer.from(await r.arrayBuffer()), {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: true,
    });
  if (error) throw new Error(error.message);
  return supabase.storage.from("fotos").getPublicUrl(ruta).data.publicUrl;
}

const catalogo = JSON.parse(
  readFileSync(new URL("./datos/treinta.json", import.meta.url), "utf8"),
);
const porId = new Map(catalogo.map((p) => [p.id, p]));

const { data: productos } = await supabase
  .from("productos")
  .select("id, nombre, id_externo, colores(id, nombre, foto_url, orden)")
  .eq("vendedor_externo", MARCA);

let subidas = 0;
let saltados = 0;
const detalle = [];

for (const p of productos ?? []) {
  const treinta = porId.get(p.id_externo);
  const fotos = treinta?.fotos ?? [];
  if (fotos.length < 2) continue;

  // Con varios colores, cada foto ya tiene dueño asignado a mano.
  if (p.colores.length > 1) {
    saltados++;
    continue;
  }

  const color = p.colores[0];
  if (!color) continue;

  // La principal ya está guardada; van las demás, en el orden de Treinta.
  const extra = fotos.slice(1);
  detalle.push(`${p.nombre.padEnd(32).slice(0, 32)} ${color.nombre.padEnd(12)} +${extra.length}`);

  if (ensayo) {
    subidas += extra.length;
    continue;
  }

  for (const [i, origen] of extra.entries()) {
    try {
      const url = await copiar(p.id, color.nombre, origen, i + 2);
      const { error } = await supabase
        .from("fotos_color")
        .upsert({ color_id: color.id, url, orden: i + 1 }, { onConflict: "color_id,url" });
      if (error) throw new Error(error.message);
      subidas++;
    } catch (e) {
      console.log(`  ${p.nombre}: foto ${i + 2} no subida (${e.message})`);
    }
  }
}

detalle.sort().forEach((d) => console.log("  " + d));
console.log("");
console.log(ensayo ? "ENSAYO, no se tocó nada." : "Aplicado.");
console.log(`  fotos añadidas   ${subidas}`);
console.log(`  productos de varios colores, ya asignados a mano: ${saltados}`);
