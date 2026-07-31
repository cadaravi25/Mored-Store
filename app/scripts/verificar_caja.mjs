/**
 * Comprueba que la migración de caja quedó aplicada y que el corte del día
 * responde. No escribe nada: solo consulta.
 *
 *   node scripts/verificar_caja.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

const hoy = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Caracas",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

console.log("Hoy en Caracas:", hoy);

const { data: resumen, error } = await supabase.rpc("resumen_caja", {
  p_fecha: hoy,
});

if (error) {
  console.error("resumen_caja falló:", error.message);
  process.exit(1);
}

console.log("\nCorte del día");
console.log("  cobrado           ", resumen.total_ventas_usd, "USD");
console.log("  ventas            ", resumen.cantidad_ventas);
console.log("  efectivo $ esperado", resumen.efectivo_usd_esperado);
console.log("  efectivo Bs esperado", resumen.efectivo_bs_esperado);
console.log("  tasa              ", resumen.tasa);
console.log("  sin verificar     ", resumen.por_verificar?.cantidad);
console.log("  métodos           ", resumen.detalle.length);
console.log("  cierre            ", resumen.cierre ? resumen.cierre.estado : "abierto");

// Que los límites del día sean los de Caracas y no los de UTC: medianoche
// local tiene que caer a las 04:00 UTC.
const { data: limites, error: falloLimites } = await supabase
  .rpc("f_inicio_del_dia", { p_fecha: hoy });

if (falloLimites) {
  console.error("\nf_inicio_del_dia falló:", falloLimites.message);
  process.exit(1);
}

console.log("\nMedianoche de Caracas en hora absoluta:", limites);
const utc = new Date(limites).getUTCHours();
console.log(utc === 4 ? "  correcto: son las 04:00 UTC" : `  MAL: da las ${utc}:00 UTC`);

const { error: falloReporte } = await supabase.rpc("reporte_finanzas", {
  p_desde: hoy,
  p_hasta: hoy,
});
console.log(
  "\nreporte_finanzas:",
  falloReporte ? `falló — ${falloReporte.message}` : "responde",
);
