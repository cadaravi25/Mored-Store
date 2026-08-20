/**
 * Mete el catálogo de Treinta en el inventario.
 *
 *   node scripts/treinta.mjs             primero: baja el catálogo
 *   node scripts/importar_treinta.mjs    después: lo importa
 *   node scripts/importar_treinta.mjs --borrar   deshace la importación
 *
 * QUÉ ENTRA COMPLETO Y QUÉ ENTRA A MEDIAS
 *
 * Treinta guarda un solo número de stock por producto y las tallas dentro del
 * texto de la descripción. Cuando la descripción nombra una sola talla, no hay
 * ambigüedad y la prenda entra terminada. Cuando nombra varias ("talla S y M"
 * con stock 2) no se sabe cuántas de cada una, y eso no lo adivina nadie: esa
 * prenda entra con la talla POR DEFINIR y se completa contándola en el panel.
 *
 * Los accesorios (lentes, sombreros, bolsos) entran con talla ÚNICA, que no es
 * lo mismo: esos ya están terminados y nunca van a tener talla.
 *
 * LAS FOTOS SE COPIAN, NO SE ENLAZAN
 *
 * Apuntar a la foto que está en el servidor de Treinta funciona hoy y se rompe
 * el día que ellas cierren esa cuenta o Treinta mueva sus archivos, y la
 * tienda queda llena de cuadros rotos. Se bajan y se suben al depósito propio,
 * que es la misma decisión que ya estaba tomada para las fotos del panel.
 *
 * LO QUE ESTE PROGRAMA NO SABE
 *
 * El costo. Treinta no lo publica: el "Ref 22€" de las descripciones es el
 * precio de referencia del proveedor, no lo que les costó. Las prendas entran
 * con costo cero, así que hasta que se cargue el costo real el margen que
 * muestre Finanzas para estas prendas va a estar inflado.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MARCA = "TREINTA";
const SIN_DEFINIR = "POR DEFINIR";
const SIN_TALLA = "ÚNICA";
const COLOR_PENDIENTE = "Por definir";

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

// ---------------------------------------------------------------------------
// LECTURA DEL NOMBRE
// ---------------------------------------------------------------------------

/**
 * El tipo sale del nombre, que es lo único que Treinta llena con criterio.
 * El orden importa: "Traje de baño" tiene que probarse antes que "Top", y
 * "Bañador" antes que cualquier regla suelta.
 */
const TIPOS = [
  [/^ba[ñn]ador/i, "Bañador"],
  [/^bikini/i, "Bikini"],
  [/^traje de ba[ñn]o|^trikini/i, "Traje de baño"],
  [/^vestido/i, "Vestido playero"],
  [/^(set|conjunto)\b/i, "Salida de baño"],
  [/^(pareo|malla playera|falda playera|pa[ñn]oleta)/i, "Salida de baño"],
  [/^top\b/i, "Top playero"],
  [/^(lentes|sombrero|bolso|pulsera|diadema|gancho|hawu|accesorio)/i, "Accesorios"],
];

/** Los accesorios no llevan talla. No es que no se sepa: es que no aplica. */
const SIN_TALLAS = new Set(["Accesorios"]);

/**
 * Colores que la tienda ya conoce. La clave es como lo escriben ellas en
 * Treinta; el valor, el nombre del catálogo de colores, para que la muestra
 * redonda de la tienda encuentre su hex.
 */
const COLORES = [
  ["vino tinto", "Burdeos"], ["vinotinto", "Burdeos"], ["burdeos", "Burdeos"],
  ["animal print", "Animal print"], ["multicolor", "Multicolor"],
  ["negro", "Negro"], ["blanco", "Blanco"], ["gris", "Gris"],
  ["beige", "Beige"], ["crema", "Crema"], ["marr[oó]n", "Marrón"],
  ["rosado", "Rosado"], ["rosa", "Rosado"], ["fucsia", "Fucsia"],
  ["rojo", "Rojo"], ["naranja", "Naranja"], ["amarillo", "Amarillo"],
  ["verde", "Verde"], ["celeste", "Azul"], ["azul", "Azul"],
  ["morado", "Morado"], ["lila", "Lila"], ["dorado", "Dorado"],
  ["carey", "Carey"],
];

const TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];

/** Quita el "Ref 24€", que trae números y letras que confunden a todo lo demás. */
const sinReferencia = (t) => (t || "").replace(/ref\s*[\d.,]+\s*€?/gi, " ");

function leerTipo(nombre) {
  const encontrado = TIPOS.find(([re]) => re.test(nombre));
  return encontrado ? encontrado[1] : "Accesorios";
}

/**
 * El color que aparezca ANTES en el texto, no el primero de la lista.
 * "Bikini azul y marrón" es un bikini azul: el nombre empieza por el color que
 * manda, y quedarse con el segundo sería quedarse con el detalle.
 */
function leerColor(nombre, descripcion) {
  const texto = sinReferencia(`${nombre} ${descripcion || ""}`).toLowerCase();
  let mejor = null;
  let donde = Infinity;
  for (const [patron, limpio] of COLORES) {
    const m = texto.match(new RegExp(`\\b${patron}\\b`));
    if (m && m.index < donde) {
      donde = m.index;
      mejor = limpio;
    }
  }
  return mejor;
}

/**
 * Las tallas que nombra la descripción, sin repetir.
 *
 * Va sobre la descripción y no sobre el nombre a propósito: en el nombre, una
 * "S" o una "M" suelta casi siempre es parte de una palabra, no una talla.
 */
function leerTallas(descripcion) {
  const texto = sinReferencia(descripcion).toUpperCase();
  const halladas = texto.match(/\b(XXL|XL|XS|S|M|L)\b/g) || [];
  return [...new Set(halladas)].sort(
    (a, b) => TALLAS.indexOf(a) - TALLAS.indexOf(b),
  );
}

// ---------------------------------------------------------------------------

async function borrar() {
  const { data: productos } = await supabase
    .from("productos")
    .select("id")
    .eq("vendedor_externo", MARCA);

  if (!productos?.length) {
    console.log("No hay nada importado de Treinta.");
    return;
  }

  const ids = productos.map((p) => p.id);

  // El libro de movimientos apunta a las variantes con on delete restrict, así
  // que va primero o la base no deja borrar nada.
  const { data: variantes } = await supabase
    .from("variantes")
    .select("id")
    .in("producto_id", ids);

  if (variantes?.length) {
    await supabase
      .from("movimientos_stock")
      .delete()
      .in("variante_id", variantes.map((v) => v.id));
  }

  // Las fotos viven en una carpeta por producto.
  for (const id of ids) {
    const { data: archivos } = await supabase.storage.from("fotos").list(id);
    if (archivos?.length) {
      await supabase.storage
        .from("fotos")
        .remove(archivos.map((a) => `${id}/${a.name}`));
    }
  }

  const { error } = await supabase.from("productos").delete().in("id", ids);
  if (error) throw new Error(error.message);

  console.log(`Borrados ${ids.length} productos importados de Treinta.`);
}

/**
 * Nombre de archivo a partir del color.
 *
 * El depósito no acepta acentos ni espacios en la ruta, así que "Marrón" no
 * puede ir tal cual y escaparlo tampoco sirve: el signo de porcentaje también
 * lo rechaza. Se le quitan los acentos y lo que no sea letra o número.
 */
const enRuta = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "color";

/** Si la foto que ya está guardada se puede pedir de verdad. */
async function cargaBien(url) {
  try {
    const r = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(30000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Copia la foto al depósito propio y devuelve su dirección pública. */
async function copiarFoto(productoId, color, origen) {
  const r = await fetch(origen, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`la foto respondió ${r.status}`);

  const datos = Buffer.from(await r.arrayBuffer());
  const ruta = `${productoId}/${enRuta(color)}-treinta.jpg`;

  const { error } = await supabase.storage
    .from("fotos")
    .upload(ruta, datos, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: true,
    });
  if (error) throw new Error(error.message);

  return supabase.storage.from("fotos").getPublicUrl(ruta).data.publicUrl;
}

async function importar() {
  const catalogo = JSON.parse(
    readFileSync(new URL("./datos/treinta.json", import.meta.url), "utf8"),
  );

  // Los tipos que ya existen, y los que haya que abrir sobre la marcha.
  const { data: filas } = await supabase
    .from("tipos_prenda")
    .select("id,nombre,orden")
    .eq("coleccion", "swim");

  const tipos = new Map(filas.map((t) => [t.nombre.toLowerCase(), t.id]));

  async function tipoId(nombre) {
    const clave = nombre.toLowerCase();
    if (tipos.has(clave)) return tipos.get(clave);

    const orden = Math.max(0, ...filas.map((t) => t.orden)) + 10;
    const { data, error } = await supabase
      .from("tipos_prenda")
      .insert({ coleccion: "swim", nombre, orden })
      .select("id")
      .single();
    if (error) throw new Error(`tipo ${nombre}: ${error.message}`);

    tipos.set(clave, data.id);
    console.log(`  (tipo nuevo: ${nombre})`);
    return data.id;
  }

  // Lo ya importado, para poder correr esto dos veces sin duplicar.
  const { data: previos } = await supabase
    .from("productos")
    .select("id_externo")
    .eq("vendedor_externo", MARCA);
  const yaEstan = new Set((previos ?? []).map((p) => p.id_externo));

  const cuenta = {
    creados: 0, saltados: 0, completos: 0, pendientes: 0,
    sinTalla: 0, sinColor: 0, fallos: 0,
  };

  for (const p of catalogo) {
    // Esto no es un producto: es el aviso de que no aceptan devoluciones.
    // Su sitio es el pie de la tienda, no el inventario.
    if (/^importante leer/i.test(p.nombre)) continue;

    if (yaEstan.has(p.id)) { cuenta.saltados++; continue; }

    const tipo = leerTipo(p.nombre);
    const color = leerColor(p.nombre, p.descripcion) ?? COLOR_PENDIENTE;
    const leidas = SIN_TALLAS.has(tipo) ? [] : leerTallas(p.descripcion);

    // Una sola talla nombrada: todo el stock es de esa talla y no hay dudas.
    // Varias: no se sabe el reparto y queda para contar en el panel.
    const tallas =
      leidas.length === 1 ? leidas
      : leidas.length === 0 ? [SIN_TALLA]
      : [SIN_DEFINIR];

    if (color === COLOR_PENDIENTE) cuenta.sinColor++;
    if (tallas[0] === SIN_DEFINIR) cuenta.pendientes++;
    else if (tallas[0] === SIN_TALLA) cuenta.sinTalla++;
    else cuenta.completos++;

    try {
      const { data: producto, error: falloProducto } = await supabase
        .from("productos")
        .insert({
          coleccion: "swim",
          tipo_id: await tipoId(tipo),
          nombre: p.nombre.trim(),
          // La descripción de Treinta es la nota de trabajo de ellas: dice la
          // referencia del proveedor y las tallas. Se conserva tal cual, que
          // es lo que van a mirar al completar la prenda.
          descripcion: p.descripcion,
          vendedor_externo: MARCA,
          id_externo: p.id,
          activo: true,
        })
        .select("id")
        .single();

      if (falloProducto) throw new Error(falloProducto.message);

      let foto = null;
      if (p.foto_url) {
        try {
          foto = await copiarFoto(producto.id, color, p.foto_url);
        } catch (e) {
          console.log(`  ${p.nombre}: foto no copiada (${e.message})`);
        }
      }

      const { data: fila, error: falloColor } = await supabase
        .from("colores")
        .insert({ producto_id: producto.id, nombre: color, foto_url: foto })
        .select("id")
        .single();
      if (falloColor) throw new Error(falloColor.message);

      for (const talla of tallas) {
        const { data: variante, error: falloVariante } = await supabase
          .from("variantes")
          .insert({
            producto_id: producto.id,
            color_id: fila.id,
            talla,
            sku: `TR-${p.id.replace(/-/g, "").slice(0, 12)}-${talla.replace(/\s+/g, "")}`,
            precio_usd: p.precio_usd ?? 0,
          })
          .select("id")
          .single();
        if (falloVariante) throw new Error(falloVariante.message);

        // El stock se mueve por el libro; la columna la mantiene el disparador.
        // Sin costo: Treinta no lo publica y no vale la pena inventarlo.
        if (p.stock > 0) {
          const { error: falloMov } = await supabase
            .from("movimientos_stock")
            .insert({
              variante_id: variante.id,
              tipo: "ajuste",
              cantidad: p.stock,
              referencia_tipo: "manual",
              nota: "Importado del catálogo de Treinta",
            });
          if (falloMov) throw new Error(falloMov.message);
        }
      }

      cuenta.creados++;
    } catch (e) {
      cuenta.fallos++;
      console.log(`  FALLÓ ${p.nombre}: ${e.message}`);
    }
  }

  console.log("");
  console.log(`  importados          ${cuenta.creados}`);
  if (cuenta.saltados) console.log(`  ya estaban          ${cuenta.saltados}`);
  if (cuenta.fallos) console.log(`  fallaron            ${cuenta.fallos}`);
  console.log("");
  console.log(`  con talla puesta    ${cuenta.completos}`);
  console.log(`  talla única         ${cuenta.sinTalla}   (accesorios, ya están listos)`);
  console.log(`  POR DEFINIR         ${cuenta.pendientes}   (hay que contarlos en el panel)`);
  console.log(`  sin color           ${cuenta.sinColor}`);
}

/**
 * Vuelve a copiar las fotos que faltan o que no cargan.
 *
 * Sin foto, la prenda no sale en la tienda, así que una foto que falló no es
 * un detalle: es una prenda que no se vende.
 *
 * No basta con mirar si la columna tiene una dirección: puede tenerla y estar
 * rota. La primera versión de este programa metía el color en la ruta escapado
 * con porcentajes, y el depósito guardaba el archivo pero después devolvía 400
 * al pedirlo. Se comprueba pidiéndolas de verdad.
 */
async function reintentarFotos() {
  const catalogo = JSON.parse(
    readFileSync(new URL("./datos/treinta.json", import.meta.url), "utf8"),
  );
  const porId = new Map(catalogo.map((p) => [p.id, p]));

  const { data: productos } = await supabase
    .from("productos")
    .select("id, id_externo, nombre, colores(id, nombre, foto_url)")
    .eq("vendedor_externo", MARCA);

  let arregladas = 0;
  let fallos = 0;

  for (const p of productos ?? []) {
    for (const c of p.colores ?? []) {
      if (c.foto_url && (await cargaBien(c.foto_url))) continue;

      const origen = porId.get(p.id_externo)?.foto_url;
      if (!origen) continue;

      try {
        const url = await copiarFoto(p.id, c.nombre, origen);
        const { error } = await supabase
          .from("colores")
          .update({ foto_url: url })
          .eq("id", c.id);
        if (error) throw new Error(error.message);
        arregladas++;
      } catch (e) {
        fallos++;
        console.log(`  ${p.nombre}: ${e.message}`);
      }
    }
  }

  console.log(`Fotos recuperadas: ${arregladas}${fallos ? `, fallaron ${fallos}` : ""}`);
}

if (process.argv.includes("--borrar")) await borrar();
else if (process.argv.includes("--fotos")) await reintentarFotos();
else await importar();
