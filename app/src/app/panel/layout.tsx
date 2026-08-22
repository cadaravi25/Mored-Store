import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { correoAUsuario } from "@/lib/auth";
import { Lateral, Inferior } from "@/components/navegacion";

/**
 * El manifiesto se enlaza aquí y no en la raíz.
 *
 * Puesto en la raíz, Next lo mete en todas las páginas y la tienda saldría
 * también como aplicación instalable. Quien entra desde Instagram a ver un
 * enterizo no tiene por qué recibir un "instalar Mored" encima de la foto. Lo
 * que se instala es el panel, que es la herramienta de trabajo.
 */
export const metadata: Metadata = {
  title: "Panel · Mored",
  manifest: "/panel/manifest",
  appleWebApp: { capable: true, title: "Mored", statusBarStyle: "default" },
};

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user.id)
    .maybeSingle();

  const nombre = perfil?.nombre ?? correoAUsuario(user.email);

  return (
    <div className="flex min-h-dvh">
      <Lateral usuario={nombre} />
      {/* El espacio de abajo deja respirar la barra del teléfono. */}
      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>
      <Inferior />
    </div>
  );
}
