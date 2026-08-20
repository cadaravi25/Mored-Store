/**
 * Saca el catálogo de Treinta tal cual está publicado.
 *
 *   node scripts/treinta.mjs              lo escribe en scripts/datos/treinta.json
 *   node scripts/treinta.mjs --fotos      además baja las fotos a scripts/datos/fotos/
 *
 * Treinta no publica una API. Lo que sí tiene su catálogo es una acción de
 * servidor de Next (getProductsAction) que la propia página llama al hacer
 * scroll, y se puede llamar igual desde aquí: es la misma llamada que hace el
 * navegador de cualquiera que entre al catálogo, sin clave ni sesión.
 *
 * El identificador de la acción está incrustado en el JavaScript de la página.
 * Si Treinta publica una versión nueva, cambia, y esto deja de responder: por
 * eso está aislado en una sola constante y el error lo dice claro en vez de
 * devolver una lista vacía en silencio.
 *
 * ESTO SOLO LEE. No escribe nada en Supabase. El paso de convertir esto en
 * inventario es otro, y es el que necesita decisiones a mano (ver LEEME abajo).
 */

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const TIENDA = "MOREDSWIM";
const ID_TIENDA = "36313862-3934-5861-b531-663737386366";

// Sale del bundle de la página: chunks/8629-*.js, createServerReference(...).
const ACCION = "40e89d5fc171d513ba5da45513bbf5903a381d90be";

const DESTINO = fileURLToPath(new URL("./datos/", import.meta.url));

/**
 * La respuesta no es JSON: es el flujo RSC de Next, o sea varias líneas con
 * la forma "n:<json>". La que interesa es la única que trae un array `data`.
 */
function leerFlujo(texto) {
  for (const linea of texto.split("\n")) {
    const corte = linea.indexOf(":");
    if (corte < 0) continue;
    try {
      const trozo = JSON.parse(linea.slice(corte + 1));
      if (trozo && Array.isArray(trozo.data)) return trozo;
    } catch {
      // Las demás líneas son del propio protocolo; que no parseen es normal.
    }
  }
  return null;
}

async function pedirPagina(pagina, limite = 100) {
  const r = await fetch(`https://catalogo.treinta.co/${TIENDA}`, {
    method: "POST",
    headers: {
      "Next-Action": ACCION,
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify([{ storeId: ID_TIENDA, page: pagina, limit: limite }]),
    signal: AbortSignal.timeout(60000),
  });

  if (!r.ok) throw new Error(`Treinta respondió ${r.status}`);

  const trozo = leerFlujo(await r.text());
  if (!trozo) {
    throw new Error(
      "La respuesta no traía productos. Lo más probable es que Treinta haya " +
        "cambiado el identificador de la acción: hay que sacarlo otra vez del " +
        "JavaScript del catálogo.",
    );
  }
  return trozo;
}

/** Treinta manda "$undefined" en vez de null cuando el campo viene vacío. */
const vacio = (v) => v === "$undefined" || v == null;

async function todo() {
  const productos = [];
  for (let pagina = 1; pagina <= 50; pagina++) {
    const r = await pedirPagina(pagina);
    productos.push(...r.data);
    console.log(`  página ${pagina}: ${r.data.length}`);
    if (!r.hasNextPage) break;
  }
  return productos.map((p) => ({
    id: p.id,
    nombre: p.name,
    // Texto libre. Ahí dentro van las tallas y a veces los colores, que es
    // justo lo que Treinta no guarda como dato.
    descripcion: vacio(p.descripcion ?? p.description) ? null : p.description,
    precio_usd: p.price,
    stock: p.stock,
    visible: p.isVisible === 1,
    foto_url: vacio(p.imageUrl) ? null : p.imageUrl,
    // Estos vienen siempre vacíos en esta tienda; se guardan por si algún día
    // los empiezan a usar desde la app de Treinta.
    categoria: vacio(p.category) ? null : p.category,
    variantes: vacio(p.variants) ? null : p.variants,
    fotos: vacio(p.imageUrls) ? null : p.imageUrls,
  }));
}

async function bajarFotos(productos) {
  const carpeta = path.join(DESTINO, "fotos");
  await mkdir(carpeta, { recursive: true });

  let bien = 0;
  for (const p of productos) {
    if (!p.foto_url) continue;
    const nombre = `${p.id}.jpg`;
    try {
      const r = await fetch(p.foto_url, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`respondió ${r.status}`);
      await writeFile(
        path.join(carpeta, nombre),
        Buffer.from(await r.arrayBuffer()),
      );
      bien++;
    } catch (e) {
      console.log(`  ${p.nombre}: ${e.message}`);
    }
  }
  console.log(`\n${bien} fotos en ${carpeta}`);
}

/**
 * Todas las fotos de un producto.
 *
 * El listado devuelve `imageUrls` vacío y una sola foto, pero la ficha de cada
 * producto sí trae la galería completa. Y eso importa más de lo que parece:
 * cuando la descripción dice "azul M y verde S" no es un producto de dos
 * tallas, son dos prendas distintas, y cada una tiene su foto ahí dentro.
 */
async function fotosDe(id) {
  const r = await fetch(
    `https://catalogo.treinta.co/${TIENDA}/product/${id}`,
    { signal: AbortSignal.timeout(60000) },
  );
  if (!r.ok) return [];

  const html = await r.text();
  // Las del bucket, sin pasar por el redimensionador: son las originales.
  const crudas =
    html.match(
      /https:\/\/(?:us-east-1-prod-treinta-assets-bucket\.s3\.amazonaws\.com|cdn\.treinta\.co)[^"\\]*?\.(?:jpe?g|png|webp)/gi,
    ) ?? [];
  return [...new Set(crudas)];
}

console.log(`Leyendo catálogo de ${TIENDA}...`);
const productos = await todo();

console.log("\nBuscando las fotos de cada ficha...");
let conVarias = 0;
for (const p of productos) {
  p.fotos = await fotosDe(p.id);
  if (p.fotos.length > 1) conVarias++;
}
console.log(`${conVarias} productos tienen más de una foto.`);

await mkdir(DESTINO, { recursive: true });
await writeFile(
  path.join(DESTINO, "treinta.json"),
  JSON.stringify(productos, null, 1),
);

const unidades = productos.reduce((a, p) => a + (p.stock || 0), 0);
console.log(`\n${productos.length} productos, ${unidades} unidades de stock.`);
console.log(`Guardado en ${path.join(DESTINO, "treinta.json")}`);

if (process.argv.includes("--fotos")) await bajarFotos(productos);
else console.log("Para bajar las fotos: node scripts/treinta.mjs --fotos");
