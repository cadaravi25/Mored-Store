import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Se invierte el criterio: la tienda es la portada, así que lo que hay que
// proteger es /panel y nada más. Todo lo demás es de cara a la calle, y sale
// de catalogo_publico, lo único que el rol anónimo puede llamar en toda la
// base.
const RUTAS_PRIVADAS = ["/panel"];

/**
 * Lo que vive bajo /panel pero tiene que poder leerse sin haber entrado.
 *
 * El manifiesto lo pide el navegador para ofrecer instalar la aplicación, y lo
 * pide sin las cookies de nadie. Si le contesta la pantalla de entrada, el
 * teléfono decide que no hay aplicación que instalar y no vuelve a preguntar.
 * No lleva nada privado: el nombre, el color y los iconos.
 */
const EXCEPCIONES = ["/panel/manifest"];

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
  // Por segmento y no por prefijo suelto: con startsWith a secas, /panel-sw.js
  // contaba como privado y el ayudante de los avisos nunca llegaba a
  // instalarse, porque el navegador recibía la pantalla de entrada en vez del
  // guion.
  const esPrivada =
    !EXCEPCIONES.includes(ruta) &&
    RUTAS_PRIVADAS.some((r) => ruta === r || ruta.startsWith(`${r}/`));

  if (!user && esPrivada) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("volver", ruta);
    return NextResponse.redirect(url);
  }

  if (user && ruta.startsWith("/entrar")) {
    const url = request.nextUrl.clone();
    url.pathname = "/panel";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

// Sin matcher, el proxy corre también sobre estáticos e imágenes y termina
// bloqueando el CSS de la propia pantalla de entrada.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|js)$).*)",
  ],
};
