import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import Formulario, { type Tipo, type Color, type Estilo } from "./formulario";

export const dynamic = "force-dynamic";

export default async function Recibir() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const [{ data: tipos }, { data: colores }, { data: estilos }] =
    await Promise.all([
      supabase
        .from("tipos_prenda")
        .select("id,coleccion,nombre")
        .eq("activo", true)
        .order("orden"),
      supabase
        .from("colores_catalogo")
        .select("id,nombre,hex")
        .eq("activo", true)
        .order("orden"),
      supabase
        .from("estilos")
        .select("id,nombre")
        .eq("activo", true)
        .order("orden"),
    ]);

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-32 pt-6">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl text-tinta">Recibir</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Carga lo que llegó en esta caja
          </p>
        </div>
        
      </header>

      <Formulario
        tipos={(tipos ?? []) as Tipo[]}
        colores={(colores ?? []) as Color[]}
        estilos={(estilos ?? []) as Estilo[]}
      />
    </main>
  );
}
