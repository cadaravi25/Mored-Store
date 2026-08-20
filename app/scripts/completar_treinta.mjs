/**
 * Rellena color y tallas de lo que entró a medias del catálogo de Treinta.
 *
 *   node scripts/completar_treinta.mjs --ensayo   dice qué haría, sin tocar nada
 *   node scripts/completar_treinta.mjs            lo aplica
 *
 * EL COLOR SALE DE LA FOTO
 *
 * Treinta no guarda el color en ningún campo. La foto sí lo dice, así que los
 * 78 colores de aquí abajo están mirados uno por uno contra su foto. Van
 * escritos con el nombre del catálogo de colores (Negro, Celeste, Fucsia...)
 * para que la muestra redonda de la tienda encuentre su tono; un nombre
 * inventado saldría sin color.
 *
 * Donde el color no es uno solo de verdad (estampados, tie-dye, unos lentes
 * que vienen en cuatro tonos) va Multicolor, que es lo que son.
 *
 * LAS TALLAS SON UNA DE CADA UNA
 *
 * Decisión de Carlos: no hay conteo por talla, así que si la descripción dice
 * "talla S y M", entra una de cada una. La cantidad que traía Treinta no sirve
 * para repartir porque es un solo número para todas las tallas juntas.
 *
 * Con dos excepciones, que están explicadas donde se aplican: no inventar
 * unidades de algo agotado, y no tirar a la basura unidades de algo con mucho
 * stock.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MARCA = "TREINTA";
const SIN_DEFINIR = "POR DEFINIR";
const COLOR_PENDIENTE = "Por definir";

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

/** Color leído de cada foto, por nombre de producto. */
const COLORES = {
  "Accesorios playero": "Blanco",
  "Bañador 3 piezas": "Naranja",
  "Bañador 3 piezas 11": "Multicolor",
  "Bañador 3 piezas 13": "Rojo",
  "Bañador 3 piezas 15": "Azul",
  "Bañador 3 piezas 18": "Menta",
  "Bañador 3 piezas 2": "Celeste",
  "Bañador 3 piezas 3": "Negro",
  "Bañador 3 piezas 5": "Azul",
  "Bañador 3 piezas 7": "Amarillo",
  "Bañador 3 piezas 8": "Negro",
  "Bañador 3 piezas 9": "Azul",
  "Bañador basico": "Negro",
  "Bañador basico 1": "Celeste",
  "Bañador basico 10": "Amarillo",
  "Bañador basico 11": "Azul",
  "bañador basico 12": "Celeste",
  "Bañador basico 13": "Blanco",
  "Bañador basico 15": "Amarillo",
  "Bañador basico 16": "Azul",
  "Bañador basico 18": "Verde",
  "Bañador basico 2": "Rojo",
  "Bañador basico 21": "Amarillo",
  "Bañador basico 22": "Naranja",
  "Bañador básico 22": "Rojo",
  "Bañador basico 28": "Azul",
  "Bañador basico 29": "Verde",
  "Bañador basico 4": "Morado",
  "Bañador basico 6": "Azul",
  "Bañador basico 7": "Amarillo",
  "Bañador basico 8": "Fucsia",
  "Bañador basico 9": "Fucsia",
  "Bañador bicolor": "Verde",
  "Bañador bicolor 1": "Amarillo",
  "Bañador brasil": "Rosado",
  "Bañador brasil 2": "Verde",
  "Bañador brasil basico": "Verde",
  "Bañador entero": "Marrón",
  "Bañador entero 1": "Beige",
  "Bañador estamapdo": "Naranja",
  "Bañador estampado": "Azul",
  "Bañador musera": "Multicolor",
  "Bañadores básicos": "Fucsia",
  "Bikini triangulo": "Azul",
  "Diadema perlada con estrella": "Blanco",
  "Falda playera": "Negro",
  Lentes: "Multicolor",
  "Lentes 1": "Multicolor",
  "Lentes 3": "Multicolor",
  "Lentes 4": "Multicolor",
  "Lentes oversized transparentes": "Gris",
  "Malla playera": "Celeste",
  Pañoletas: "Blanco",
  Pareo: "Negro",
  "Pareo 1": "Menta",
  "Set playero 1": "Rosado",
  "Set playero 2": "Celeste",
  "Set playero 5": "Multicolor",
  "Set playero 6": "Marrón",
  "Set playero 8": "Rosado",
  "Set playero 9": "Amarillo",
  Sombrero: "Beige",
  "Sombrero ajustable": "Negro",
  "Sombrero de playa": "Blanco",
  "Sombrero vaquero": "Celeste",
  "Top playero": "Beige",
  "Top playero 3": "Negro",
  "Traje de baño 4 piezas": "Negro",
  "Trikini 2": "Rojo",
  Vestido: "Blanco",
  "Vestido 2": "Verde",
  "Vestido 4": "Celeste",
  "Vestido playero 1": "Blanco",
  "Vestido playero 18": "Negro",
  "Vestido playero 4": "Rojo",
  "Vestido playero 5": "Negro",
  "Vestido playero 6": "Rosado",
  "Vestido playero 8": "Menta",
};

const ORDEN = ["XS", "S", "M", "L", "XL", "XXL"];

/** El "Ref 24€" trae números y letras que confunden a la lectura de tallas. */
const sinReferencia = (t) => (t || "").replace(/ref\s*[\d.,]+\s*€?/gi, " ");

function tallasDe(descripcion) {
  const texto = sinReferencia(descripcion).toUpperCase();
  const halladas = [...new Set(texto.match(/\b(XXL|XL|XS|S|M|L)\b/g) || [])];
  return halladas.sort((a, b) => ORDEN.indexOf(a) - ORDEN.indexOf(b));
}

/**
 * Cuántas de cada talla.
 *
 * Lo normal es una de cada una, que es lo pedido. Las dos excepciones:
 *
 *   Stock 0. Poner una de cada talla le inventaría existencias a algo que el
 *   catálogo da por agotado. Que un número sea impreciso es una cosa; que diga
 *   cero es otra, y ahí sí está afirmando algo.
 *
 *   Stock mayor que el número de tallas. Una de cada una tiraría el resto: un
 *   bikini con 10 unidades y tres tallas quedaría en 3. Se reparte el stock
 *   real, que sigue dando al menos una por talla.
 */
function repartir(tallas, stock) {
  if (tallas.length === 0) return [];
  if (stock === 0) return tallas.map((talla) => ({ talla, cantidad: 0 }));
  if (stock <= tallas.length) return tallas.map((talla) => ({ talla, cantidad: 1 }));

  const base = Math.floor(stock / tallas.length);
  const resto = stock % tallas.length;
  return tallas.map((talla, i) => ({
    talla,
    cantidad: base + (i < resto ? 1 : 0),
  }));
}

const { data: productos } = await supabase
  .from("productos")
  .select("id,nombre,descripcion,colores(id,nombre),variantes(id,talla,stock)")
  .eq("vendedor_externo", MARCA);

const cuenta = { colores: 0, tallas: 0, sinColorConocido: [], fallos: 0 };
const detalle = [];

for (const p of productos) {
  const color = p.colores[0];
  if (!color) continue;

  const pendienteColor = color.nombre === COLOR_PENDIENTE;
  const marca = p.variantes.find((v) => v.talla === SIN_DEFINIR);

  const nuevoColor = pendienteColor ? COLORES[p.nombre] : color.nombre;
  if (pendienteColor && !nuevoColor) {
    cuenta.sinColorConocido.push(p.nombre);
    continue;
  }

  // Nada que hacer: ya tiene color y ya tiene tallas.
  if (!pendienteColor && !marca) continue;

  if (marca) {
    const tallas = tallasDe(p.descripcion);
    if (tallas.length === 0) {
      cuenta.sinColorConocido.push(`${p.nombre} (sin tallas legibles)`);
      continue;
    }
    const reparto = repartir(tallas, marca.stock);
    detalle.push(
      `${p.nombre.padEnd(30).slice(0, 30)} ${nuevoColor.padEnd(11)} ` +
        `${reparto.map((r) => `${r.talla}:${r.cantidad}`).join(" ").padEnd(22)} ` +
        `(el catálogo decía ${marca.stock})`,
    );

    if (!ensayo) {
      const { error } = await supabase.rpc("completar_prenda", {
        p_color_id: color.id,
        p_color: nuevoColor,
        p_tallas: reparto,
      });
      if (error) {
        cuenta.fallos++;
        console.log(`  FALLÓ ${p.nombre}: ${error.message}`);
        continue;
      }
    }
    cuenta.tallas++;
    if (pendienteColor) cuenta.colores++;
  } else {
    // Solo le falta el color: la talla ya está bien y no hay que recontar nada.
    detalle.push(
      `${p.nombre.padEnd(30).slice(0, 30)} ${nuevoColor.padEnd(11)} (solo color)`,
    );
    if (!ensayo) {
      const { error } = await supabase
        .from("colores")
        .update({ nombre: nuevoColor })
        .eq("id", color.id);
      if (error) {
        cuenta.fallos++;
        console.log(`  FALLÓ ${p.nombre}: ${error.message}`);
        continue;
      }
    }
    cuenta.colores++;
  }
}

detalle.sort().forEach((d) => console.log("  " + d));

console.log("");
console.log(ensayo ? "ENSAYO, no se tocó nada:" : "Aplicado:");
console.log(`  colores puestos    ${cuenta.colores}`);
console.log(`  prendas repartidas ${cuenta.tallas}`);
if (cuenta.fallos) console.log(`  fallaron           ${cuenta.fallos}`);
if (cuenta.sinColorConocido.length) {
  console.log(`  sin resolver       ${cuenta.sinColorConocido.length}`);
  cuenta.sinColorConocido.forEach((n) => console.log(`    ${n}`));
}
