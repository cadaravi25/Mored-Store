import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import Buscador from "./buscador";

export const dynamic = "force-dynamic";

export default async function Inventario() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl text-tinta">Inventario</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Busca por prenda, color o talla
          </p>
        </div>
        <nav className="flex shrink-0 gap-4 text-sm text-dorado">
          <Link href="/recibir" className="underline-offset-4 hover:underline">
            Recibir
          </Link>
          <Link href="/" className="underline-offset-4 hover:underline">
            Inicio
          </Link>
        </nav>
      </header>

      <Buscador />
    </main>
  );
}
