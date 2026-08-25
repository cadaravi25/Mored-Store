/**
 * Las dos cosas que Lau mandó por captura.
 *
 *   node scripts/lau.mjs --ensayo
 *   node scripts/lau.mjs
 *
 * 1. El halter cruzado lila (48/0165) se agotó: se deja en cero. No se borra
 *    ni se desactiva, porque vuelve a entrar cuando llegue el pedido; con cero
 *    en stock la tienda ya lo enseña como agotado.
 *
 * 2. El de pádel (55/0017) también viene en S. Los once colores ya entraron
 *    con sus fotos desde la carpeta; aquí solo se le agrega la talla que
 *    faltaba, con el mismo precio.
 *
 * El stock nunca se escribe a mano: se anota el movimiento y el disparador de
 * la base mueve la columna. Es lo que deja saber después por qué cambió.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ensayo = process.argv.includes("--ensayo");

const AGOTADO = { externo: "48/0165", color: "Lila", talla: "XS" };
const TALLA_NUEVA = { externo: "55/0017", desde: "M", talla: "S" };

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

async function traer(externo) {
  const { data, error } = await supabase
    .from("productos")
    .select(
      "id, descripcion, colores(id, nombre), variantes(id, talla, sku, precio_usd, precio_bs, stock, color_id)",
    )
    .eq("id_externo", externo)
    .single();
  if (error) throw new Error(`${externo}: ${error.message}`);
  return data;
}

// 1. El que se agotó
const agotado = await traer(AGOTADO.externo);
const color = agotado.colores.find((c) => c.nombre === AGOTADO.color);
const variante = agotado.variantes.find(
  (v) => v.color_id === color?.id && v.talla === AGOTADO.talla,
);
if (!variante) throw new Error("No está la talla que se iba a agotar.");

console.log(`agotado: ${agotado.descripcion}`);
console.log(`  ${AGOTADO.color} ${AGOTADO.talla}: de ${variante.stock} a 0`);

// 2. La talla que faltaba
const pádel = await traer(TALLA_NUEVA.externo);
const nombres = Object.fromEntries(pádel.colores.map((c) => [c.id, c.nombre]));
const base = pádel.variantes.filter((v) => v.talla === TALLA_NUEVA.desde);
const yaEstán = new Set(
  pádel.variantes
    .filter((v) => v.talla === TALLA_NUEVA.talla)
    .map((v) => v.color_id),
);
const faltan = base.filter((v) => !yaEstán.has(v.color_id));

console.log(`\ntalla nueva: ${pádel.descripcion}`);
console.log(
  `  ${TALLA_NUEVA.talla} en ${faltan.length} color(es): ${faltan
    .map((v) => nombres[v.color_id])
    .join(", ")}`,
);

if (ensayo) {
  console.log("\nENSAYO, no se tocó nada");
  process.exit(0);
}

if (variante.stock !== 0) {
  const { error } = await supabase.from("movimientos_stock").insert({
    variante_id: variante.id,
    tipo: "ajuste",
    cantidad: -variante.stock,
    referencia_tipo: "manual",
    nota: "Agotado: lo avisó Lau.",
  });
  if (error) throw new Error(error.message);
}

for (const v of faltan) {
  const { data: nueva, error } = await supabase
    .from("variantes")
    .insert({
      producto_id: pádel.id,
      color_id: v.color_id,
      talla: TALLA_NUEVA.talla,
      sku: v.sku.replace(new RegExp(`-${TALLA_NUEVA.desde}$`), `-${TALLA_NUEVA.talla}`),
      precio_usd: v.precio_usd,
      precio_bs: v.precio_bs,
    })
    .select("id")
    .single();
  if (error) throw new Error(`${nombres[v.color_id]}: ${error.message}`);

  const { error: e2 } = await supabase.from("movimientos_stock").insert({
    variante_id: nueva.id,
    tipo: "ajuste",
    cantidad: 1,
    referencia_tipo: "manual",
    nota: `Talla ${TALLA_NUEVA.talla} agregada (lo avisó Lau). Nadie las contó: hay que repasar el stock.`,
  });
  if (e2) throw new Error(e2.message);
}

console.log(`\nListo. ${faltan.length} variante(s) nueva(s).`);
