/**
 * Mete el catálogo de Mored Active en el inventario.
 *
 *   node scripts/importar_active.mjs --ensayo    enseña lo que haría
 *   node scripts/importar_active.mjs             lo hace
 *   node scripts/importar_active.mjs --borrar    lo deshace
 *
 * DE DÓNDE SALE
 *
 * Active no tiene tienda en Treinta: su catálogo vive en WhatsApp Business y
 * llegó en cuatro vídeos de alguien pasando capturas. De cada captura se leen
 * el nombre de SHEIN, la familia y los dos precios, y de la propia imagen se
 * recorta la foto. Todo eso está transcrito en datos/active/*.json, que es lo
 * que lee este programa: los vídeos ya no hacen falta.
 *
 * LOS DOS PRECIOS
 *
 * "precio especial 14$" es el precio en divisas y "Ref 15€" el precio para
 * pago en bolívares. Los dos se guardan en euros, que es como los maneja el
 * resto del sistema; el de bolívares se multiplica por la tasa del día al
 * enseñarlo. El símbolo de dólar que escriben ellas es una costumbre, no una
 * moneda: la tasa de venta siempre ha sido la del euro.
 *
 * EL NOMBRE JUNTA, LA DESCRIPCIÓN SEPARA
 *
 * Igual que en Swim. El nombre es la familia (Conjunto, Enterizo, Leggin...) y
 * lo que distingue una prenda de otra es la descripción, que sale del texto de
 * SHEIN. Dos prendas con nombre y descripción iguales son la misma prenda en
 * otro color y la tienda las junta sola en una tarjeta.
 *
 * LO QUE ENTRA A MEDIAS
 *
 * El stock. Nadie contó las prendas: cuando el texto nombra una talla, entra
 * una. Es la misma regla que se aplicó en Swim y hay que repasarla en el panel.
 *
 * El costo, que no aparece por ningún lado. El "Ref" no sirve: es el precio en
 * bolívares, no lo que les costó. Entran con costo cero, así que hasta que se
 * cargue el real el margen que muestre Finanzas va a estar inflado.
 *
 * Los seis accesorios deportivos entran sin foto: en el vídeo salen ampliados
 * y no hay imagen que recortar.
 */

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MARCA = "ACTIVE-WHATSAPP";
const ensayo = process.argv.includes("--ensayo");
const borrando = process.argv.includes("--borrar");

const RECORTES = process.argv.find((a) => a.startsWith("--fotos="))?.slice(8);

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
// VOCABULARIO
// ---------------------------------------------------------------------------

/**
 * Lo que ellas escriben arriba de cada captura, y la familia que le toca.
 *
 * Escriben con soltura: "jacket" y "chaqueta" son lo mismo, "licra" y "leggins"
 * también, y "musera", "flare" o "dupe dfyne" son apellidos del modelo, no
 * familias aparte. Se normaliza aquí para que la tienda tenga una lista corta
 * por la que filtrar.
 */
const FAMILIAS = [
  [/^(bandanas?|calentadores?|fajas?|guantes?)/i, "Accesorios deportivos"],
  [/^(conjunto|set)/i, "Conjunto"],
  [/^enterizos?/i, "Enterizo"],
  [/^vestido/i, "Vestido"],
  [/^(falda|faldas)/i, "Falda"],
  [/^shorts?/i, "Short"],
  [/^(licras?|leggins?|leggings?)/i, "Leggin"],
  [/^(jacket|chaqueta)/i, "Chaqueta"],
  [/^sudadera/i, "Sudadera"],
  [/^su[eé]ter/i, "Suéter"],
  [/^(oversize|oversive|franelas?|camisa de compresi[oó]n)/i, "Franela"],
  [/^tops?/i, "Top"],
];

/** El orden en que se enseñan en el panel. Lo de arriba es lo que más venden. */
const ORDEN = {
  Conjunto: 10, Enterizo: 20, Top: 30, Leggin: 40, Short: 50,
  Suéter: 60, Chaqueta: 70, Sudadera: 80, Franela: 85,
  Falda: 88, Vestido: 89, "Accesorios deportivos": 90,
};

/**
 * Los colores de la tienda tienen su muestra redonda con un hex, así que hay
 * que hablar su idioma. Lo que ellas llaman "vinotinto" es el Burdeos del
 * catálogo, y "azul bebé" el Celeste.
 *
 * Las prendas de dos tonos se guardan por el color que manda: el contraste ya
 * lo cuenta la descripción, y una muestra redonda no sabe enseñar dos colores.
 */
const COLORES = {
  "Vino": "Burdeos", "Vinotinto": "Burdeos",
  "Azul bebé": "Celeste", "Azul acero": "Azul marino", "Azul rey": "Azul",
  "Azul petróleo": "Turquesa",
  "Verde menta": "Menta", "Verde neón": "Verde limón", "Verde tie dye": "Verde",
  "Crema": "Beige", "Rosa": "Rosado",
  "Multicolor pasteles": "Multicolor",
  "Gris y negro": "Gris",
  "Negro y blanco": "Negro", "Negro y verde": "Negro", "Negro y rojo": "Negro",
  "Azul marino y blanco": "Azul marino", "Azul marino y rojo": "Azul marino",
  "Blanco y rosa": "Blanco", "Blanco y negro": "Blanco",
};

/** Colores que la tienda todavía no conoce y hay que abrirle. */
const NUEVOS = [
  { nombre: "Azul marino", hex: "#22355e", orden: 1069 },
  { nombre: "Verde limón", hex: "#b7d94c", orden: 1079 },
];

// ---------------------------------------------------------------------------
// DESCRIPCIÓN
// ---------------------------------------------------------------------------

/** Palabras que no se escriben en minúscula aunque caigan en medio. */
const PROPIOS = ["Y2K", "Sport", "Black Edition", "Co-Ord", "Dfyne", "MSGD"];

/** Lo que hay que quitarle al principio para que no repita la familia. */
const REPITE = {
  Conjunto: /^conjuntos?\s+/i,
  Enterizo: /^enterizos?:?\s+/i,
  Short: /^shorts?\s+/i,
  Leggin: /^leggings?\s+/i,
  Chaqueta: /^chaquetas?\s+/i,
  Falda: /^faldas?\s+/i,
  Vestido: /^vestidos?\s+/i,
  Top: /^tops?\s+/i,
};

/**
 * Palabras que hacen prenda aparte con la de la familia.
 *
 * "Falda pantalón" no es una falda descrita como pantalón: es una prenda con
 * su propio nombre, y quitarle el "falda" la deja convertida en otra cosa.
 */
const PEGADAS = /^(pantal[oó]n|pantalones|short|shorts)\b/i;

/**
 * La descripción tal como se va a leer debajo del nombre.
 *
 * SHEIN escribe en título ("Conjunto Deportivo 2 Piezas Color-Block") y arranca
 * casi siempre nombrando el tipo. Puesto debajo del nombre queda "Conjunto ·
 * Conjunto deportivo...", así que la primera palabra se cae si es la familia, y
 * el resto pasa a minúscula, que es como está escrito el resto de la tienda.
 */
function limpiarDesc(texto, familia) {
  let t = texto.replace(/^set:?\s+/i, "").trim();
  const repite = REPITE[familia];
  if (repite) {
    const corto = t.replace(repite, "").trim();
    if (!PEGADAS.test(corto)) t = corto;
  }
  if (!t) t = texto.trim();

  t = t.toLowerCase();
  t = t.charAt(0).toUpperCase() + t.slice(1);

  // Una "v" suelta es el escote, no una letra perdida.
  t = t.replace(/\ben v\b/g, "en V").replace(/\bde v\b/g, "de V");
  for (const p of PROPIOS) {
    t = t.replace(new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), p);
  }
  return t;
}

function familiaDe(rotulo) {
  const hallada = FAMILIAS.find(([re]) => re.test(rotulo));
  if (!hallada) throw new Error(`no sé qué familia es "${rotulo}"`);
  return hallada[1];
}

const colorDe = (c) => COLORES[c] ?? c;

// ---------------------------------------------------------------------------

function leerTodo() {
  const prendas = [];
  for (const v of [35, 36, 48, 55]) {
    const j = JSON.parse(
      readFileSync(new URL(`./datos/active/${v}.json`, import.meta.url), "utf8"),
    );
    for (const p of j.prendas) prendas.push({ ...p, video: v });
  }
  return prendas;
}

async function borrar() {
  const { data: productos } = await supabase
    .from("productos")
    .select("id")
    .eq("vendedor_externo", MARCA);

  if (!productos?.length) {
    console.log("No hay nada importado de Active.");
    return;
  }
  const ids = productos.map((p) => p.id);

  const { data: variantes } = await supabase
    .from("variantes")
    .select("id")
    .in("producto_id", ids);

  if (variantes?.length) {
    // El libro de movimientos apunta a las variantes con on delete restrict.
    await supabase
      .from("movimientos_stock")
      .delete()
      .in("variante_id", variantes.map((v) => v.id));
  }

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
  console.log(`Borrados ${ids.length} productos de Active.`);
}

/** El depósito no acepta acentos, espacios ni porcentajes en la ruta. */
const enRuta = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "color";

async function subirFoto(productoId, color, archivo) {
  const datos = readFileSync(archivo);
  const ruta = `${productoId}/${enRuta(color)}-video.jpg`;
  const { error } = await supabase.storage.from("fotos").upload(ruta, datos, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from("fotos").getPublicUrl(ruta).data.publicUrl;
}

async function importar() {
  const prendas = leerTodo();

  // Repaso antes de tocar nada: si algo no se entiende, mejor saberlo ahora.
  const familias = new Map();
  for (const p of prendas) familias.set(p.cuadro, familiaDe(p.rotulo));

  if (ensayo) {
    console.log(`${prendas.length} prendas\n`);
    for (const p of prendas) {
      const f = familias.get(p.cuadro);
      const cols = p.colores
        .map((c) => `${colorDe(c.color)} ${c.tallas.join("/")}`)
        .join(", ");
      console.log(
        `${p.cuadro}  ${f.padEnd(21)} ${String(p.eur).padStart(4)}€ ${String(p.bs).padStart(4)}€  ${cols}`,
      );
      console.log(`            ${limpiarDesc(p.desc, f)}`);
    }
    const cuenta = {};
    for (const f of familias.values()) cuenta[f] = (cuenta[f] ?? 0) + 1;
    console.log("\nPor familia:");
    for (const [f, n] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(3)}  ${f}`);
    }
    const usados = new Set(prendas.flatMap((p) => p.colores.map((c) => colorDe(c.color))));
    console.log("\nColores usados:", [...usados].sort().join(", "));
    return;
  }

  // Colores que la tienda todavía no tiene.
  const { data: paleta } = await supabase.from("colores_catalogo").select("nombre");
  const conocidos = new Set((paleta ?? []).map((c) => c.nombre));
  for (const c of NUEVOS) {
    if (!conocidos.has(c.nombre)) {
      const { error } = await supabase.from("colores_catalogo").insert(c);
      if (error) throw new Error(`color ${c.nombre}: ${error.message}`);
      console.log(`  (color nuevo: ${c.nombre})`);
    }
  }

  // Tipos de prenda de Active, abriendo los que falten.
  const { data: filas } = await supabase
    .from("tipos_prenda")
    .select("id,nombre,orden")
    .eq("coleccion", "active");
  const tipos = new Map(filas.map((t) => [t.nombre.toLowerCase(), t.id]));

  async function tipoId(nombre) {
    const clave = nombre.toLowerCase();
    if (tipos.has(clave)) return tipos.get(clave);
    const { data, error } = await supabase
      .from("tipos_prenda")
      .insert({ coleccion: "active", nombre, orden: ORDEN[nombre] ?? 95 })
      .select("id")
      .single();
    if (error) throw new Error(`tipo ${nombre}: ${error.message}`);
    tipos.set(clave, data.id);
    console.log(`  (tipo nuevo: ${nombre})`);
    return data.id;
  }

  const { data: previos } = await supabase
    .from("productos")
    .select("id_externo")
    .eq("vendedor_externo", MARCA);
  const yaEstan = new Set((previos ?? []).map((p) => p.id_externo));

  const cuenta = { creados: 0, saltados: 0, fallos: 0, colores: 0, variantes: 0, sinFoto: 0 };

  for (const p of prendas) {
    if (yaEstan.has(p.cuadro)) { cuenta.saltados++; continue; }
    const familia = familias.get(p.cuadro);

    try {
      const { data: producto, error: falloProducto } = await supabase
        .from("productos")
        .insert({
          coleccion: "active",
          tipo_id: await tipoId(familia),
          nombre: familia,
          descripcion: limpiarDesc(p.desc, familia),
          vendedor_externo: MARCA,
          id_externo: p.cuadro,
          activo: true,
        })
        .select("id")
        .single();
      if (falloProducto) throw new Error(falloProducto.message);

      // La foto va en el primer color. Los demás la heredan: la base ya sabe
      // que un color sin foto propia toma la primera del producto.
      const [v, n] = p.cuadro.split("/");
      const archivo = RECORTES && `${RECORTES}/${v}/${n}.jpg`;
      let foto = null;
      if (archivo && existsSync(archivo)) {
        try {
          foto = await subirFoto(producto.id, p.colores[0].color, archivo);
        } catch (e) {
          console.log(`  ${p.cuadro}: foto no subida (${e.message})`);
        }
      }
      if (!foto) cuenta.sinFoto++;

      let i = 0;
      for (const c of p.colores) {
        i++;
        const { data: fila, error: falloColor } = await supabase
          .from("colores")
          .insert({
            producto_id: producto.id,
            nombre: colorDe(c.color),
            foto_url: i === 1 ? foto : null,
          })
          .select("id")
          .single();
        if (falloColor) throw new Error(falloColor.message);
        cuenta.colores++;

        for (const talla of c.tallas) {
          const { data: variante, error: falloVariante } = await supabase
            .from("variantes")
            .insert({
              producto_id: producto.id,
              color_id: fila.id,
              talla,
              sku: `AC-${v}${n}-${i}-${talla}`,
              precio_usd: p.eur,
              precio_bs: p.bs,
            })
            .select("id")
            .single();
          if (falloVariante) throw new Error(falloVariante.message);
          cuenta.variantes++;

          // Nadie contó las prendas: el texto nombra la talla, así que entra
          // una. El stock se mueve por el libro, no escribiendo la columna.
          const { error: falloMov } = await supabase
            .from("movimientos_stock")
            .insert({
              variante_id: variante.id,
              tipo: "ajuste",
              cantidad: 1,
              referencia_tipo: "manual",
              nota: `Catálogo de Active, captura ${p.cuadro}`,
            });
          if (falloMov) throw new Error(falloMov.message);
        }
      }

      cuenta.creados++;
    } catch (e) {
      cuenta.fallos++;
      console.log(`  FALLÓ ${p.cuadro}: ${e.message}`);
    }
  }

  console.log("");
  console.log(`  productos     ${cuenta.creados}`);
  console.log(`  colores       ${cuenta.colores}`);
  console.log(`  variantes     ${cuenta.variantes}`);
  if (cuenta.sinFoto) console.log(`  sin foto      ${cuenta.sinFoto}   (no salen en la tienda)`);
  if (cuenta.saltados) console.log(`  ya estaban    ${cuenta.saltados}`);
  if (cuenta.fallos) console.log(`  fallaron      ${cuenta.fallos}`);
}

await (borrando ? borrar() : importar());
