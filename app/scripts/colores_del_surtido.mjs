/**
 * Le pone nombre a los colores de las prendas que solo tienen foto de surtido.
 *
 *   node scripts/colores_del_surtido.mjs --ensayo
 *   node scripts/colores_del_surtido.mjs
 *
 * POR QUÉ EXISTE APARTE
 *
 * Estas prendas no tienen carpeta en "Catálogo": no llegaron fotos nuevas de
 * ellas. Lo único que hay es el recorte del vídeo, y en ese recorte salen
 * cuatro o seis colores tendidos juntos. Por eso entraron con un solo color
 * llamado "Por definir", que en la tienda se lee como un error.
 *
 * Se aplica la misma regla que en el resto del catálogo: un color sin foto
 * propia lleva la del grupo donde sale. Aquí todos salen en la misma, así que
 * todos llevan la misma. No es lo ideal, pero es mejor que una prenda que dice
 * "Por definir" y esconde cuatro colores.
 *
 * LA FOTO SIGUE SIENDO LA DEL VÍDEO
 *
 * De 276 píxeles. Cuando lleguen las buenas, esto se queda como está: solo
 * habrá que anotar la carpeta en catalogo.mjs y correr fotos_catalogo.mjs, que
 * les cambia la foto a todos.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ensayo = process.argv.includes("--ensayo");

/**
 * Los colores que se ven en el surtido de cada prenda.
 *
 * El primero es al que pasa a llamarse el "Por definir" que ya existe; los
 * demás se crean. Se renombra en vez de crear otro al lado para no dejar
 * huérfanos los movimientos de stock que ya cuelgan de él.
 */
const PRENDAS = {
  // Cuatro leggins tendidos: azul rey, burdeos, rojo y azul marino.
  "35/0117": ["Azul", "Burdeos", "Rojo", "Azul marino"],
  // Tres camisetas: dos negras con estampados distintos y una crema con las
  // mangas azul marino. Son dos colores, no tres.
  "35/0181": ["Negro", "Blanco"],
  // Seis sujetadores en fila.
  "55/0169": ["Negro", "Burdeos", "Azul", "Marrón", "Gris", "Blanco"],
  // Cinco camisetas, dos de ellas negras.
  "55/0175": ["Negro", "Marrón", "Rosado", "Blanco"],
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

const sinTildes = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const igual = (a, b) => sinTildes(a) === sinTildes(b);

const ORDEN_TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];
const cuenta = { renombrados: 0, colores: 0, variantes: 0 };

for (const [externo, deseados] of Object.entries(PRENDAS)) {
  const { data: p } = await supabase
    .from("productos")
    .select("id, nombre, descripcion, colores(id, nombre, orden, foto_url), variantes(id, talla, sku, precio_usd, precio_bs)")
    .eq("id_externo", externo)
    .maybeSingle();

  if (!p) {
    console.log(`${externo}: no hay prenda con ese id`);
    continue;
  }
  console.log(`\n[${externo}] ${p.nombre}: ${p.descripcion}`);

  const viejo = p.colores.find((c) => igual(c.nombre, "Por definir"));
  if (!viejo) {
    console.log("  ya no tiene ningún color por definir, se salta");
    continue;
  }
  // La foto del surtido: la que ya tenía, y la que van a compartir todos.
  const foto = viejo.foto_url;
  if (!foto) {
    console.log("  no tiene foto, se salta");
    continue;
  }

  const [primero, ...resto] = deseados;
  console.log(`  Por definir pasa a llamarse ${primero}`);
  if (!ensayo) {
    const { error } = await supabase
      .from("colores")
      .update({ nombre: primero })
      .eq("id", viejo.id);
    if (error) throw new Error(error.message);
  }
  viejo.nombre = primero;
  cuenta.renombrados++;

  const tallas = [...new Set(p.variantes.map((v) => v.talla))]
    .filter((t) => t !== "POR DEFINIR")
    .sort((a, b) => ORDEN_TALLAS.indexOf(a) - ORDEN_TALLAS.indexOf(b));
  const modelo = p.variantes[0];
  const usados = p.variantes
    .map((v) => Number(v.sku?.match(/-(\d+)-[A-Z]+$/)?.[1]))
    .filter((n) => Number.isFinite(n));
  let siguiente = (usados.length ? Math.max(...usados) : p.colores.length) + 1;
  const prefijo = modelo?.sku?.replace(/-\d+-[A-Z]+$/, "") ?? null;

  for (const nombre of resto) {
    if (p.colores.some((c) => igual(c.nombre, nombre))) continue;
    console.log(`  + ${nombre.padEnd(13)} ${tallas.join(" ")}  ${modelo.precio_usd}/${modelo.precio_bs}`);
    cuenta.colores++;
    if (ensayo) {
      cuenta.variantes += tallas.length;
      continue;
    }

    const orden = Math.max(0, ...p.colores.map((c) => c.orden)) + 1;
    const { data: fila, error: falloC } = await supabase
      .from("colores")
      .insert({ producto_id: p.id, nombre, orden, foto_url: foto })
      .select("id")
      .single();
    if (falloC) throw new Error(falloC.message);
    p.colores.push({ id: fila.id, nombre, orden, foto_url: foto });

    const n = siguiente++;
    for (const talla of tallas) {
      const { data: variante, error: falloV } = await supabase
        .from("variantes")
        .insert({
          producto_id: p.id,
          color_id: fila.id,
          talla,
          sku: prefijo ? `${prefijo}-${n}-${talla}` : null,
          precio_usd: modelo.precio_usd,
          precio_bs: modelo.precio_bs,
        })
        .select("id")
        .single();
      if (falloV) throw new Error(falloV.message);
      cuenta.variantes++;

      const { error: falloM } = await supabase.from("movimientos_stock").insert({
        variante_id: variante.id,
        tipo: "ajuste",
        cantidad: 1,
        referencia_tipo: "manual",
        nota: `Color ${nombre}, de los que salen en la foto de surtido. Nadie las contó: hay que repasar el stock.`,
      });
      if (falloM) throw new Error(falloM.message);
    }
  }
}

console.log(ensayo ? "\nENSAYO, no se tocó nada" : "\nListo");
console.log(`  renombrados ${cuenta.renombrados}`);
console.log(`  colores     ${cuenta.colores}`);
console.log(`  variantes   ${cuenta.variantes}`);
