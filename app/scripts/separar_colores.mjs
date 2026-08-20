/**
 * Separa en colores distintos las prendas que entraron como una sola.
 *
 *   node scripts/separar_colores.mjs --ensayo
 *   node scripts/separar_colores.mjs
 *
 * EL ERROR QUE ARREGLA
 *
 * "Ref 18€/ azul M y verde S" no es una prenda azul que además viene en S y M.
 * Son dos prendas: una azul talla M y una verde talla S. Al importar se leyó
 * como una sola y se le puso el primer color que apareció en el texto, que
 * además a veces era el equivocado.
 *
 * La ficha de cada producto en Treinta trae una foto por color. Esas fotos son
 * las que permiten saber cuál es cuál, y están miradas una por una: la tabla
 * de aquí abajo dice, para cada prenda, qué color es cada foto y en qué tallas
 * lo tienen.
 *
 * QUÉ MANDA CUANDO NO COINCIDEN
 *
 * La descripción, no las fotos. Varias fichas traen fotos de colores que la
 * descripción no menciona: son las opciones del proveedor, no lo que ellas
 * compraron. Se importa lo que dice la descripción.
 *
 * Al revés también pasa: un color nombrado que no tiene foto. Ese color se
 * crea igual, porque la prenda existe y tiene que estar en el inventario, pero
 * sin foto no sale a la tienda hasta que le tomen una desde el panel.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MARCA = "TREINTA";
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

/**
 * Qué es cada foto de cada prenda.
 *
 * `foto` es la posición dentro de la galería de Treinta, empezando en cero, y
 * es la misma que se ve en las hojas de contacto (a, b, c). `null` es un color
 * que la descripción nombra pero que no aparece en ninguna foto.
 */
const MEZCLAS = {
  "Bañador 3 piezas 4": [
    { color: "Verde", tallas: ["S", "M"], foto: 0 },
    { color: "Naranja", tallas: ["M"], foto: 1 },
    { color: "Azul", tallas: ["S"], foto: 2 },
  ],
  "Bañador bicolor 4": [
    { color: "Azul", tallas: ["S"], foto: 0 },
    { color: "Naranja", tallas: ["S", "M"], foto: 2 },
  ],
  "Bañador completo 3": [
    { color: "Azul", tallas: ["S"], foto: 0 },
    { color: "Rojo", tallas: ["M"], foto: 1 },
    { color: "Terracota", tallas: ["S"], foto: 2 },
  ],
  "Bañador con accesorio": [
    { color: "Naranja", tallas: ["M"], foto: 0 },
    { color: "Marrón", tallas: ["S", "M"], foto: 2 },
  ],
  "Bañador con accesorio 1": [
    { color: "Rojo", tallas: ["S"], foto: 0 },
    { color: "Guayaba", tallas: ["M"], foto: 1 },
    { color: "Amarillo", tallas: ["S"], foto: 2 },
  ],
  "Bañador enterizo 6": [
    { color: "Azul", tallas: ["M"], foto: 0 },
    { color: "Rojo", tallas: ["S", "M"], foto: 1 },
    { color: "Marrón", tallas: ["M"], foto: 2 },
  ],
  "Bikini amarillo lunares": [
    { color: "Amarillo", tallas: ["S", "M"], foto: 0 },
    { color: "Morado", tallas: ["M"], foto: 1 },
  ],
  "Bikini azul y marron": [
    // Las tres fotos son de la marrón con vivos distintos. La azul y la rosada
    // que nombra la descripción no están fotografiadas.
    { color: "Marrón", tallas: ["S", "M"], foto: 1 },
    { color: "Azul", tallas: ["S"], foto: 0 },
    { color: "Rosado", tallas: ["S", "M"], foto: null },
  ],
  "Bikini rosa flores set": [
    { color: "Rosado", tallas: ["XS", "S", "M"], foto: 0 },
    { color: "Morado", tallas: ["S"], foto: 1 },
  ],
  "Trikinis 1": [
    { color: "Rojo", tallas: ["S"], foto: 0 },
    { color: "Fucsia", tallas: ["XS"], foto: 1 },
  ],
  "Vestido escote profundo": [
    { color: "Amarillo", tallas: ["XS"], foto: 0 },
    { color: "Burdeos", tallas: ["XS", "S", "M"], foto: 1 },
    { color: "Negro", tallas: ["XS", "S", "M"], foto: 2 },
  ],
  "Vestido playero 7": [
    // Ellas le dicen verde; la prenda es turquesa y así se ve en la foto.
    { color: "Turquesa", tallas: ["S"], foto: 0 },
    { color: "Azul", tallas: ["M"], foto: 2 },
  ],
  "Vestido tubo floral amarillo": [
    { color: "Amarillo", tallas: ["S"], foto: 0 },
    { color: "Blanco", tallas: ["XS", "S", "M"], foto: 1 },
  ],
  "Bañador básico 20": [
    { color: "Blanco", tallas: ["S"], foto: 0 },
    { color: "Rojo", tallas: ["XS"], foto: 2 },
  ],
  "Bikini bicolor": [
    { color: "Azul", tallas: ["XS", "S"], foto: 0 },
    { color: "Marrón", tallas: ["S", "M"], foto: 2 },
  ],
};

/** Tonos que su catálogo de colores no tenía. */
const TONOS = [
  { nombre: "Terracota", hex: "#c1673f" },
  { nombre: "Guayaba", hex: "#c07b96" },
];

const enRuta = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "color";

async function copiarFoto(productoId, color, origen) {
  const r = await fetch(origen, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`la foto respondió ${r.status}`);
  const ruta = `${productoId}/${enRuta(color)}-treinta.jpg`;
  const { error } = await supabase.storage
    .from("fotos")
    .upload(ruta, Buffer.from(await r.arrayBuffer()), {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: true,
    });
  if (error) throw new Error(error.message);
  return supabase.storage.from("fotos").getPublicUrl(ruta).data.publicUrl;
}

// ---------------------------------------------------------------------------

const catalogo = JSON.parse(
  readFileSync(new URL("./datos/treinta.json", import.meta.url), "utf8"),
);
const porNombre = new Map(catalogo.map((p) => [p.nombre, p]));

if (!ensayo) {
  const { data: max } = await supabase
    .from("colores_catalogo")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .single();
  let orden = (max?.orden ?? 0) + 10;
  for (const t of TONOS) {
    const { error } = await supabase
      .from("colores_catalogo")
      .insert({ ...t, orden });
    if (!error) console.log(`tono nuevo: ${t.nombre} ${t.hex}`);
    orden += 10;
  }
}

let hechas = 0;
let sinFoto = 0;

for (const [nombre, partes] of Object.entries(MEZCLAS)) {
  const { data: producto } = await supabase
    .from("productos")
    .select("id, colores(id, nombre), variantes(id, precio_usd)")
    .eq("vendedor_externo", MARCA)
    .eq("nombre", nombre)
    .single();

  if (!producto) {
    console.log(`  no está en inventario: ${nombre}`);
    continue;
  }

  const treinta = porNombre.get(nombre);
  const precio = producto.variantes[0]?.precio_usd ?? treinta?.precio_usd ?? 0;

  console.log(`\n${nombre}`);
  for (const parte of partes) {
    const foto = parte.foto === null ? null : treinta?.fotos?.[parte.foto];
    if (!foto && parte.foto !== null) {
      console.log(`  ${parte.color}: la foto ${parte.foto} no existe`);
      continue;
    }
    console.log(
      `  ${parte.color.padEnd(11)} ${parte.tallas.join(" ").padEnd(10)}` +
        (foto ? "" : "  (sin foto: no sale a la tienda)"),
    );
    if (!foto) sinFoto++;
  }

  if (ensayo) continue;

  // Se rehacen los colores desde cero: el que había mezclaba varias prendas y
  // no hay forma de repartirlo. El libro de movimientos va primero, que es
  // quien impide borrar las variantes.
  const idsVariantes = producto.variantes.map((v) => v.id);
  if (idsVariantes.length) {
    await supabase
      .from("movimientos_stock")
      .delete()
      .in("variante_id", idsVariantes);
  }
  await supabase
    .from("colores")
    .delete()
    .in("id", producto.colores.map((c) => c.id));

  for (const [i, parte] of partes.entries()) {
    const origen = parte.foto === null ? null : treinta?.fotos?.[parte.foto];

    let url = null;
    if (origen) {
      try {
        url = await copiarFoto(producto.id, parte.color, origen);
      } catch (e) {
        console.log(`  ${parte.color}: foto no copiada (${e.message})`);
      }
    }

    const { data: color, error: falloColor } = await supabase
      .from("colores")
      .insert({
        producto_id: producto.id,
        nombre: parte.color,
        foto_url: url,
        orden: i,
      })
      .select("id")
      .single();
    if (falloColor) {
      console.log(`  ${parte.color}: ${falloColor.message}`);
      continue;
    }

    for (const talla of parte.tallas) {
      const { data: variante, error: falloVariante } = await supabase
        .from("variantes")
        .insert({
          producto_id: producto.id,
          color_id: color.id,
          talla,
          sku: `TR-${producto.id.replace(/-/g, "").slice(0, 10)}-${enRuta(parte.color).slice(0, 6)}-${talla}`,
          precio_usd: precio,
        })
        .select("id")
        .single();
      if (falloVariante) {
        console.log(`  ${parte.color} ${talla}: ${falloVariante.message}`);
        continue;
      }

      // Una de cada talla, que es lo acordado: no hay conteo por talla.
      await supabase.from("movimientos_stock").insert({
        variante_id: variante.id,
        tipo: "ajuste",
        cantidad: 1,
        referencia_tipo: "manual",
        nota: "Separado por color al importar de Treinta",
      });
    }
  }
  hechas++;
}

console.log("");
console.log(ensayo ? "ENSAYO, no se tocó nada." : `${hechas} prendas separadas.`);
if (sinFoto) {
  console.log(`${sinFoto} color(es) sin foto: están en inventario pero no en la tienda.`);
}
