/**
 * Segunda tanda: nombre de familia y descripción para el resto de las prendas.
 *
 *   node scripts/nombrar_treinta2.mjs --ensayo
 *   node scripts/nombrar_treinta2.mjs
 *
 * Lee scripts/datos/descripciones2.json, que es la transcripción de la
 * grabación del chat con Lau: para cada prenda, cómo se llama hoy en Treinta,
 * la familia que le toca y la descripción.
 *
 * LAS FAMILIAS CRECIERON
 *
 * A las cuatro de trajes de baño (Bikini, Trikini, Enterizo, Conjunto bikini)
 * se sumaron las que ella misma venía escribiendo en el chat para lo que no es
 * traje de baño: Vestido, Conjunto, Falda, Top, Sombrero, Lentes, Cartera,
 * Collar y Accesorio.
 *
 * LA DESCRIPCIÓN NO REPITE EL NOMBRE
 *
 * "Bikini: con estampado de lunares" puesto debajo del nombre Bikini queda
 * "Bikini · Bikini con estampado de lunares". Así que en los trajes de baño la
 * palabra se cambia por lo que la prenda es, y en el resto simplemente se
 * quita: "Lentes · De aviador con marco espejado".
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

const leidas = JSON.parse(
  readFileSync(new URL("./datos/descripciones2.json", import.meta.url), "utf8"),
);

const { data: productos } = await supabase
  .from("productos")
  .select("id,nombre,descripcion")
  .eq("vendedor_externo", "TREINTA");

const norm = (s) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const porNombre = new Map(productos.map((p) => [norm(p.nombre), p]));

let hechas = 0;
const sinResolver = [];

for (const x of leidas) {
  if (!x.nombre || x.nombre === "?" || !x.nombreNuevo) {
    sinResolver.push(x.desc.slice(0, 60));
    continue;
  }

  const p = porNombre.get(norm(x.nombre));
  if (!p) {
    sinResolver.push(`no está en inventario: ${x.nombre}`);
    continue;
  }

  console.log(
    `  ${x.nombre.padEnd(30).slice(0, 30)} -> ${x.nombreNuevo.padEnd(16)} ${x.desc}`,
  );

  if (!ensayo) {
    const { error } = await supabase
      .from("productos")
      .update({ nombre: x.nombreNuevo, descripcion: x.desc })
      .eq("id", p.id);
    if (error) {
      console.log(`    FALLÓ: ${error.message}`);
      continue;
    }
  }
  hechas++;
}

console.log("");
console.log(ensayo ? "ENSAYO, no se tocó nada." : "Aplicado.");
console.log(`  prendas nombradas ${hechas} de ${leidas.length}`);
if (sinResolver.length) {
  console.log(`  sin resolver      ${sinResolver.length}`);
  sinResolver.forEach((s) => console.log(`    ${s}`));
}
