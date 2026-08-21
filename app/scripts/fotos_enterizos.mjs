/**
 * Le pone las fotos buenas a los enterizos.
 *
 *   node scripts/fotos_enterizos.mjs --ensayo <carpeta>
 *   node scripts/fotos_enterizos.mjs <carpeta>
 *   node scripts/fotos_enterizos.mjs --hoja=<destino> --ensayo <carpeta>
 *
 * DE DÓNDE SALE EL EMPAREJAMIENTO
 *
 * Cada carpeta es una prenda y dentro están sus colores, casi siempre con dos
 * fotos de cada uno: el frente y la espalda. Qué carpeta es qué prenda lo dijo
 * Carlos mirándolas una por una. Intentarlo por parecido contra los recortes
 * de 276 píxeles del vídeo no sirve: con media colección de enterizos negros
 * las puntuaciones empataban y un mismo recorte ganaba cuatro veces.
 *
 * CADA FOTO BUSCA SU COLOR, NO AL REVÉS
 *
 * TODAS las fotos de la carpeta entran. Se mira el color dominante de la
 * prenda en cada una, descartando piel y fondo, y se pega al color del
 * inventario más cercano en Lab. No por nombre: un rojo leído como "Burdeos"
 * es el mismo rojo.
 *
 * De las que caen en un mismo color, la primera es la principal y las demás
 * quedan de galería. Así la ficha enseña frente y espalda, que es lo que se
 * espera al mirar ropa.
 *
 * SI NINGUNA SE PARECE, NO SE PONE NINGUNA
 *
 * Las carpetas traen colores que la prenda todavía no tiene registrados. Sin
 * un corte, el reparto acababa poniéndole al rojo una foto verde oliva.
 * Quedarse sin foto se ve y se arregla; una foto equivocada en la tienda no se
 * ve y se vende. Las que sobran se listan al final.
 *
 * SE PUEDE VOLVER A CORRER
 *
 * El nombre en el depósito lleva un resumen del archivo, así que la misma foto
 * siempre cae en la misma ruta y volver a correr esto no deja copias sueltas
 * ni duplica la galería.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, basename } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { colorDominante, masCercano, aLab } from "./color_de_foto.mjs";
import { enRuta } from "./rutas.mjs";

const MARCA = "ACTIVE-WHATSAPP";
const ensayo = process.argv.includes("--ensayo");
const RAIZ = process.argv.find((a) => !a.startsWith("--") && a.includes("Enterizos"));
const HOJA = process.argv.find((a) => a.startsWith("--hoja="))?.slice(7);

/** Cuánto puede alejarse el color de una foto del color al que se le pega. */
const CORTE = 30;

/**
 * Distancia entre dos colores, con el brillo pesando la mitad.
 *
 * En Lab a secas, un azul marino oscuro queda más cerca del negro que del
 * azul, porque manda la diferencia de brillo. Y el brillo es justo lo que
 * cambia con la luz de cada foto. Lo que de verdad identifica una prenda es el
 * tono, así que ese pesa entero y el brillo a mitad.
 */
const separacion = (a, b) =>
  Math.hypot((a[0] - b[0]) * 0.5, a[1] - b[1], a[2] - b[2]);

/** Lo que dijo Carlos: carpeta -> captura del vídeo. */
const PAREJAS = {
  "IMG_7544": "36/0047",
  "IMG_7638": "36/0151",
  "IMG_7647": "36/0015",
  "modelo 1": "36/0004",
  "Modelo 2": "36/0091",
  "modelo 3": "36/0030",
  "modelo 4": "36/0039",
  "modelo 5": "36/0053",
  "modelo 6": "36/0059",
  "modelo 7": "36/0114",
  "modelo 8": "36/0066",
  "modelo 9": "36/0069",
  "modelo 10": "36/0073",
  "modelo 11": "36/0095",
  "modelo 12": "36/0082",
  "modelo 13": "36/0084",
  // "modelo 14": "36/0100"  <- espera a que le carguen los colores. Sus fotos
  // son verde oliva, vino y azul petróleo, y tiene registrados morado, negro y
  // azul: el reparto no tiene a qué agarrarse y le pega el vino al morado.
  "modelo 15": "36/0103",
  "Modelo 17": "36/0005",
  "modelo 19": "36/0107",
  "modelo 20": "36/0111",
  "modelo 21": "36/0077",
  "modelo 22": "36/0089",
  "modelo 24": "36/0124",
  "modelo 25": "36/0128",
  "modelo 26": "36/0137",
  "modelo 27": "36/0140",
  "modelo 28": "36/0143",
  "modelo 29": "36/0147",
};

/**
 * Las que el reparto erraba y se fijan a mano. Aquí solo se dice cuál es la
 * foto PRINCIPAL de ese color; las demás del mismo color caen solas detrás.
 */
const A_MANO = {
  "IMG_7638|Gris": "IMG_7638.JPG",
  "modelo 5|Rojo": "IMG_7545.JPG",
  "modelo 8|Burdeos": "IMG_7569.JPG",
  "modelo 15|Rojo": "IMG_7605.AVIF",
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

const fotosDe = (nombre) => {
  const ruta = join(RAIZ, nombre);
  return statSync(ruta).isDirectory()
    ? readdirSync(ruta).map((f) => join(ruta, f))
    : [ruta];
};

const enDisco = (clave) =>
  readdirSync(RAIZ).find(
    (e) => e === clave || e.replace(/\.[^.]+$/, "") === clave,
  ) ?? null;

/** La misma foto siempre en la misma ruta: así se puede repetir la carga. */
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

const { data: paleta } = await supabase
  .from("colores_catalogo")
  .select("nombre,hex")
  .eq("activo", true);

const sobran = [];
const cuenta = { prendas: 0, principales: 0, galeria: 0, sueltas: 0, fallos: 0 };
let nHoja = 0;

for (const [clave, cuadro] of Object.entries(PAREJAS)) {
  const carpeta = enDisco(clave);
  if (!carpeta) {
    console.log(`  ${clave}: no está en la carpeta`);
    continue;
  }

  const { data: producto } = await supabase
    .from("productos")
    .select("id,nombre,descripcion")
    .eq("vendedor_externo", MARCA)
    .eq("id_externo", cuadro)
    .maybeSingle();

  if (!producto) {
    console.log(`  ${clave}: no encuentro ${cuadro} en el inventario`);
    cuenta.fallos++;
    continue;
  }

  const { data: colores } = await supabase
    .from("colores")
    .select("id,nombre,foto_url")
    .eq("producto_id", producto.id)
    .order("orden");

  // Cada color, con su punto en el espacio de color contra el que medir.
  const dianas = colores.map((c) => {
    const p = paleta.find((x) => x.nombre.toLowerCase() === c.nombre.toLowerCase() && x.hex);
    return { ...c, lab: p ? aLab(p.hex) : null, fotos: [] };
  });

  console.log(`\n${clave}  ->  ${producto.nombre}: ${producto.descripcion}`);
  console.log(`  colores: ${colores.map((c) => c.nombre).join(", ")}`);

  /**
   * Primero se agrupan las fotos, después se reparten los grupos.
   *
   * Las fotos vienen numeradas en orden y las consecutivas son el mismo color:
   * el frente y la espalda de esa prenda. Comparar dos fotos del mismo estudio
   * entre sí acierta mucho más que comparar una foto contra un hex del
   * catálogo, así que primero se corta la carpeta en grupos por color y solo
   * después se decide qué grupo es qué color.
   *
   * Hacerlo al revés, foto por foto, le metía las cuatro fotos en el negro a
   * una prenda que tiene negro y azul.
   */
  const enOrden = fotosDe(carpeta).sort((a, b) => basename(a).localeCompare(basename(b), "es", { numeric: true }));

  const medidas = [];
  for (const foto of enOrden) {
    const rgb = await colorDominante(foto);
    medidas.push({
      foto,
      leido: rgb ? (masCercano(rgb, paleta)?.nombre ?? "?") : "?",
      lab: rgb
        ? aLab("#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""))
        : null,
    });
  }

  const grupos = [];
  for (const m of medidas) {
    const ult = grupos[grupos.length - 1];
    const previa = ult?.[ult.length - 1];
    if (previa?.lab && m.lab && separacion(m.lab, previa.lab) < 18) ult.push(m);
    else grupos.push([m]);
  }

  // Cada grupo pide el color al que más se parezca, y el que más se parece se
  // lo lleva: así dos grupos no pelean por el mismo.
  const aspirantes = [];
  for (const g of grupos) {
    const lab = g.find((m) => m.lab)?.lab ?? null;
    for (const d of dianas) {
      aspirantes.push({
        g, d,
        punto: lab && d.lab ? separacion(lab, d.lab) : d.lab ? 999 : 500,
      });
    }
  }
  aspirantes.sort((a, b) => a.punto - b.punto);

  const huerfanas = [];
  const tomados = new Set();
  const repartidos = new Set();
  for (const { g, d, punto } of aspirantes) {
    if (tomados.has(g) || repartidos.has(d) || punto > CORTE) continue;
    tomados.add(g);
    repartidos.add(d);
    d.fotos.push(...g.map((m) => ({ ...m, cerca: punto })));
  }

  // Un color que se quedó sin nada se lleva el grupo suelto más parecido: pasa
  // cuando el color del catálogo no está donde la prenda, como el enterizo
  // azul petróleo registrado como "Turquesa".
  for (const d of dianas) {
    if (d.fotos.length > 0) continue;
    const libres = grupos.filter((g) => !tomados.has(g));
    if (!libres.length) continue;
    const mejor = d.lab
      ? libres
          .map((g) => ({ g, p: g.find((m) => m.lab) ? separacion(g.find((m) => m.lab).lab, d.lab) : 999 }))
          .sort((a, b) => a.p - b.p)[0].g
      : libres[0];
    tomados.add(mejor);
    d.fotos.push(...mejor.map((m) => ({ ...m, cerca: null, rescatada: true })));
  }

  for (const g of grupos) if (!tomados.has(g)) huerfanas.push(...g);

  /**
   * Lo fijado a mano manda sobre todo el reparto.
   *
   * No solo dice cuál es la principal: saca la foto de donde el reparto la
   * hubiera puesto y la lleva a su color. Antes solo reordenaba dentro de un
   * color, y el leopardo gris se quedaba en Marrón por más que estuviera
   * anotado.
   */
  for (const [k, archivo] of Object.entries(A_MANO)) {
    if (!k.startsWith(`${clave}|`)) continue;
    const color = k.split("|")[1];
    const d = dianas.find((x) => x.nombre === color);
    if (!d) continue;

    let foto = null;
    for (const otra of dianas) {
      const i = otra.fotos.findIndex((f) => basename(f.foto) === archivo);
      if (i >= 0) foto = otra.fotos.splice(i, 1)[0];
    }
    const j = huerfanas.findIndex((f) => basename(f.foto) === archivo);
    if (j >= 0) foto = huerfanas.splice(j, 1)[0];

    if (foto) d.fotos.unshift({ ...foto, fijada: true });
  }

  for (const d of dianas) {
    if (d.fotos.length === 0) {
      console.log(`    ${d.nombre.padEnd(14)} sin foto de ese color`);
      continue;
    }
    console.log(
      `    ${d.nombre.padEnd(14)} ${d.fotos.length} foto(s): ${d.fotos.map((f) => basename(f.foto)).join(", ")}`,
    );

    if (HOJA) {
      for (const f of d.fotos) {
        nHoja++;
        await sharp(f.foto, { failOn: "none" })
          .rotate().resize(250, 334, { fit: "cover" }).jpeg({ quality: 80 })
          .toFile(`${HOJA}/${String(nHoja).padStart(2, "0")}_${clave.replace(/[^a-zA-Z0-9]+/g, "-")}_${d.nombre.replace(/[^a-zA-Z0-9]+/g, "-")}.jpg`);
      }
    }

    if (ensayo) {
      cuenta.principales++;
      cuenta.galeria += d.fotos.length - 1;
      continue;
    }

    try {
      const urls = [];
      for (const f of d.fotos) urls.push(await subir(producto.id, d.nombre, f.foto));

      const { error: e1 } = await supabase
        .from("colores")
        .update({ foto_url: urls[0] })
        .eq("id", d.id);
      if (e1) throw new Error(e1.message);
      cuenta.principales++;

      // La galería se rehace entera: si se vuelve a correr con más fotos, la
      // de antes no se queda a medias.
      await supabase.from("fotos_color").delete().eq("color_id", d.id);
      if (urls.length > 1) {
        const filas = urls.slice(1).map((url, i) => ({ color_id: d.id, url, orden: i + 1 }));
        const { error: e2 } = await supabase.from("fotos_color").insert(filas);
        if (e2) throw new Error(e2.message);
        cuenta.galeria += filas.length;
      }
    } catch (e) {
      console.log(`      FALLÓ: ${e.message}`);
      cuenta.fallos++;
    }
  }

  if (huerfanas.length) {
    sobran.push({ clave, producto: producto.descripcion, fotos: huerfanas });
    cuenta.sueltas += huerfanas.length;
  }
  cuenta.prendas++;
}

console.log("\n" + (ensayo ? "ENSAYO, no se subió nada" : "Listo"));
console.log(`  prendas     ${cuenta.prendas}`);
console.log(`  principales ${cuenta.principales}`);
console.log(`  de galería  ${cuenta.galeria}`);
if (cuenta.fallos) console.log(`  fallos      ${cuenta.fallos}`);

if (sobran.length) {
  console.log(`\nSIN COLOCAR (${cuenta.sueltas}): son de colores que la prenda todavía no tiene.`);
  console.log("No se inventan. En cuanto el color exista en el panel, vuelve a correr esto.\n");
  for (const s of sobran) {
    console.log(`  ${s.clave} (${s.producto})`);
    for (const f of s.fotos) console.log(`      ${basename(f.foto).padEnd(16)} parece ${f.leido}`);
  }
}
