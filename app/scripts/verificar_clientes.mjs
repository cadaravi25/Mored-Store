/**
 * Comprueba el módulo de clientes contra la base.
 *
 *   node scripts/verificar_clientes.mjs
 *
 * Crea un cliente de prueba para verificar que el mismo teléfono escrito de
 * otra forma no genera un duplicado, y lo borra al final.
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

let creado = null;

try {
  const { data: lista, error: falloLista } = await supabase.rpc("buscar_clientes", {
    p_termino: null,
  });
  if (falloLista) throw new Error("buscar_clientes: " + falloLista.message);
  console.log("buscar_clientes responde ·", lista.length, "clientes");

  // Mismo número, tres formas de escribirlo.
  const { data: uno, error: f1 } = await supabase.rpc("obtener_o_crear_cliente", {
    p_nombre: "Prueba Mored",
    p_telefono: "0414-1234567",
  });
  if (f1) throw new Error("obtener_o_crear_cliente: " + f1.message);
  creado = uno;

  const { data: dos } = await supabase.rpc("obtener_o_crear_cliente", {
    p_nombre: "Prueba Mored otra vez",
    p_telefono: "+58 414 123 4567",
  });
  const { data: tres } = await supabase.rpc("obtener_o_crear_cliente", {
    p_nombre: "Prueba Mored tercera",
    p_telefono: "04141234567",
  });

  console.log(
    "mismo teléfono en tres formatos ->",
    uno === dos && dos === tres ? "un solo cliente ✓" : "SE DUPLICÓ ✗",
  );

  // El arroba del Instagram no debe quedar guardado.
  await supabase.from("clientes").update({ instagram: "@moredtest" }).eq("id", creado);
  const { data: guardado } = await supabase
    .from("clientes")
    .select("nombre,telefono,instagram")
    .eq("id", creado)
    .single();
  console.log(
    "instagram guardado como",
    JSON.stringify(guardado.instagram),
    guardado.instagram === "moredtest" ? "✓" : "✗ (debería ir sin arroba)",
  );

  // Se encuentra por nombre, por teléfono suelto y por instagram.
  for (const termino of ["prueba", "1234567", "@moredtest"]) {
    const { data } = await supabase.rpc("buscar_clientes", { p_termino: termino });
    const hallado = (data ?? []).some((c) => c.id === creado);
    console.log(`buscar "${termino}" ->`, hallado ? "lo encuentra ✓" : "NO lo encuentra ✗");
  }

  const { data: ficha, error: f2 } = await supabase.rpc("ficha_cliente", {
    p_cliente_id: creado,
  });
  if (f2) throw new Error("ficha_cliente: " + f2.message);
  console.log(
    "ficha_cliente responde · compras:",
    ficha.compras,
    "· tallas:",
    JSON.stringify(ficha.tallas),
    "· historial:",
    ficha.historial.length,
  );
} catch (e) {
  console.error("FALLÓ:", e.message);
  process.exitCode = 1;
} finally {
  if (creado) {
    await supabase.from("clientes").delete().eq("id", creado);
    console.log("\ncliente de prueba borrado");
  }
}
