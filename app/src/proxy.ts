import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RUTAS_PUBLICAS = ["/entrar"];

/**
 * En Next 16 esto se llama `proxy`; hasta la 15 era `middleware`.
 *
 * Su trabajo aquí es refrescar la sesión y mandar a la pantalla de entrada a
 * quien no la tenga. NO es la barrera de seguridad: la documentación advierte
 * que el proxy puede desplegarse en el CDN, separado del render. La barrera
 * real son dos: cada página verifica la sesión en el servidor, y por debajo
 * RLS no devuelve ni una fila sin usuaria autenticada.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesNuevas) => {
          cookiesNuevas.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesNuevas.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida el token contra Supabase. getSession() solo lee la cookie,
  // que se puede falsificar, así que no sirve para decidir accesos.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  const esPublica = RUTAS_PUBLICAS.some((r) => ruta.startsWith(r));

  if (!user && !esPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("volver", ruta);
    return NextResponse.redirect(url);
  }

  if (user && ruta.startsWith("/entrar")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

// Sin matcher, el proxy corre también sobre estáticos e imágenes y termina
// bloqueando el CSS de la propia pantalla de entrada.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
