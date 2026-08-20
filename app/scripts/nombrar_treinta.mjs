/**
 * Le pone a cada prenda su nombre de familia y su descripción.
 *
 *   node scripts/nombrar_treinta.mjs --ensayo
 *   node scripts/nombrar_treinta.mjs
 *
 * EL NOMBRE JUNTA, LA DESCRIPCIÓN SEPARA
 *
 * Cuatro nombres y nada más, según lo que es la prenda:
 *
 *   Bikini           dos piezas separadas
 *   Trikini          dos piezas unidas
 *   Enterizo         una sola pieza, abdomen cubierto
 *   Conjunto bikini  bikini + pareo o falda
 *
 * Lo que distingue una prenda de otra con el mismo nombre es la descripción,
 * no un número al final del nombre. Dos prendas con nombre y descripción
 * iguales son la misma prenda en otro color y la tienda las junta sola.
 *
 * LA DESCRIPCIÓN NO REPITE EL TIPO
 *
 * El texto de SHEIN empieza casi siempre nombrando el tipo, y puesto debajo
 * del nombre queda "Bikini · Conjunto de bikini...". Así que la palabra se
 * cambia por lo que la prenda es:
 *
 *   bikini    -> traje de baño de dos piezas
 *   trikini   -> traje de baño trikini
 *   enterizo  -> traje de baño de una pieza
 *
 * Y en los conjuntos la falda o el pareo pasan al frente, que es lo que los
 * hace distintos de un bikini a secas. El conteo de piezas se cae: ya lo dice
 * el nombre, y "traje de baño de dos piezas de 3 piezas" no lo lee nadie.
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

/** [nombre en Treinta, nombre nuevo, descripción nueva] */
const PRENDAS = [
  // ---- Conjunto bikini: llevan falda, pareo o camisa -----------------------
  ["Bañador 3 piezas", "Conjunto bikini",
   "Traje de baño de dos piezas con falda, sujetador con aros y estampado de mármol"],
  ["Bañador 3 piezas 10", "Conjunto bikini",
   "Traje de baño de dos piezas con camisa larga y abertura, unicolor y con cordones"],
  ["Bañador 3 piezas 11", "Conjunto bikini",
   "Traje de baño de dos piezas con falda midi ajustada, top triangular y parte inferior con lazos, en degradado"],
  ["Bañador 3 piezas 13", "Conjunto bikini",
   "Traje de baño de dos piezas con vestido largo, tirantes calados y anudado"],
  ["Bañador 3 piezas 15", "Conjunto bikini",
   "Traje de baño de dos piezas con falda de malla, estampado degradado y cuerda trenzada"],
  ["Bañador 3 piezas 18", "Conjunto bikini",
   "Traje de baño de dos piezas con falda, halter y sostén push-up"],
  ["Bañador 3 piezas 2", "Conjunto bikini",
   "Traje de baño de dos piezas con falda cubre-bañador, unicolor y con aros"],
  ["Bañador 3 piezas 3", "Conjunto bikini",
   "Traje de baño de dos piezas con falda, bandeau, elegante y sexy"],
  ["Bañador 3 piezas 4", "Conjunto bikini",
   "Traje de baño de dos piezas con falda de verano, en verde neón"],
  ["Bañador 3 piezas 5", "Conjunto bikini",
   "Traje de baño de dos piezas con falda, unicolor, para vacaciones"],
  ["Bañador 3 piezas 6", "Conjunto bikini",
   "Traje de baño de dos piezas con falda, tirantes anchos y aros para un soporte cómodo"],
  ["Bañador 3 piezas 7", "Conjunto bikini",
   "Traje de baño de dos piezas con falda transparente de estampado floral y abertura alta, top sin espalda con tirantes desmontables y flores metálicas"],
  ["Bañador 3 piezas 8", "Conjunto bikini",
   "Traje de baño de dos piezas con falda, decorado con hebilla de metal, en negro"],
  ["Bañador 3 piezas 9", "Conjunto bikini",
   "Traje de baño de dos piezas con falda de playa de malla"],

  // ---- Bikini: dos piezas separadas ---------------------------------------
  ["Bañador basico", "Bikini",
   "Traje de baño de dos piezas bandeau negro con decoración de estrella de mar 3D dorada y tirante halter desmontable"],
  ["Bañador basico 1", "Bikini",
   "Traje de baño de dos piezas estilo brasileño con tirantes estampados multicolor"],
  ["Bañador animal print", "Bikini",
   "Traje de baño de dos piezas con estampado de leopardo"],
  ["Bañador basico 10", "Bikini",
   "Traje de baño de dos piezas de triángulo con cadena de playa"],
  ["Bañador basico 11", "Bikini",
   "Traje de baño de dos piezas acanalado, sujetador con aros y bottom de corte alto"],
  ["Bañador basico 13", "Bikini",
   "Traje de baño de dos piezas unicolor con aros y detalle de cordones"],
  ["bañador basico 12", "Bikini",
   "Traje de baño de dos piezas de triángulo con estampado de patilla y lazos laterales"],
  ["Bañador basico 15", "Bikini",
   "Traje de baño de dos piezas con acolchado, decoración de tortuga marina y cintura alta"],
  ["Bañador basico 16", "Bikini",
   "Traje de baño de dos piezas con tirantes anchos y decoración de estrella de mar"],
  ["Bañador basico 2", "Bikini",
   "Traje de baño de dos piezas con colgante metálico, unicolor y tipo tanga"],
  ["Bañador basico 18", "Bikini",
   "Traje de baño de dos piezas estilo brasileño con parte superior triangular, tirantes cruzados, corte alto y estilo bohemio"],
  ["Bañador básico 20", "Bikini",
   "Traje de baño de dos piezas con tirantes finos y decoración metálica, unicolor"],
  ["Bañador basico 21", "Bikini",
   "Traje de baño de dos piezas con aros y estampado floral"],
  ["Bañador básico 22", "Bikini",
   "Traje de baño de dos piezas con tirantes finos, estilo europeo"],
  ["Bañador basico 28", "Bikini",
   "Traje de baño de dos piezas con estampado de teñido anudado, tirantes finos, forro y tanga con lazos laterales"],
  ["Bañador basico 29", "Bikini",
   "Traje de baño de dos piezas metálico, parte superior triangular con lazos laterales"],
  ["Bañador basico 3", "Bikini",
   "Traje de baño de dos piezas con estampado de frutas y océano y tirantes ajustables"],
  ["Bañador basico 4", "Bikini",
   "Traje de baño de dos piezas de copa suave, unicolor, con correas anchas y hebilla en la espalda"],
  ["Bañador basico 6", "Bikini",
   "Traje de baño de dos piezas, estilo europeo"],
  ["Bañador basico 7", "Bikini",
   "Traje de baño de dos piezas unicolor con tirantes de espagueti y espalda descubierta"],
  ["Bañador basico 8", "Bikini",
   "Traje de baño de dos piezas con tirantes desmontables y tanga ajustable"],
  ["Bañador basico 9", "Bikini",
   "Traje de baño de dos piezas con estampado aleatorio, decoración de estrella de mar y tirantes finos"],
  ["Bañador bicolor", "Bikini",
   "Traje de baño de dos piezas de triángulo"],
  ["Bañador bicolor 1", "Bikini",
   "Traje de baño de dos piezas de verano, triangular y micro con escote"],
  ["Bañador brasil", "Bikini",
   "Traje de baño de dos piezas con estampado de letras de Brasil"],
  ["Bañador brasil 2", "Bikini",
   "Traje de baño de dos piezas de verano con tirantes finos"],
  ["Bañador brasil basico", "Bikini",
   "Traje de baño de dos piezas: top con espalda descubierta y tiras, y bottom tipo tanga"],
  ["Bañador con accesorio", "Bikini",
   "Traje de baño de dos piezas unicolor con cuello"],
  ["Bañador con accesorio 1", "Bikini",
   "Traje de baño de dos piezas con tirantes finos y acentos de círculos metálicos, unicolor brillante"],
  ["Bañador estamapdo", "Bikini",
   "Traje de baño de dos piezas a rayas con efecto dopamina: top con tiras ajustables y tanga de tiro bajo"],
  ["Bañador estampado", "Bikini",
   "Traje de baño de dos piezas con estampado tropical y copa mini"],
  ["Bañadores básicos", "Bikini",
   "Traje de baño de dos piezas con estampado, tirantes de espagueti y nudo frontal, estilo casual"],
  ["Bañador musera", "Bikini",
   "Traje de baño de dos piezas de top con aros, estampado de paisley y bottom tipo cheeky con nudo lateral"],
  ["Bikini amarillo con palmeras", "Bikini",
   "Traje de baño de dos piezas vintage con decoración oceánica"],

  // ---- Trikini: dos piezas unidas -----------------------------------------
  // Los recortes laterales dejan el abdomen al aire por los lados: es lo que
  // separa un trikini de un enterizo.
  ["Bañador completo 3", "Trikini",
   "Traje de baño trikini con escote en V profundo, recortes laterales y espalda descubierta"],

  // ---- Enterizo: una sola pieza -------------------------------------------
  ["Bañador enterizo 6", "Enterizo",
   "Traje de baño de una pieza con escote en V profundo, tirantes de espagueti, espalda descubierta, calado y tanga"],
  ["Bañador entero", "Enterizo",
   "Traje de baño de una pieza elegante de punto calado con perlas"],
  ["Bañador entero 1", "Enterizo",
   "Traje de baño de una pieza con estampado de leopardo"],
];

const { data: productos } = await supabase
  .from("productos")
  .select("id,nombre,descripcion")
  .eq("vendedor_externo", "TREINTA");

const porNombre = new Map(
  productos.map((p) => [p.nombre.trim().toLowerCase(), p]),
);

let hechas = 0;
const perdidas = [];

for (const [viejo, nombre, desc] of PRENDAS) {
  const p = porNombre.get(viejo.trim().toLowerCase());
  if (!p) {
    perdidas.push(viejo);
    continue;
  }
  console.log(`  ${viejo.padEnd(30).slice(0, 30)} -> ${nombre.padEnd(16)} ${desc}`);
  if (!ensayo) {
    const { error } = await supabase
      .from("productos")
      .update({ nombre, descripcion: desc })
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
console.log(`  prendas nombradas   ${hechas} de ${PRENDAS.length}`);
if (perdidas.length) {
  console.log(`  no encontradas      ${perdidas.length}: ${perdidas.join(", ")}`);
}
console.log(`  sin descripción aún ${productos.length - hechas}`);
