/**
 * Cambia las fotos provisionales por las buenas, prenda por prenda.
 *
 *   node scripts/fotos_catalogo.mjs --ensayo "<ruta a Catálogo>"
 *   node scripts/fotos_catalogo.mjs "<ruta a Catálogo>"
 *   node scripts/fotos_catalogo.mjs --solo=Accesorios "<ruta a Catálogo>"
 *
 * LO QUE HACE
 *
 * Por cada carpeta anotada en catalogo.mjs: renombra los colores que entraron
 * mal, crea los que las fotos enseñan y todavía no existen, y sube las fotos
 * al color que les toca. La primera de cada color es la principal y las demás
 * quedan de galería, que es lo que la ficha enseña como miniaturas.
 *
 * LAS FOTOS VIEJAS NO SE BORRAN
 *
 * Las de 276 píxeles recortadas del vídeo se quedan en el depósito, pero
 * dejan de estar enlazadas. Borrarlas sería irreversible y no ocupan nada;
 * enlazar las nuevas basta para que la tienda deje de enseñar las malas.
 *
 * SE PUEDE VOLVER A CORRER
 *
 * El nombre en el depósito lleva un resumen del archivo, así que la misma foto
 * cae siempre en la misma ruta. La galería se rehace entera cada vez, para que
 * volver a correrlo con una foto más no deje la de antes a medias.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, basename } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { enRuta } from "./rutas.mjs";
import { PRENDAS, CAPTURA } from "./catalogo.mjs";
import { PRENDAS2 } from "./catalogo2.mjs";

const ensayo = process.argv.includes("--ensayo");
const solo = process.argv.find((a) => a.startsWith("--solo="))?.slice(7);
// Cada tanda tiene su tabla. Las familias se repiten entre tandas, así que
// mezclarlas obligaría a mirar la fecha de cada carpeta para saber cuál es.
const tanda = process.argv.includes("--tanda=2") ? PRENDAS2 : PRENDAS;
// slice(2) y no find sobre todo argv: la ruta del propio guion tambien
// contiene "Catalogo" y se colaba como si fuera la carpeta pedida.
const RAIZ = process.argv.slice(2).find((a) => !a.startsWith("--"));

if (!RAIZ || !existsSync(RAIZ)) {
  console.log("Falta la ruta a la carpeta Catálogo.");
  process.exit(1);
}

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

/** Sube una foto y devuelve su dirección pública. */
async function subir(productoId, color, archivo) {
  const datos = await sharp(archivo, { failOn: "none" })
    .rotate()
    .resize(1200, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86 })
    .toBuffer();

  const huella = createHash("sha1").update(datos).digest("hex").slice(0, 10);
  const ruta = `${productoId}/${enRuta(color)}-${huella}.jpg`;

  const { error } = await supabase.storage.from("fotos").upload(ruta, datos, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw new Error(error.message);

  const url = supabase.storage.from("fotos").getPublicUrl(ruta).data.publicUrl;
  const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`subió pero responde ${r.status}`);
  return url;
}

const cuenta = {
  prendas: 0,
  renombrados: 0,
  coloresNuevos: 0,
  variantes: 0,
  principales: 0,
  galeria: 0,
  capturas: 0,
  fallos: 0,
};
const sobran = [];

for (const [clave, ficha] of Object.entries(tanda)) {
  if (solo && !clave.startsWith(`${solo}/`)) continue;

  const carpeta = join(RAIZ, clave);
  if (!existsSync(carpeta) || !statSync(carpeta).isDirectory()) {
    console.log(`${clave}: no está en la carpeta`);
    continue;
  }

  const { data: producto } = await supabase
    .from("productos")
    .select("id, nombre, descripcion, colores(id, nombre, orden), variantes(id, talla, sku, precio_usd, precio_bs)")
    .eq("id_externo", ficha.externo)
    .maybeSingle();

  if (!producto) {
    console.log(`${clave}: no hay prenda con el id ${ficha.externo}`);
    cuenta.fallos++;
    continue;
  }

  console.log(`\n${clave}  ->  ${producto.nombre}: ${producto.descripcion}`);
  cuenta.prendas++;

  // Renombrar antes de comparar: si "Por definir" ya es "Multicolor", no se
  // crea otro color al lado.
  for (const [viejo, nuevo] of Object.entries(ficha.renombrar ?? {})) {
    const c = producto.colores.find((x) => igual(x.nombre, viejo));
    if (!c) continue;
    console.log(`  ${viejo} pasa a llamarse ${nuevo}`);
    if (!ensayo) {
      const { error } = await supabase.from("colores").update({ nombre: nuevo }).eq("id", c.id);
      if (error) throw new Error(error.message);
    }
    c.nombre = nuevo;
    cuenta.renombrados++;
  }

  // Lo que hay en la carpeta, sin las capturas de pantalla.
  const enDisco = [];
  for (const f of readdirSync(carpeta).sort()) {
    const m = await sharp(join(carpeta, f), { failOn: "none" }).metadata();
    if (m.width / m.height < CAPTURA) {
      cuenta.capturas++;
      continue;
    }
    enDisco.push(f);
  }

  const tallas = [...new Set(producto.variantes.map((v) => v.talla))]
    .filter((t) => t !== "POR DEFINIR")
    .sort((a, b) => ORDEN_TALLAS.indexOf(a) - ORDEN_TALLAS.indexOf(b));
  const modelo = producto.variantes[0];
  const usados = producto.variantes
    .map((v) => Number(v.sku?.match(/-(\d+)-[A-Z]+$/)?.[1]))
    .filter((n) => Number.isFinite(n));
  let siguiente = (usados.length ? Math.max(...usados) : producto.colores.length) + 1;
  const prefijo = modelo?.sku?.replace(/-\d+-[A-Z]+$/, "") ?? null;

  const usadas = new Set();

  for (const [nombreColor, fotos] of Object.entries(ficha.colores)) {
    const faltan = fotos.filter((f) => !enDisco.includes(f));
    if (faltan.length) {
      console.log(`  ojo: ${faltan.join(", ")} no está en la carpeta`);
    }
    const hay = fotos.filter((f) => enDisco.includes(f));
    if (!hay.length) continue;
    hay.forEach((f) => usadas.add(f));

    let color = producto.colores.find((c) => igual(c.nombre, nombreColor));

    // Un color que las fotos enseñan y el inventario no tenía. Entra con las
    // mismas tallas y precios que los que la prenda ya vendía: la foto no dice
    // ni una cosa ni la otra.
    if (!color) {
      if (!tallas.length || !modelo) {
        console.log(`  ${nombreColor}: no hay tallas de referencia, se salta`);
        continue;
      }
      console.log(`  + ${nombreColor} (nuevo)  ${tallas.join(" ")}  ${modelo.precio_usd}/${modelo.precio_bs}`);
      cuenta.coloresNuevos++;
      if (!ensayo) {
        const orden = Math.max(0, ...producto.colores.map((c) => c.orden)) + 1;
        const { data: fila, error: falloC } = await supabase
          .from("colores")
          .insert({ producto_id: producto.id, nombre: nombreColor, orden })
          .select("id")
          .single();
        if (falloC) throw new Error(falloC.message);
        color = { id: fila.id, nombre: nombreColor, orden };
        producto.colores.push(color);

        const n = siguiente++;
        for (const talla of tallas) {
          const { data: variante, error: falloV } = await supabase
            .from("variantes")
            .insert({
              producto_id: producto.id,
              color_id: color.id,
              talla,
              sku: prefijo ? `${prefijo}-${n}-${talla}` : null,
              precio_usd: modelo.precio_usd,
              precio_bs: modelo.precio_bs,
            })
            .select("id")
            .single();
          if (falloV) throw new Error(falloV.message);
          cuenta.variantes++;

          // Nadie contó estas prendas. Entra una por talla, igual que entró
          // todo el catálogo, y la nota lo deja dicho.
          const { error: falloM } = await supabase.from("movimientos_stock").insert({
            variante_id: variante.id,
            tipo: "ajuste",
            cantidad: 1,
            referencia_tipo: "manual",
            nota: `Color ${nombreColor} agregado desde la carpeta de fotos (${clave}). Nadie las contó: hay que repasar el stock.`,
          });
          if (falloM) throw new Error(falloM.message);
        }
      } else {
        cuenta.variantes += tallas.length;
        color = { id: null, nombre: nombreColor, orden: 0 };
      }
    }

    console.log(`    ${nombreColor.padEnd(12)} ${hay.length} foto(s): ${hay.join(", ")}`);
    if (ensayo) {
      cuenta.principales++;
      cuenta.galeria += hay.length - 1;
      continue;
    }

    try {
      const urls = [];
      for (const f of hay) urls.push(await subir(producto.id, nombreColor, join(carpeta, f)));

      const { error: e1 } = await supabase
        .from("colores")
        .update({ foto_url: urls[0] })
        .eq("id", color.id);
      if (e1) throw new Error(e1.message);
      cuenta.principales++;

      // La galería se rehace entera: si se vuelve a correr con más fotos, la
      // de antes no se queda a medias.
      await supabase.from("fotos_color").delete().eq("color_id", color.id);
      if (urls.length > 1) {
        const filas = urls.slice(1).map((url, i) => ({ color_id: color.id, url, orden: i + 1 }));
        const { error: e2 } = await supabase.from("fotos_color").insert(filas);
        if (e2) throw new Error(e2.message);
        cuenta.galeria += filas.length;
      }
    } catch (e) {
      console.log(`      FALLÓ: ${e.message}`);
      cuenta.fallos++;
    }
  }

  const huerfanas = enDisco.filter((f) => !usadas.has(f));
  if (huerfanas.length) {
    sobran.push({ clave, producto: producto.descripcion, fotos: huerfanas });
  }
}

console.log(ensayo ? "\nENSAYO, no se subió nada" : "\nListo");
console.log(`  prendas        ${cuenta.prendas}`);
console.log(`  renombrados    ${cuenta.renombrados}`);
console.log(`  colores nuevos ${cuenta.coloresNuevos}`);
console.log(`  variantes      ${cuenta.variantes}`);
console.log(`  principales    ${cuenta.principales}`);
console.log(`  de galería     ${cuenta.galeria}`);
console.log(`  capturas       ${cuenta.capturas} (no se suben)`);
if (cuenta.fallos) console.log(`  FALLOS         ${cuenta.fallos}`);

if (sobran.length) {
  console.log("\nFOTOS DE LA CARPETA QUE NADIE PIDIÓ:");
  console.log("Si alguna es buena, falta anotarla en catalogo.mjs.\n");
  for (const s of sobran) {
    console.log(`  ${s.clave} (${s.producto})`);
    for (const f of s.fotos) console.log(`      ${f}`);
  }
}
