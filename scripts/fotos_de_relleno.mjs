/**
 * Baja fotos de relleno para poder juzgar el cuerpo de la tienda antes de
 * tener las propias.
 *
 *   node scripts/fotos_de_relleno.mjs
 *
 * Vienen de loremflickr, que sirve fotos de Flickr con licencia abierta. NO se
 * usan fotos de Pinterest: tienen dueño y quedarían en el repositorio aunque
 * después se reemplacen.
 *
 * TODAS estas se reemplazan antes de publicar. Son un andamio, no contenido.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DESTINO = fileURLToPath(new URL("../app/public/tienda/", import.meta.url));

const FOTOS = [
  { nombre: "banner-nuevo.webp", temas: ["activewear", "fitness", "woman"], w: 900, h: 1200 },
  { nombre: "banner-favoritas.webp", temas: ["leggings", "yoga", "sport"], w: 900, h: 1200 },
  { nombre: "banner-tienda.webp", temas: ["boutique", "store", "fashion"], w: 900, h: 1200 },
  { nombre: "inspiracion.webp", temas: ["swimwear", "beach", "summer"], w: 1000, h: 1300 },
  { nombre: "ig-1.webp", temas: ["yoga", "fitness"], w: 800, h: 800 },
  { nombre: "ig-2.webp", temas: ["swimsuit", "sea", "beach"], w: 800, h: 800 },
  { nombre: "ig-3.webp", temas: ["running", "sport"], w: 800, h: 800 },
  { nombre: "ig-4.webp", temas: ["sunset", "beach"], w: 800, h: 800 },
  { nombre: "ig-5.webp", temas: ["gym", "training"], w: 800, h: 800 },
  { nombre: "ig-6.webp", temas: ["sportswear", "portrait", "model"], w: 800, h: 800 },
];

await mkdir(DESTINO, { recursive: true });

for (const f of FOTOS) {
  // Cada tema puede no tener resultados: se prueban en orden hasta que uno
  // responda, y de última una foto cualquiera antes que un hueco.
  let datos = null;
  let ultimo = "";
  for (const tema of [...f.temas, ""]) {
    const url = tema
      ? `https://loremflickr.com/${f.w}/${f.h}/${tema}?lock=${f.nombre.length * 7}`
      : `https://picsum.photos/${f.w}/${f.h}`;
    try {
      const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000) });
      if (!r.ok) { ultimo = `respondió ${r.status}`; continue; }
      datos = Buffer.from(await r.arrayBuffer());
      break;
    } catch (e) { ultimo = e.message; }
  }
  try {
    if (!datos) throw new Error(ultimo);
    // Se guardan con extensión .webp aunque lleguen en jpeg: el navegador
    // decide por el contenido, no por el nombre, y así el código no cambia
    // cuando entren las definitivas.
    await writeFile(path.join(DESTINO, f.nombre), datos);
    console.log(`  ${f.nombre.padEnd(24)} ${Math.round(datos.length / 1024)} KB`);
  } catch (e) {
    console.log(`  ${f.nombre.padEnd(24)} falló: ${e.message}`);
  }
}

console.log("\nSon de relleno. Reemplázalas antes de publicar.");
