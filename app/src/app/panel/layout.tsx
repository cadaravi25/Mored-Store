import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { correoAUsuario } from "@/lib/auth";
import { Lateral, Inferior } from "@/components/navegacion";

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
