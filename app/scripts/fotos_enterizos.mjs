/**
 * Le pone las fotos buenas a los enterizos.
 *
 *   node scripts/fotos_enterizos.mjs --ensayo <carpeta>
 *   node scripts/fotos_enterizos.mjs <carpeta>
 *
 * DE DÓNDE SALE EL EMPAREJAMIENTO
 *
 * Cada carpeta de Carlos es una prenda y dentro están sus colores, a veces con
 * dos fotos del mismo (frente y espalda). Qué carpeta es qué prenda lo dijo él
 * mirándolas: intentarlo por parecido contra los recortes de 276 píxeles del
 * vídeo daba empates entre enterizos negros y ya se coló un error así.
 *
 * QUÉ COLOR ES CADA FOTO
 *
 * Eso sí se calcula, con el color dominante de la prenda en la foto. Pero solo
 * se usa para repartir entre los colores QUE YA EXISTEN en el inventario. Si
 * una carpeta trae colores que la prenda no tiene registrados, no se inventan:
 * se listan al final para preguntar si de verdad los tienen.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { colorDominante, masCercano, aLab } from "./color_de_foto.mjs";
import { rutaDeFoto } from "./rutas.mjs";

const MARCA = "ACTIVE-WHATSAPP";
const ensayo = process.argv.includes("--ensayo");
const RAIZ = process.argv.find((a) => !a.startsWith("--") && a.includes("Enterizos"));
/** Con --hoja=<carpeta> escribe la foto elegida de cada color para poder
 *  revisarlas de un vistazo antes de subir nada. */
const HOJA = process.argv.find((a) => a.startsWith("--hoja="))?.slice(7);
let orden = 0;

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
  "modelo 10": "36/0073",
  "modelo 11": "36/0095",
  "modelo 12": "36/0082",
  "modelo 13": "36/0084",
  // "modelo 14" queda fuera a propósito: sus fotos son verde oliva, vino y
  // azul petróleo, y la prenda tiene registrados morado, negro y azul. Eso no
  // cuadra, y forzarlo sería ponerle a la clienta un color que no va a recibir.
  "modelo 15": "36/0103",
  "Modelo 17": "36/0005",
  "modelo 19": "36/0107",
  "modelo 20": "36/0111",
  "modelo 21": "36/0077",
  "modelo 22": "36/0089",
  "modelo 24": "36/0124",
  "modelo 25": "36/0128",
  "modelo 27": "36/0140",
  "modelo 28": "36/0143",
  "modelo 29": "36/0147",
};

/**
 * Las que el reparto automático erraba y se fijan a mano.
 *
 * El color dominante se equivoca cuando la carpeta trae más colores de los que
 * la prenda tiene registrados: le ponía la foto verde oliva al rojo. Estas
 * cuatro se miraron una por una.
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

/** Las fotos de una carpeta, o la suelta si es un archivo. */
function fotosDe(nombre) {
  const ruta = join(RAIZ, nombre);
  if (statSync(ruta).isDirectory()) {
    return readdirSync(ruta).map((f) => join(ruta, f));
  }
  return [ruta];
}

/** El nombre real en disco, que a veces lleva extensión. */
function enDisco(clave) {
  for (const e of readdirSync(RAIZ)) {
    if (e === clave || e.replace(/\.[^.]+$/, "") === clave) return e;
  }
  return null;
}

const { data: paleta } = await supabase
  .from("colores_catalogo")
  .select("nombre,hex")
  .eq("activo", true);

const sobran = [];
const cuenta = { fotos: 0, colores: 0, prendas: 0, fallos: 0 };

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

  // Qué color tiene cada foto, según lo que se ve en ella.
  const leidas = [];
  for (const foto of fotosDe(carpeta)) {
    const rgb = await colorDominante(foto);
    const cerca = rgb ? masCercano(rgb, paleta) : null;
    const lab = rgb
      ? aLab("#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""))
      : null;
    leidas.push({ foto, color: cerca?.nombre ?? "?", d: cerca?.d ?? 999, lab });
  }

  console.log(`\n${clave}  ->  ${producto.nombre}: ${producto.descripcion}`);
  console.log(`  colores en inventario: ${colores.map((c) => c.nombre).join(", ")}`);

  for (const c of colores) {
    /**
     * La foto cuya prenda se parezca más a este color, midiendo el color y no
     * comparando nombres. Un rojo leído como "Burdeos" es el mismo rojo: pedir
     * que el nombre calce exacto dejaba fuera la mitad de las fotos.
     *
     * Si la prenda tiene un solo color, la mejor foto es suya y punto: la
     * carpeta entera es de esa prenda.
     */
    const objetivo = paleta.find(
      (x) => x.nombre.toLowerCase() === c.nombre.toLowerCase() && x.hex,
    );
    // Las fotos que otro color de esta misma prenda tiene reservada a mano no
    // entran al reparto: si no, el color que va primero se las lleva y la
    // corrección llega tarde. Fue justo lo que pasó con el leopardo gris.
    const reservadas = new Set(
      Object.entries(A_MANO)
        .filter(([k]) => k.startsWith(`${clave}|`) && k !== `${clave}|${c.nombre}`)
        .map(([, v]) => v),
    );
    const libres = leidas.filter(
      (l) => !l.usada && !reservadas.has(basename(l.foto)),
    );
    if (libres.length === 0) {
      console.log(`    ${c.nombre.padEnd(14)} ya no quedan fotos`);
      continue;
    }

    let elegida;
    const fijada = A_MANO[`${clave}|${c.nombre}`];
    if (fijada) {
      const enc = leidas.find((l) => basename(l.foto) === fijada);
      elegida = enc ? { ...enc, cerca: 0 } : null;
      if (!elegida) {
        console.log(`    ${c.nombre.padEnd(14)} no encuentro ${fijada}`);
        continue;
      }
    } else if (!objetivo) {
      // "Por definir" y compañía no tienen color contra el que medir.
      elegida = { ...libres[0], cerca: null };
    } else {
      const meta = aLab(objetivo.hex);
      elegida = libres
        .map((l) => ({
          ...l,
          cerca: l.lab
            ? Math.hypot(l.lab[0] - meta[0], l.lab[1] - meta[1], l.lab[2] - meta[2])
            : 999,
        }))
        .sort((a, b) => a.cerca - b.cerca)[0];
    }

    /**
     * Si ninguna foto se parece de verdad a este color, no se pone ninguna.
     *
     * Las carpetas traen más colores de los que la prenda tiene registrados,
     * así que sin este corte el reparto acababa poniéndole al rojo una foto
     * verde oliva. Quedarse sin foto se ve y se arregla; una foto equivocada
     * en la tienda no se ve y se vende.
     */
    const CORTE = 55;
    if (elegida.cerca !== null && elegida.cerca > CORTE) {
      console.log(
        `    ${c.nombre.padEnd(14)} sin foto de ese color (la más cercana, ${basename(elegida.foto)}, parece ${elegida.color})`,
      );
      continue;
    }

    leidas.find((l) => l.foto === elegida.foto).usada = true;
    const aviso = "";
    console.log(
      `    ${c.nombre.padEnd(14)} <- ${basename(elegida.foto).padEnd(16)} leí ${String(elegida.color).padEnd(12)}${
        elegida.cerca === null ? "" : `dist ${elegida.cerca.toFixed(0)}`
      }${aviso}`,
    );

    if (HOJA) {
      orden++;
      await sharp(elegida.foto, { failOn: "none" })
        .rotate()
        .resize(260, 347, { fit: "cover" })
        .jpeg({ quality: 82 })
        .toFile(
          `${HOJA}/${String(orden).padStart(2, "0")}_${clave.replace(/[^a-zA-Z0-9]+/g, "-")}_${c.nombre.replace(/[^a-zA-Z0-9]+/g, "-")}.jpg`,
        );
    }

    if (ensayo) { cuenta.colores++; continue; }

    try {
      const datos = await sharp(elegida.foto, { failOn: "none" })
        .rotate()
        .resize(1200, 1600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 86 })
        .toBuffer();

      const ruta = rutaDeFoto(producto.id, c.nombre, "jpg");
      const { error } = await supabase.storage
        .from("fotos")
        .upload(ruta, datos, { contentType: "image/jpeg", cacheControl: "31536000", upsert: true });
      if (error) throw new Error(error.message);

      const url = supabase.storage.from("fotos").getPublicUrl(ruta).data.publicUrl;
      const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`subió pero responde ${r.status}`);

      const { error: fallo } = await supabase
        .from("colores")
        .update({ foto_url: url })
        .eq("id", c.id);
      if (fallo) throw new Error(fallo.message);

      cuenta.colores++;
    } catch (e) {
      console.log(`      FALLÓ: ${e.message}`);
      cuenta.fallos++;
    }
  }

  const sinUsar = leidas.filter((l) => !l.usada);
  if (sinUsar.length) {
    sobran.push({ clave, producto: producto.descripcion, fotos: sinUsar });
  }
  cuenta.prendas++;
  cuenta.fotos += leidas.length;
}

console.log("\n" + (ensayo ? "ENSAYO, no se subió nada" : "Listo"));
console.log(`  prendas   ${cuenta.prendas}`);
console.log(`  colores   ${cuenta.colores}`);
if (cuenta.fallos) console.log(`  fallos    ${cuenta.fallos}`);

if (sobran.length) {
  console.log("\nFOTOS QUE SOBRAN: colores que la prenda no tiene registrados.");
  console.log("No se crean solos: hay que saber si de verdad los tienen y cuántos.\n");
  for (const s of sobran) {
    console.log(`  ${s.clave} (${s.producto})`);
    for (const f of s.fotos) {
      console.log(`      ${basename(f.foto).padEnd(16)} parece ${f.color}`);
    }
  }
}
