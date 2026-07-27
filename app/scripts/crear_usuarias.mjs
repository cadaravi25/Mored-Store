/**
 * Da de alta usuarias del sistema interno.
 *
 * Uso, desde la carpeta app/:
 *   node --env-file=.env.local scripts/crear_usuarias.mjs
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local. Esa clave se salta RLS por
 * completo: nunca va al navegador, nunca al repositorio, nunca a un chat.
 *
 * Las contraseñas se generan aquí y se escriben en credenciales-iniciales.txt,
 * que está ignorado por git. No se imprimen en pantalla para que no queden en
 * el historial de la terminal.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const USUARIAS = [
  { usuario: "yolima", nombre: "Yolima" },
  { usuario: "sara", nombre: "Sara" },
];

const DOMINIO = "mored.store";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !clave) {
  console.error(
    "Falta SUPABASE_SERVICE_ROLE_KEY en app/.env.local.\n" +
      "La consigues en el panel: Project Settings -> API Keys -> service_role.",
  );
  process.exit(1);
}

const admin = createClient(url, clave, { auth: { persistSession: false } });

/** Contraseña legible al dictarla por teléfono: sin caracteres ambiguos. */
function generarClave() {
  const alfabeto = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(14))
    .map((b) => alfabeto[b % alfabeto.length])
    .join("");
}

const resultado = [];

for (const { usuario, nombre } of USUARIAS) {
  const correo = `${usuario}@${DOMINIO}`;
  const password = generarClave();

  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    password,
    // Sin esto la cuenta queda sin confirmar y no puede entrar. Como el correo
    // no existe, nunca llegaría el mensaje de confirmación.
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (error) {
    if (error.message?.toLowerCase().includes("already")) {
      console.log(`- ${usuario}: ya existía, no se toca`);
      continue;
    }
    console.error(`- ${usuario}: ERROR - ${error.message}`);
    continue;
  }

  // El disparador de la migración 008 ya creó el perfil; aquí solo se corrige
  // el nombre para que salga bien escrito y no en minúsculas.
  await admin.from("perfiles").update({ nombre }).eq("id", data.user.id);

  resultado.push({ usuario, nombre, password });
  console.log(`- ${usuario}: creada`);
}

if (resultado.length > 0) {
  const texto =
    "Mored Store: credenciales iniciales\n" +
    "Entregar a cada persona por separado y borrar este archivo despues.\n" +
    "Se entra escribiendo solo el usuario, sin arroba ni dominio.\n\n" +
    resultado
      .map((r) => `${r.nombre}\n  usuario:    ${r.usuario}\n  contrasena: ${r.password}\n`)
      .join("\n");

  writeFileSync("credenciales-iniciales.txt", texto, "utf8");
  console.log("\nContraseñas escritas en app/credenciales-iniciales.txt");
  console.log("Ese archivo está ignorado por git. Bórralo cuando las entregues.");
}
