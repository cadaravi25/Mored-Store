import type { MetadataRoute } from "next";

export const dynamic = "force-static";

/**
 * El manifiesto va aquí y no en la raíz a propósito.
 *
 * Next sirve `app/manifest.ts` en toda la web y lo enlaza en cada página: la
 * tienda saldría también como aplicación instalable, y una clienta que entra
 * desde Instagram a ver un enterizo no tiene por qué recibir un "instalar
 * Mored" encima de la foto. Lo que se instala es el panel, que es la
 * herramienta de trabajo de ellas.
 *
 * Al estar en /panel, el enlace lo pone el layout del panel y nadie más.
 */
const manifiesto: MetadataRoute.Manifest = {
  name: "Mored · Panel",
  short_name: "Mored",
  description: "Ventas, inventario y órdenes de Mored Store",
  // Abre en Órdenes: es la pantalla por la que se entra cuando suena un aviso.
  start_url: "/panel/ordenes",
  // El alcance encierra la aplicación en el panel. Si alguien toca un enlace a
  // la tienda, se abre en el navegador y no dentro de la app, que es lo
  // correcto: son dos cosas distintas.
  scope: "/panel",
  display: "standalone",
  orientation: "portrait",
  background_color: "#faf7f2",
  theme_color: "#faf7f2",
  lang: "es-VE",
  icons: [
    { src: "/panel-192.png", sizes: "192x192", type: "image/png" },
    { src: "/panel-512.png", sizes: "512x512", type: "image/png" },
    {
      src: "/panel-512-maskable.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};

export function GET() {
  return Response.json(manifiesto, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
