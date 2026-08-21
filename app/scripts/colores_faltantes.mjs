/**
 * Le agrega a cada enterizo los colores que salen en su carpeta de fotos.
 *
 *   node scripts/colores_faltantes.mjs --ensayo
 *   node scripts/colores_faltantes.mjs
 *
 * POR QUÉ HACE FALTA
 *
 * El catálogo se cargó del vídeo del proveedor, y el vídeo nombra un color por
 * prenda aunque la venda en cinco. Las carpetas de fotos sí los traen todos,
 * así que la mitad de las fotos se quedaban fuera de la tienda: no por no
 * tener foto, sino por no tener dónde colgarla.
 *
 * QUÉ CREA
 *
 * El color, y una variante por cada talla que esa prenda ya tenía, con sus
 * mismos precios. Las tallas no las dice la foto, así que se copian: si la
 * prenda se vende en S y M en negro, el azul entra también en S y M.
 *
 * EL STOCK ES UNA SUPOSICIÓN, Y SE NOTA
 *
 * Nadie contó estas prendas. Entra una por talla, que es la misma regla con la
 * que entró todo el catálogo, y el movimiento queda con una nota que lo dice.
 * Hay que repasarlo en el panel antes de fiarse del inventario.
 *
 * SE PUEDE VOLVER A CORRER
 *
 * Un color que ya existe no se duplica ni se le vuelve a sumar stock. Solo se
 * crea lo que falta.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { PAREJAS, COLORES, RENOMBRES, PALETA_NUEVA } from "./enterizos.mjs";

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

const sinTildes = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const igual = (a, b) => sinTildes(a) === sinTildes(b);

const cuenta = { paleta: 0, renombrados: 0, colores: 0, variantes: 0, saltados: 0 };

// La paleta primero: sin hex, el puntito del color sale en blanco en la tienda.
const { data: paleta } = await supabase.from("colores_catalogo").select("nombre");
for (const c of PALETA_NUEVA) {
  if (paleta.some((p) => igual(p.nombre, c.nombre))) continue;
  console.log(`paleta: falta ${c.nombre} ${c.hex}`);
  if (ensayo) { cuenta.paleta++; continue; }
  const { error } = await supabase.from("colores_catalogo").insert(c);
  if (error) throw new Error(error.message);
  cuenta.paleta++;
}

const { data: productos, error: falloP } = await supabase
  .from("productos")
  .select("id, descripcion, id_externo, colores(id, nombre, orden), variantes(id, talla, sku, precio_usd, precio_bs, color_id)")
  .eq("nombre", "Enterizo");
if (falloP) throw new Error(falloP.message);

for (const [carpeta, deseados] of Object.entries(COLORES)) {
  const cuadro = PAREJAS[carpeta];
  const p = productos.find((x) => x.id_externo === cuadro);
  if (!p) {
    console.log(`${carpeta}: sin prenda (${cuadro})`);
    continue;
  }
  console.log(`\n${carpeta}  ->  ${p.descripcion}`);

  // Renombrar antes de comparar: si "Morado" ya es "Burdeos", no se crea otro.
  for (const [k, nuevo] of Object.entries(RENOMBRES)) {
    if (!k.startsWith(`${carpeta}|`)) continue;
    const viejo = k.split("|")[1];
    const c = p.colores.find((x) => igual(x.nombre, viejo));
    if (!c) continue;
    console.log(`  ${viejo} pasa a llamarse ${nuevo}`);
    if (!ensayo) {
      const { error } = await supabase.from("colores").update({ nombre: nuevo }).eq("id", c.id);
      if (error) throw new Error(error.message);
    }
    c.nombre = nuevo;
    cuenta.renombrados++;
  }

  // Las tallas y los precios salen de lo que la prenda ya vende. La foto no
  // dice ninguna de las dos cosas.
  const tallas = [...new Set(p.variantes.map((v) => v.talla))]
    .filter((t) => t !== "POR DEFINIR")
    .sort((a, b) => "XS S M L XL XXL".split(" ").indexOf(a) - "XS S M L XL XXL".split(" ").indexOf(b));
  const modelo = p.variantes[0];
  if (!tallas.length || !modelo) {
    console.log("  sin tallas de referencia, se salta");
    continue;
  }

  // El sku lleva el número del color: se sigue contando desde el último.
  const usados = p.variantes
    .map((v) => Number(v.sku?.match(/-(\d+)-[A-Z]+$/)?.[1]))
    .filter((n) => Number.isFinite(n));
  let siguiente = (usados.length ? Math.max(...usados) : p.colores.length) + 1;
  const prefijo = modelo.sku?.replace(/-\d+-[A-Z]+$/, "") ?? `AC-${cuadro.replace("/", "")}`;

  for (const nombre of Object.keys(deseados)) {
    if (p.colores.some((c) => igual(c.nombre, nombre))) {
      cuenta.saltados++;
      continue;
    }
    const n = siguiente++;
    console.log(`  + ${nombre.padEnd(13)} ${tallas.join(" ")}   ${modelo.precio_usd}/${modelo.precio_bs}`);
    if (ensayo) {
      cuenta.colores++;
      cuenta.variantes += tallas.length;
      continue;
    }

    const orden = Math.max(0, ...p.colores.map((c) => c.orden)) + 1;
    const { data: color, error: falloC } = await supabase
      .from("colores")
      .insert({ producto_id: p.id, nombre, orden })
      .select("id")
      .single();
    if (falloC) throw new Error(falloC.message);
    p.colores.push({ id: color.id, nombre, orden });
    cuenta.colores++;

    for (const talla of tallas) {
      const { data: variante, error: falloV } = await supabase
        .from("variantes")
        .insert({
          producto_id: p.id,
          color_id: color.id,
          talla,
          sku: `${prefijo}-${n}-${talla}`,
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
        nota: `Color ${nombre} agregado desde la carpeta de fotos (${carpeta}). Nadie las contó: hay que repasar el stock.`,
      });
      if (falloM) throw new Error(falloM.message);
    }
  }
}

console.log(ensayo ? "\nENSAYO, no se tocó nada" : "\nListo");
console.log(`  paleta      ${cuenta.paleta}`);
console.log(`  renombrados ${cuenta.renombrados}`);
console.log(`  colores     ${cuenta.colores}`);
console.log(`  variantes   ${cuenta.variantes}`);
console.log(`  ya estaban  ${cuenta.saltados}`);
