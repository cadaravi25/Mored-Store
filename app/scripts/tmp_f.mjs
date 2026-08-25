import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const e = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url),"utf8")
  .split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#"))
  .map(l=>[l.slice(0,l.indexOf("=")).trim(), l.slice(l.indexOf("=")+1).trim()]));
const sb = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const { data } = await sb.from("productos")
  .select("id_externo,nombre,descripcion,colores(nombre,foto_url),variantes(talla,precio_usd,precio_bs)")
  .eq("nombre", process.argv[2]).eq("coleccion","active");
for (const p of data.sort((a,b)=>(a.descripcion??"").localeCompare(b.descripcion??""))) {
  const t=[...new Set(p.variantes.map(v=>v.talla))].join(" ");
  console.log(`[${p.id_externo}] ${p.descripcion}`);
  console.log(`     ${t} · ${p.variantes[0]?.precio_usd}/${p.variantes[0]?.precio_bs} · ${p.colores.map(c=>c.nombre+(c.foto_url?.includes("-video")?"(video)":"")).join(", ")}`);
}
console.log(`total ${data.length}`);
