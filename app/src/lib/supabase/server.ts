import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente para componentes de servidor. La sesión viaja en cookies, así que
 * las consultas corren como la usuaria autenticada y RLS aplica de verdad.
 */
export async function crearClienteServidor() {
  const almacen = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (cookiesNuevas) => {
          try {
            cookiesNuevas.forEach(({ name, value, options }) =>
              almacen.set(name, value, options),
            );
          } catch {
            // Los componentes de servidor no pueden escribir cookies. El
            // middleware ya refresca la sesión, así que aquí se ignora.
          }
        },
      },
    },
  );
}
