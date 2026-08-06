/**
 * Crea una prenda de muestra por cada tipo, en las dos colecciones, para poder
 * probar todos los filtros de la tienda.
 *
 *   node scripts/muestras.mjs           crea las muestras
 *   node scripts/muestras.mjs --borrar  las quita todas
 *
 * ESTO ES DATO DE PRUEBA. Todo lo que crea queda marcado con vendedor_externo
 * = 'MUESTRA', que es lo que permite borrarlo de un golpe sin tocar nada real.
 * Hay que quitarlo antes de publicar.
 *
 * El stock se mueve por el libro de movimientos, no escribiendo la columna: el
 * stock lo mantiene un disparador y escribirlo a mano lo dejaría mintiendo.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MARCA = "MUESTRA";

const entorno = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const supabase = createClient(
  entorno.NEXT_PUBLIC_SUPABASE_URL,
  entorno.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// Fotos de la propia sesión, para que la muestra se vea como la tienda de
// verdad y no como un rectángulo de color.
const FOTOS = {
  active: [
    "/fotos/moreda_01.webp",
    "/fotos/moreda_08.webp",
    "/fotos/moreda_13.webp",
    "/fotos/moreda_19.webp",
    "/fotos/m0406-02.webp",
  ],
  swim: [
    "/fotos/swim-1.webp",
    "/fotos/swim-2.webp",
    "/fotos/swim-3.webp",
    "/fotos/swim-look.webp",
  ],
};

const COLORES = ["Negro", "Blanco", "Azul", "Rosado", "Lila", "Marrón"];
const TALLAS = ["XS", "S", "M", "L", "XL"];

async function borrar() {
  const { data: productos } = await supabase
    .from("productos")
    .select("id,nombre")
    .eq("vendedor_externo", MARCA);

  if (!productos?.length) {
    console.log("No hay muestras que borrar.");
    return;
  }

  const ids = productos.map((p) => p.id);

  // El libro de movimientos referencia las variantes, así que va primero.
  const { data: variantes } = await supabase
    .from("variantes")
    .select("id")
    .in("producto_id", ids);

  if (variantes?.length) {
    await supabase
      .from("movimientos_stock")
      .delete()
      .in(
        "variante_id",
        variantes.map((v) => v.id),
      );
  }

  const { error } = await supabase.from("productos").delete().in("id", ids);
  if (error) throw new Error(error.message);

  console.log(`Borradas ${productos.length} prendas de muestra.`);
}

async function crear() {
  const { data: tipos } = await supabase
    .from("tipos_prenda")
    .select("id,nombre,coleccion")
    .eq("activo", true)
    .order("orden");

  if (!tipos?.length) throw new Error("No hay tipos de prenda cargados.");

  let hechas = 0;

  for (const [i, tipo] of tipos.entries()) {
    const fotos = FOTOS[tipo.coleccion];

    const { data: producto, error: falloProducto } = await supabase
      .from("productos")
      .insert({
        coleccion: tipo.coleccion,
        tipo_id: tipo.id,
        nombre: `${tipo.nombre} de muestra`,
        detalle: null,
        vendedor_externo: MARCA,
        activo: true,
      })
      .select("id")
      .single();

    if (falloProducto) {
      console.log(`  ${tipo.nombre}: ${falloProducto.message}`);
      continue;
    }

    // Dos colores por prenda, y que no sean siempre los mismos dos: así el
    // filtro de color tiene de dónde escoger.
    const suyos = [COLORES[i % COLORES.length], COLORES[(i + 2) % COLORES.length]];

    for (const [j, color] of suyos.entries()) {
      const { data: fila } = await supabase
        .from("colores")
        .insert({
          producto_id: producto.id,
          nombre: color,
          foto_url: fotos[(i + j) % fotos.length],
          orden: j,
        })
        .select("id")
        .single();

      // Una talla queda en cero a propósito, para poder ver cómo se comporta
      // "agotado" y el filtro de disponibilidad.
      for (const [k, talla] of TALLAS.entries()) {
        const { data: variante } = await supabase
          .from("variantes")
          .insert({
            producto_id: producto.id,
            color_id: fila.id,
            talla,
            sku: `MUESTRA-${i}-${j}-${k}`,
            precio_usd: 12 + i * 3 + j,
          })
          .select("id")
          .single();

        const cantidad = k === 0 ? 0 : 2 + ((i + k) % 4);
        if (cantidad > 0) {
          await supabase.from("movimientos_stock").insert({
            variante_id: variante.id,
            tipo: "ajuste",
            cantidad,
            costo_unitario_usd: 6 + i,
            referencia_tipo: "manual",
            nota: "Prenda de muestra",
          });
        }
      }
    }

    hechas++;
    console.log(
      `  ${tipo.coleccion.padEnd(6)} ${tipo.nombre.padEnd(22)} ${suyos.join(", ")}`,
    );
  }

  console.log(`\n${hechas} prendas de muestra creadas.`);
  console.log("Para quitarlas: node scripts/muestras.mjs --borrar");
}

if (process.argv.includes("--borrar")) await borrar();
else {
  await borrar(); // sin duplicar si ya se corrió antes
  await crear();
}
