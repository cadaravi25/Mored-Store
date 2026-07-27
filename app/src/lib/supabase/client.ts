import { createBrowserClient } from "@supabase/ssr";

/** Cliente para componentes de navegador. Comparte la sesión por cookies. */
export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
