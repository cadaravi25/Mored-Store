import sharp from "sharp";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const [origen, destino] = process.argv.slice(2);
const grupos = [];
for (const e of readdirSync(origen)) {
  const ruta = join(origen, e);
  if (statSync(ruta).isDirectory()) {
    const f = readdirSync(ruta);
    if (f.length) grupos.push({ nombre: e, foto: join(ruta, f[0]) });
  } else grupos.push({ nombre: e.replace(/\.[^.]+$/, ""), foto: ruta });
}
grupos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
let i = 0;
for (const g of grupos) {
  i++;
  const salida = join(destino, `${String(i).padStart(2, "0")}__${g.nombre.replace(/[^a-zA-Z0-9]+/g, "-")}.jpg`);
  await sharp(g.foto, { failOn: "none" }).resize(300, 400, { fit: "cover" }).jpeg({ quality: 82 }).toFile(salida);
  console.log(`${String(i).padStart(2)} ${g.nombre}`);
}
