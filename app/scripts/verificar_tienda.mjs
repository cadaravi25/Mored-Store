/**
 * Comprueba que la ventana pública sea una ventana y no una puerta.
 *
 *   node scripts/verificar_tienda.mjs
 *
 * Usa la clave pública, la misma que lleva cualquier visitante en el navegador,
 * e intenta leer lo que NO debería poder leer. Si algo de eso responde con
 * datos, hay una fuga.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const entorno = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

// Sin sesión: exactamente lo que tiene alguien que llega desde Instagram.
const publico = createClient(
  entorno.NEXT_PUBLIC_SUPABASE_URL,
  entorno.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);

const { data: catalogo, error } = await publico.rpc("catalogo_publico");

if (error) {
  console.error("catalogo_publico NO se puede llamar:", error.message);
  console.error("¿Corriste la migración 20260804120021_catalogo_por_funcion.sql?");
  process.exit(1);
}

console.log("catalogo_publico:", catalogo.length, "filas visibles al público");

if (catalogo.length > 0) {
  const columnas = Object.keys(catalogo[0]);
  console.log("columnas expuestas:", columnas.join(", "));
  const prohibidas = columnas.filter((c) =>
    /costo|margen|proveedor|cedula|telefono|actor/i.test(c),
  );
  console.log(
    prohibidas.length === 0
      ? "  ninguna columna sensible ✓"
      : `  FUGA: ${prohibidas.join(", ")} ✗`,
  );
}

// Lo que un visitante NO debe poder tocar.
const cerradas = [
  "v_catalogo",
  "variantes",
  "productos",
  "clientes",
  "ventas",
  "pagos",
  "movimientos_financieros",
  "cierres_caja",
  "perfiles",
];

console.log("\nlo que debe estar cerrado:");
let fugas = 0;
for (const tabla of cerradas) {
  const { data, error: fallo } = await publico.from(tabla).select("*").limit(1);
  const abierto = !fallo && Array.isArray(data) && data.length > 0;
  if (abierto) fugas++;
  console.log(`  ${tabla.padEnd(24)} ${abierto ? "ABIERTA ✗" : "cerrada ✓"}`);
}

console.log(
  fugas === 0
    ? "\nLa tienda solo ve el catálogo."
    : `\n${fugas} tablas quedaron accesibles. Hay que cerrarlas.`,
);
process.exitCode = fugas === 0 ? 0 : 1;
