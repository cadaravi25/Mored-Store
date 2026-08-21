/**
 * Empareja las fotos buenas con los recortes sacados del vídeo.
 *
 * Carlos metió en cada carpeta la misma foto que ya se ve en la tienda, así que
 * la que más se parezca a un recorte dice a qué prenda pertenece la carpeta.
 *
 * Se compara de dos maneras porque ninguna sola basta: la silueta (todo
 * llevado a un cuadrado, que aguanta que el recorte del vídeo esté cortado) y
 * el reparto de colores (que aguanta que esté movido o mal encuadrado). En un
 * vídeo lleno de enterizos negros, la silueta sola confundiría a la mitad.
 */
import sharp from "sharp";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const LADO = 32;

async function firma(archivo) {
  const gris = await sharp(archivo, { failOn: "none" })
    .resize(LADO, LADO, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();

  const color = await sharp(archivo, { failOn: "none" })
    .resize(16, 16, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();

  // Histograma 4x4x4: en qué zonas del cubo de color cae la foto.
  const hist = new Float64Array(64);
  for (let i = 0; i < color.length; i += 3) {
    const r = color[i] >> 6, g = color[i + 1] >> 6, b = color[i + 2] >> 6;
    hist[r * 16 + g * 4 + b] += 1;
  }
  const n = color.length / 3;
  for (let i = 0; i < 64; i++) hist[i] /= n;

  // La silueta se normaliza para que el brillo no mande.
  const media = gris.reduce((s, v) => s + v, 0) / gris.length;
  const norm = Float64Array.from(gris, (v) => v - media);
  const largo = Math.sqrt(norm.reduce((s, v) => s + v * v, 0)) || 1;
  for (let i = 0; i < norm.length; i++) norm[i] /= largo;

  return { norm, hist };
}

/** 1 es idéntico, 0 no se parecen en nada. */
function parecido(a, b) {
  let silueta = 0;
  for (let i = 0; i < a.norm.length; i++) silueta += a.norm[i] * b.norm[i];
  let color = 0;
  for (let i = 0; i < 64; i++) color += Math.min(a.hist[i], b.hist[i]);
  return 0.55 * Math.max(silueta, 0) + 0.45 * color;
}

const CARPETA = process.argv[2];
const RECORTES = process.argv[3];

// Cada carpeta es una prenda; los sueltos también.
const grupos = [];
for (const e of readdirSync(CARPETA)) {
  const ruta = join(CARPETA, e);
  if (statSync(ruta).isDirectory()) {
    const fotos = readdirSync(ruta).map((f) => join(ruta, f));
    if (fotos.length) grupos.push({ nombre: e, fotos });
  } else {
    grupos.push({ nombre: e, fotos: [ruta] });
  }
}

const recortes = readdirSync(RECORTES).map((f) => ({
  nombre: f.replace(/\.jpg$/, ""),
  ruta: join(RECORTES, f),
}));

const firmasRecorte = [];
for (const r of recortes) firmasRecorte.push({ ...r, f: await firma(r.ruta) });

const filas = [];
for (const g of grupos) {
  let mejor = { punto: -1 };
  for (const foto of g.fotos) {
    let f;
    try { f = await firma(foto); } catch { continue; }
    for (const r of firmasRecorte) {
      const punto = parecido(f, r.f);
      if (punto > mejor.punto) mejor = { punto, recorte: r.nombre, foto };
    }
  }
  filas.push({ grupo: g.nombre, fotos: g.fotos.length, ...mejor });
}

filas.sort((a, b) => b.punto - a.punto);
for (const f of filas) {
  console.log(
    `${(f.punto ?? 0).toFixed(3)}  ${String(f.grupo).padEnd(12)} ${String(f.fotos).padStart(2)} fotos  -> 36/${f.recorte ?? "?"}`,
  );
}
