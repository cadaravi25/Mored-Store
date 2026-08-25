/**
 * Las prendas de Swim que venían pegadas a otra.
 *
 *   node scripts/separar_swim.mjs --ensayo
 *   node scripts/separar_swim.mjs
 *
 * QUÉ PASÓ
 *
 * Al separar los colores de Swim salieron cuatro carpetas donde la segunda
 * foto no era el mismo modelo en otro color: era otra prenda. Carlos las miró
 * una por una y dio la regla: si el modelo es diferente, va separado.
 *
 * Así que estas no entran como color. Cada foto que enseñaba otro modelo se
 * convierte en su propia prenda, con la misma talla y el mismo precio de la
 * que venía pegada, y la foto se le quita a la vieja, que ya no la enseña.
 *
 * LAS DESCRIPCIONES SON NUEVAS
 *
 * No hay de dónde copiarlas: estas prendas nunca tuvieron ficha propia. Están
 * escritas mirando la foto y siguiendo el molde del resto del catálogo, que
 * empieza por el corte y sigue por lo que se ve.
 *
 * OJO CON LAS FOTOS DEL BIKINI MOSTAZA
 *
 * Carlos va a volver a hacer esas dos fotos, la del naranja y la del mostaza.
 * Cuando lleguen hay que sustituirlas: las de ahora son de maniquí y traen
 * marca de agua.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ensayo = process.argv.includes("--ensayo");

/**
 * De qué prenda sale cada una, qué foto de su galería se lleva, y con qué
 * ficha nace. Talla y precio no se escriben: se copian de la prenda origen,
 * porque es lo que dijo Carlos.
 */
const SEPARAR = [
  {
    origen: "0da48e74-fb1f-4014-a271-6f37935cdb51",
    foto: 1,
    nombre: "Bikini",
    descripcion:
      "Traje de baño de dos piezas con aros, estampado étnico y tanga de nudos laterales",
    color: "Mostaza",
    // La foto es de maniquí y trae marca de agua. Carlos la va a repetir.
    porRehacer: true,
  },
  {
    origen: "01c074be-c5d5-4f34-aa50-a660c71a2e07",
    foto: 2,
    nombre: "Bikini",
    descripcion:
      "Traje de baño de dos piezas triangular con estampado de leopardo y tirantes finos",
    color: "Rosado",
  },
  {
    origen: "2d49329a-2395-40b3-bcd9-d74c1987225d",
    foto: 2,
    nombre: "Vestido",
    descripcion:
      "Mini de punto con estampado degradado y cuello halter anudado",
    color: "Multicolor",
  },
];

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

let creadas = 0;
let variantes = 0;

for (const ficha of SEPARAR) {
  const { data: p, error } = await supabase
    .from("productos")
    .select(
      "*, colores(id, nombre, fotos_color(id, url, orden)), variantes(talla, precio_usd, precio_bs, color_id)",
    )
    .eq("id", ficha.origen)
    .single();
  if (error) throw new Error(`${ficha.origen}: ${error.message}`);

  const viejo = p.colores[0];
  const galeria = [...(viejo.fotos_color ?? [])].sort((a, b) => a.orden - b.orden);
  const foto = galeria[ficha.foto - 1];
  if (!foto) {
    console.log(`${ficha.descripcion}: ya no está la foto ${ficha.foto}, se salta`);
    continue;
  }

  const base = p.variantes.filter((v) => v.color_id === viejo.id);
  const tallas = [...new Set(base.map((v) => v.talla))];
  const precio = base[0];
  const externo = `${p.id_externo}-b`;

  console.log(`de: ${p.nombre}: ${(p.descripcion ?? "").slice(0, 70)}`);
  console.log(`  nace ${ficha.nombre}: ${ficha.descripcion}`);
  console.log(`  ${ficha.color} · ${tallas.join(" ")} · ${precio.precio_usd}/${precio.precio_bs}`);
  if (ficha.porRehacer) console.log("  (la foto está por rehacer)");
  creadas++;
  variantes += tallas.length;

  if (ensayo) {
    console.log();
    continue;
  }

  const { data: nueva, error: e1 } = await supabase
    .from("productos")
    .insert({
      coleccion: p.coleccion,
      categoria_id: p.categoria_id,
      tipo_id: p.tipo_id,
      nombre: ficha.nombre,
      descripcion: ficha.descripcion,
      vendedor_externo: p.vendedor_externo,
      id_externo: externo,
      activo: true,
    })
    .select("id")
    .single();
  if (e1) throw new Error(`${ficha.descripcion}: ${e1.message}`);

  const { data: color, error: e2 } = await supabase
    .from("colores")
    .insert({
      producto_id: nueva.id,
      nombre: ficha.color,
      orden: 1,
      foto_url: foto.url,
      foto_miniatura_url: foto.url,
    })
    .select("id")
    .single();
  if (e2) throw new Error(`${ficha.color}: ${e2.message}`);

  for (const talla of tallas) {
    const { data: variante, error: e3 } = await supabase
      .from("variantes")
      .insert({
        producto_id: nueva.id,
        color_id: color.id,
        talla,
        sku: `TR-${externo.replaceAll("-", "").slice(0, 12)}-${talla}`.toUpperCase(),
        precio_usd: precio.precio_usd,
        precio_bs: precio.precio_bs,
      })
      .select("id")
      .single();
    if (e3) throw new Error(`${ficha.color} ${talla}: ${e3.message}`);

    // El stock no se escribe a mano: se anota el movimiento y el disparador de
    // la base mueve la columna.
    const { error: e4 } = await supabase.from("movimientos_stock").insert({
      variante_id: variante.id,
      tipo: "ajuste",
      cantidad: 1,
      referencia_tipo: "manual",
      nota: `Prenda separada de "${p.descripcion}": era otro modelo, no otro color. Nadie las contó: hay que repasar el stock.`,
    });
    if (e4) throw new Error(`${ficha.color} ${talla}: ${e4.message}`);
  }

  const { error: e5 } = await supabase
    .from("fotos_color")
    .delete()
    .eq("id", foto.id);
  if (e5) throw new Error(`limpiar la galería: ${e5.message}`);

  console.log(`  ${nueva.id}\n`);
}

console.log(ensayo ? "ENSAYO, no se tocó nada" : "Listo");
console.log(`  prendas nuevas ${creadas}`);
console.log(`  variantes      ${variantes}`);
