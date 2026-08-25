/**
 * Los colores de Swim que estaban escondidos en la galería.
 *
 *   node scripts/colores_swim.mjs --ensayo
 *   node scripts/colores_swim.mjs
 *
 * QUÉ PASÓ
 *
 * Swim entró desde un vídeo de WhatsApp, y de cada prenda se guardaron todos
 * los cuadros que se veían bien. Cuando el proveedor enseñaba la misma prenda
 * en tres colores, los tres cuadros quedaron colgando del mismo color como
 * fotos de galería: la tienda los enseñaba como más fotos del rojo, no como
 * un rojo, un azul y un verde.
 *
 * Aquí cada una de esas fotos pasa a ser el color que de verdad enseña. Se
 * miraron las 83 prendas de Swim que tenían más de una foto, una por una, y
 * solo se tocan las 28 donde la foto es de otro color. Dos fotos de la misma
 * prenda de frente y de espaldas se quedan como estaban: eso es galería, no
 * un color, y las cuatro donde la foto enseñaba otro modelo las miró Carlos:
 * tres salieron como prenda propia en separar_swim.mjs.
 *
 * CÓMO SE REPARTE
 *
 * La posición es la de la hoja de contacto: 1 es la foto principal del color
 * que ya existía y 2 en adelante son las de galería, en orden. Un color nuevo
 * se queda con la primera que le toca como principal y el resto como galería,
 * y esas fotos se le quitan al color viejo, que ya no las enseña.
 *
 * Las tallas y los precios se copian del color que ya estaba: es la misma
 * prenda en otro color. El stock entra en una por talla, como todo lo que no
 * ha contado nadie.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ensayo = process.argv.includes("--ensayo");

/**
 * Prenda, color y las posiciones de sus fotos. El primer color de cada lista
 * es el que ya existe; los que siguen son nuevos.
 */
const REPARTO = {
  // El brasileño de lunares: la 1 y la 2 son el mismo corte con el estampado al
  // revés. La 3 era leopardo, otro modelo, y salió como prenda aparte.
  "01c074be-c5d5-4f34-aa50-a660c71a2e07": { Celeste: [1], Fucsia: [2] },
  "0619cdef-19f5-47dc-a723-b5185b656568": { Azul: [1], Rojo: [2] },
  "0c153c88-2cdf-45db-b969-3f0d7f22132f": { Rosado: [1], Blanco: [2] },
  "19fd02f8-f381-4a93-9b14-5632653d71b4": { Azul: [1], Naranja: [2, 3] },
  // Fotos de surtido: en cada una salen dos bikinis de colores distintos.
  "1af22d02-c11e-43fc-aae1-11387f1d6253": { Verde: [1], Amarillo: [2], Negro: [3] },
  "216ecaa7-405e-4517-9d60-b118e6e04243": { Amarillo: [1], Lila: [2], Negro: [3] },
  // La 2 trae el top de cuadros celestes con la misma tanga amarilla. Carlos lo
  // confirmó: es el mismo modelo en otro color.
  "25a2599c-a3ee-4f22-a212-997b59ed00db": { Amarillo: [1], Celeste: [2] },
  "2ccf3da5-f6e6-4dd7-9f3a-b0114ea9863b": { Azul: [1], Verde: [2, 3] },
  "327aa1b8-5140-4c02-9eea-6a6e9284695c": { "Marrón": [1], Rojo: [2], Azul: [3] },
  "33fb2473-1aa6-4862-94dc-03266092233a": { Rosado: [1], Blanco: [2] },
  "413b48a7-60e0-4ca0-a22f-c6c053f442c5": { Beige: [1], Negro: [2] },
  "4d803d9e-6db6-47c8-ace1-ee23805e080c": { Azul: [1], Rojo: [2, 3] },
  "503fe6f6-3921-45cf-909a-4028acaba16c": { Negro: [1], Blanco: [2, 3] },
  "50f73991-17d3-49bb-b3a8-083de0d4d540": { Blanco: [1], Beige: [2], "Marrón": [3] },
  "62f19530-f43a-4869-8e97-a3556c32b692": { Rojo: [1], Beige: [2], Verde: [3] },
  "6ede55b7-b368-492a-8be3-ecdbd6e95389": { Amarillo: [1], Naranja: [2, 3] },
  "732a04a6-8698-416c-873a-85b40636932e": { Azul: [1], Terracota: [2, 3] },
  "73b709c8-f3e0-4dea-adfb-16914e532d01": { Amarillo: [1], Celeste: [2, 3] },
  "7c2bb9a5-b06b-4a7a-861c-3cf1bd10281e": { Celeste: [1], Amarillo: [2], Burdeos: [3] },
  "9f1d9509-b650-458e-9661-8bfaa198d804": { Azul: [1], Negro: [2] },
  "a10f7328-21e3-47a9-8d54-050c5e1b1a2c": { Turquesa: [1], Fucsia: [2] },
  "a8ac91a1-ca82-45f8-81ae-791424085e62": { Fucsia: [1], Naranja: [2] },
  "a9dd1b29-c640-4883-a9af-c71ad21fdd87": { Blanco: [1, 2], Leopardo: [3] },
  "b0a71aed-ae0c-4577-bf44-48bfc29c04eb": { Negro: [1], "Marrón": [2], Rojo: [3] },
  "bbe4e8bb-f203-4cd6-b4c0-31b04ae403c6": { Fucsia: [1], Azul: [2] },
  "c89ee5b6-b328-46ae-9424-4abc80d87f0c": { Azul: [1], Blanco: [2], Verde: [3] },
  "d312ec3d-1d4d-4128-83dd-b5c67e3f299e": { Negro: [1], Blanco: [2], Beige: [3] },
  "e2685aea-41a6-44b6-956b-9479e1b1a7be": { Burdeos: [1], Rojo: [2], Azul: [3] },
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

const cuenta = { prendas: 0, colores: 0, variantes: 0, fotos: 0 };

for (const [productoId, reparto] of Object.entries(REPARTO)) {
  const { data: p, error } = await supabase
    .from("productos")
    .select(
      "id, nombre, descripcion, colores(id, nombre, orden, foto_url, fotos_color(id, url, orden)), variantes(talla, precio_usd, precio_bs, color_id)",
    )
    .eq("id", productoId)
    .single();
  if (error) throw new Error(`${productoId}: ${error.message}`);

  const nombres = Object.keys(reparto);
  const viejo = p.colores.find((c) => c.nombre === nombres[0]);
  if (!viejo) {
    console.log(`${p.descripcion}: no está el color ${nombres[0]}, se salta`);
    continue;
  }

  // La misma lista que se miró en la hoja de contacto: principal y galería.
  const galeria = [...(viejo.fotos_color ?? [])].sort((a, b) => a.orden - b.orden);
  const fotos = [viejo.foto_url, ...galeria.map((f) => f.url)];

  const base = p.variantes.filter((v) => v.color_id === viejo.id);
  const tallas = [...new Set(base.map((v) => v.talla))];
  const precio = base[0];

  console.log(`${p.nombre}: ${(p.descripcion ?? "").slice(0, 80)}`);
  console.log(`   ${viejo.nombre} se queda con la ${reparto[nombres[0]].join(" y la ")}`);
  cuenta.prendas++;

  let orden = Math.max(0, ...p.colores.map((c) => c.orden ?? 0));

  for (const nombre of nombres.slice(1)) {
    const posiciones = reparto[nombre];
    const urls = posiciones.map((i) => fotos[i - 1]).filter(Boolean);
    if (urls.length !== posiciones.length) {
      console.log(`   ! ${nombre}: falta foto en ${posiciones.join(", ")}`);
      continue;
    }
    if (p.colores.some((c) => c.nombre === nombre)) {
      console.log(`   = ${nombre}: ya existe, se salta`);
      continue;
    }
    console.log(
      `   + ${nombre}  ${tallas.join(" ")}  ${precio.precio_usd}  ${urls.length} foto(s)`,
    );
    cuenta.colores++;
    cuenta.variantes += tallas.length;
    cuenta.fotos += urls.length;

    if (ensayo) continue;

    orden++;
    const { data: color, error: e1 } = await supabase
      .from("colores")
      .insert({
        producto_id: p.id,
        nombre,
        orden,
        foto_url: urls[0],
        foto_miniatura_url: urls[0],
      })
      .select("id")
      .single();
    if (e1) throw new Error(`${nombre}: ${e1.message}`);

    for (const [i, url] of urls.slice(1).entries()) {
      const { error: e } = await supabase
        .from("fotos_color")
        .insert({ color_id: color.id, url, orden: i + 1 });
      if (e) throw new Error(`${nombre}, galería: ${e.message}`);
    }

    for (const talla of tallas) {
      const { data: variante, error: e2 } = await supabase
        .from("variantes")
        .insert({
          producto_id: p.id,
          color_id: color.id,
          talla,
          sku: `SW-${p.id.slice(0, 6)}-${orden}-${talla}`.toUpperCase(),
          precio_usd: precio.precio_usd,
          precio_bs: precio.precio_bs,
        })
        .select("id")
        .single();
      if (e2) throw new Error(`${nombre} ${talla}: ${e2.message}`);

      // El stock no se escribe a mano: se anota el movimiento y el disparador
      // de la base mueve la columna.
      const { error: e3 } = await supabase.from("movimientos_stock").insert({
        variante_id: variante.id,
        tipo: "ajuste",
        cantidad: 1,
        referencia_tipo: "manual",
        nota: `Color ${nombre} separado de la galería de ${viejo.nombre}. Nadie las contó: hay que repasar el stock.`,
      });
      if (e3) throw new Error(`${nombre} ${talla}: ${e3.message}`);
    }

    // La foto ya no es del color viejo: enseñaba otro.
    for (const url of urls) {
      const fila = galeria.find((f) => f.url === url);
      if (!fila) continue;
      const { error: e4 } = await supabase
        .from("fotos_color")
        .delete()
        .eq("id", fila.id);
      if (e4) throw new Error(`limpiar la galería: ${e4.message}`);
    }
  }
  console.log();
}

console.log(ensayo ? "ENSAYO, no se tocó nada" : "Listo");
console.log(`  prendas   ${cuenta.prendas}`);
console.log(`  colores   ${cuenta.colores}`);
console.log(`  variantes ${cuenta.variantes}`);
console.log(`  fotos que cambian de dueño ${cuenta.fotos}`);
