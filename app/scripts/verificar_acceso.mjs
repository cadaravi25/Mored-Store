/**
 * Comprueba de punta a punta que una sesión normal puede trabajar:
 * permisos de tabla, security_invoker en las vistas y políticas de RLS.
 *
 *   node --env-file=.env.local scripts/verificar_acceso.mjs
 *
 * Usa una cuenta temporal que crea y borra, para no tocar las contraseñas
 * reales de las usuarias.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const publico = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});

const linea = (etiqueta, ok, detalle = "") =>
  console.log(`${ok ? "OK     " : "FALLA  "} ${etiqueta}${detalle ? "  ->  " + detalle : ""}`);

// --- 1. Perfiles creados por el disparador de la migración 008 ---
const { data: perfiles } = await admin
  .from("perfiles")
  .select("nombre,rol")
  .order("nombre");
linea(
  "Perfiles creados automaticamente",
  (perfiles?.length ?? 0) >= 2,
  perfiles?.map((p) => `${p.nombre} (${p.rol})`).join(", "),
);

// --- 2. Sin sesion no se ve nada ---
const { data: anonimo, error: errorAnonimo } = await publico
  .from("v_prendas_pendientes")
  .select("componente_id")
  .limit(1);
linea(
  "Sin sesion no se accede a los datos",
  !!errorAnonimo || (anonimo?.length ?? 0) === 0,
  errorAnonimo ? errorAnonimo.message : `${anonimo?.length ?? 0} filas`,
);

// --- 3. Con sesion si ---
const correo = `prueba_${randomBytes(4).toString("hex")}@mored.store`;
const clave = randomBytes(18).toString("base64url");
const { data: creada, error: errorCrear } = await admin.auth.admin.createUser({
  email: correo,
  password: clave,
  email_confirm: true,
  user_metadata: { nombre: "Cuenta de prueba" },
});

if (errorCrear) {
  linea("Crear cuenta temporal", false, errorCrear.message);
  process.exit(1);
}

const { error: errorEntrar } = await publico.auth.signInWithPassword({
  email: correo,
  password: clave,
});
linea("Iniciar sesion", !errorEntrar, errorEntrar?.message ?? "");

const { data: pendientes, error: errorLeer } = await publico
  .from("v_prendas_pendientes")
  .select("producto,color,talla,piezas_faltantes,monto_faltante_usd,dias_esperando")
  .order("dias_esperando", { ascending: false });

linea(
  "Leer pendientes con sesion",
  !errorLeer && (pendientes?.length ?? 0) > 0,
  errorLeer ? errorLeer.message : `${pendientes?.length ?? 0} filas`,
);

if (pendientes?.length) {
  const prendas = pendientes.reduce((s, p) => s + p.piezas_faltantes, 0);
  const monto = pendientes.reduce((s, p) => s + Number(p.monto_faltante_usd ?? 0), 0);
  linea("Totales coinciden con la verificacion SQL", prendas === 22, `${prendas} prendas, ${monto.toFixed(2)} USD`);
  console.log("\nPrimeras filas que vera la pantalla:");
  console.table(pendientes.slice(0, 4));
}

// --- 4. El buscador del mostrador ---
const { data: busqueda, error: errorBuscar } = await publico.rpc("buscar_variantes", {
  p_termino: "burdeos",
});
linea(
  'Buscador por color ("burdeos")',
  !errorBuscar,
  errorBuscar ? errorBuscar.message : `${busqueda?.length ?? 0} resultados`,
);

await publico.auth.signOut();
await admin.auth.admin.deleteUser(creada.user.id);
console.log("\nCuenta temporal eliminada.");
