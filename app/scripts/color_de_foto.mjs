/**
 * De qué color es la prenda que sale en una foto.
 *
 * Hace falta porque cada carpeta de fotos es una prenda con VARIOS colores, y
 * hay que ponerle a cada color el suyo. Hacerlo a ojo con ciento y pico fotos
 * es donde se cuelan los errores.
 *
 * CÓMO LO ADIVINA
 *
 * Se mira el centro de la foto, que es donde está la prenda, y se descartan
 * los píxeles que son piel o pared. De lo que queda NO se toma el color más
 * repetido: eso devolvía la pared, porque el fondo siempre ocupa más que la
 * prenda. Se pesa lo repetido por lo saturado, que es lo que separa una prenda
 * de un fondo de estudio.
 *
 * Y si nada está saturado, gana lo oscuro repetido: es como se reconoce un
 * enterizo negro sobre pared blanca, que de otro modo no tiene color que
 * ganar.
 *
 * NO ES INFALIBLE
 *
 * Una prenda negra sobre fondo oscuro, o una foto con la modela ocupando poco,
 * lo confunden. Por eso devuelve también la distancia: si es grande, hay que
 * mirarla a ojo antes de darla por buena.
 */
import sharp from "sharp";

/** Los colores que la tienda sabe pintar, con su hex. */
export function aLab(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  [r, g, b] = [r, g, b].map((v) =>
    v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92,
  );
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const dist = (a, b) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** ¿Ese píxel es piel? Se descarta: la modela no es la prenda. */
function esPiel(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return (
    r > 90 && g > 40 && b > 20 && r > g && g > b &&
    max - min > 12 && max - min < 130 && r - g < 90
  );
}

export async function colorDominante(archivo) {
  const { data, info } = await sharp(archivo, { failOn: "none" })
    .resize(120, 160, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Solo el centro: los bordes son fondo casi siempre.
  const x0 = Math.floor(info.width * 0.28), x1 = Math.floor(info.width * 0.72);
  const y0 = Math.floor(info.height * 0.18), y1 = Math.floor(info.height * 0.88);

  const cubos = new Map();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * info.width + x) * 3;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum > 240 || esPiel(r, g, b)) continue;
      const clave = `${r >> 4},${g >> 4},${b >> 4}`;
      const c = cubos.get(clave) ?? { n: 0, r: 0, g: 0, b: 0, s: 0 };
      c.n++; c.r += r; c.g += g; c.b += b;
      c.s += max === 0 ? 0 : (max - min) / max;
      cubos.set(clave, c);
    }
  }
  if (cubos.size === 0) return null;

  const lista = [...cubos.values()].map((c) => ({
    ...c,
    sat: c.s / c.n,
    lum: (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / c.n,
  }));

  const conColor = lista.filter((c) => c.sat > 0.18);
  const gana = conColor.length
    ? conColor.sort((a, b) => b.n * b.sat ** 1.5 - a.n * a.sat ** 1.5)[0]
    : lista.sort((a, b) => b.n / (1 + b.lum / 40) - a.n / (1 + a.lum / 40))[0];

  return [gana.r / gana.n, gana.g / gana.n, gana.b / gana.n];
}

/** El color del catálogo más parecido, y cuánto se parece. */
export function masCercano(rgb, catalogo) {
  const lab = aLab(
    "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""),
  );
  let mejor = null;
  for (const c of catalogo) {
    if (!c.hex) continue;
    const d = dist(lab, aLab(c.hex));
    if (!mejor || d < mejor.d) mejor = { nombre: c.nombre, d };
  }
  return mejor;
}
