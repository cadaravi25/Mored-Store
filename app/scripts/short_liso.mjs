/**
 * Crea el short cargo liso, que es hermano del que ya está pero sin cordones.
 *
 *   node scripts/short_liso.mjs --ensayo
 *   node scripts/short_liso.mjs
 *
 * QUÉ PASÓ
 *
 * En la carpeta de fotos venían los dos como si fueran uno, y se cargaron
 * como uno solo. Carlos: "el 3 es liso en la pierna y el 4 trae unas cuerdas
 * como para ajustar". El que está en la tienda es el de las cuerdas: en la
 * foto que tenía se le ven colgando del lateral.
 *
 * Así que el de las cuerdas se queda con la prenda que ya existe y le cambia
 * la descripción para que se distingan, y el liso entra como prenda nueva con
 * la descripción que el otro tenía hasta ahora, que es lo que pidió Carlos.
 *
 * Lo demás lo hereda del que ya está: colección, tipo, tallas y los dos
 * precios. Son la misma prenda con y sin cordón, así que valen lo mismo.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ensayo = process.argv.includes("--ensayo");

/** El que ya está en la tienda, el de los cordones. */
const HERMANO = "55/0137";
const DESC_HERMANO = "Cargo estilo Y2K con bolsillos, cinta ajustable y efecto moldeador";

/** El nuevo: liso en la pierna. Se queda con la descripción de antes. */
const NUEVO = {
  id_externo: "55/0137-liso",
  descripcion: "Cargo estilo Y2K con bolsillos y efecto moldeador",
  // El orden importa: el primero es el que la tienda enseña por defecto.
  colores: ["Marrón", "Negro", "Celeste", "Rosado", "Rojo"],
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

const { data: hermano } = await supabase
  .from("productos")
  .select("*, variantes(talla, precio_usd, precio_bs)")
  .eq("id_externo", HERMANO)
  .maybeSingle();

if (!hermano) {
  console.log(`No está el ${HERMANO}. Nada que hacer.`);
  process.exit(1);
}

const tallas = [...new Set(hermano.variantes.map((v) => v.talla))];
const precio = hermano.variantes[0];
console.log(`hermano: ${hermano.descripcion}`);
console.log(`  tallas ${tallas.join(" ")} · ${precio.precio_usd}/${precio.precio_bs}`);
console.log(`\nal hermano se le cambia la descripción a:\n  ${DESC_HERMANO}`);
console.log(`\nse crea:\n  Short: ${NUEVO.descripcion}`);
console.log(`  colores ${NUEVO.colores.join(", ")}`);
console.log(`  ${tallas.length * NUEVO.colores.length} variantes`);

if (ensayo) {
  console.log("\nENSAYO, no se tocó nada");
  process.exit(0);
}

const { error: e1 } = await supabase
  .from("productos")
  .update({ descripcion: DESC_HERMANO })
  .eq("id", hermano.id);
if (e1) throw new Error(e1.message);

const { data: nuevo, error: e2 } = await supabase
  .from("productos")
  .insert({
    coleccion: hermano.coleccion,
    categoria_id: hermano.categoria_id,
    nombre: hermano.nombre,
    descripcion: NUEVO.descripcion,
    vendedor_externo: hermano.vendedor_externo,
    tipo_id: hermano.tipo_id,
    id_externo: NUEVO.id_externo,
    activo: true,
  })
  .select("id")
  .single();
if (e2) throw new Error(e2.message);

let n = 0;
for (const nombre of NUEVO.colores) {
  n++;
  const { data: color, error: e3 } = await supabase
    .from("colores")
    .insert({ producto_id: nuevo.id, nombre, orden: n })
    .select("id")
    .single();
  if (e3) throw new Error(e3.message);

  for (const talla of tallas) {
    const { data: variante, error: e4 } = await supabase
      .from("variantes")
      .insert({
        producto_id: nuevo.id,
        color_id: color.id,
        talla,
        sku: `AC-550137L-${n}-${talla}`,
        precio_usd: precio.precio_usd,
        precio_bs: precio.precio_bs,
      })
      .select("id")
      .single();
    if (e4) throw new Error(e4.message);

    // Nadie las contó. Igual que el resto del catálogo, entra una por talla.
    const { error: e5 } = await supabase.from("movimientos_stock").insert({
      variante_id: variante.id,
      tipo: "ajuste",
      cantidad: 1,
      referencia_tipo: "manual",
      nota: `Short cargo liso, color ${nombre}. Prenda separada del de cordones. Nadie las contó: hay que repasar el stock.`,
    });
    if (e5) throw new Error(e5.message);
  }
}

console.log(`\nListo. Prenda nueva: ${nuevo.id}`);
console.log("Falta subirle las fotos con fotos_catalogo.mjs.");
