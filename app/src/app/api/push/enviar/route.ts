import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const dynamic = "force-dynamic";

/**
 * Manda el aviso de un pedido a todos los teléfonos apuntados.
 *
 * Quien llama es la base de datos, desde el disparador que cuelga de las
 * ventas del catálogo, no el navegador de nadie. Por eso no hay sesión que
 * comprobar: se comprueba un secreto compartido, que viaja en una cabecera y
 * está guardado en la base y en el entorno de la tienda.
 *
 * POR QUÉ NO SE USA EL SERVICE ROLE
 *
 * La clave de servicio no está en el alojamiento, y no debe estarlo: se salta
 * todas las reglas de la base, y ahí dentro también vive el catálogo público.
 * Los datos que hacen falta aquí (el pedido y los teléfonos) se piden con una
 * función que solo devuelve eso.
 */

const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const CLAVE_PRIVADA = process.env.VAPID_PRIVATE_KEY;
const SECRETO = process.env.PUSH_SECRETO;

const eur = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "EUR",
});

export async function POST(peticion: Request) {
  if (!CLAVE_PUBLICA || !CLAVE_PRIVADA || !SECRETO) {
    return Response.json(
      { error: "Los avisos no están configurados" },
      { status: 503 },
    );
  }
  if (peticion.headers.get("x-mored-secreto") !== SECRETO) {
    return Response.json({ error: "No" }, { status: 401 });
  }

  const { venta_id, numero, piezas, total_usd } = (await peticion
    .json()
    .catch(() => ({}))) as {
    venta_id?: string;
    numero?: number;
    piezas?: number;
    total_usd?: number;
  };
  if (!venta_id) {
    return Response.json({ error: "Falta el pedido" }, { status: 400 });
  }

  webpush.setVapidDetails(
    "mailto:cadaravi25@gmail.com",
    CLAVE_PUBLICA,
    CLAVE_PRIVADA,
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: destinos, error } = await supabase.rpc("destinos_de_aviso", {
    p_secreto: SECRETO,
  });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const filas = (destinos ?? []) as {
    endpoint: string;
    p256dh: string;
    auth: string;
  }[];
  if (filas.length === 0) return Response.json({ enviados: 0 });

  const n = Number(piezas ?? 0);
  const carga = JSON.stringify({
    titulo: numero ? `Pedido #${numero} por la web` : "Pedido nuevo por la web",
    cuerpo: `${n} ${n === 1 ? "pieza" : "piezas"} · ${eur.format(Number(total_usd ?? 0))}`,
    etiqueta: `orden-${venta_id}`,
    ruta: "/panel/ordenes",
  });

  let enviados = 0;
  const caducadas: string[] = [];

  await Promise.all(
    filas.map(async (f) => {
      try {
        await webpush.sendNotification(
          { endpoint: f.endpoint, keys: { p256dh: f.p256dh, auth: f.auth } },
          carga,
        );
        enviados++;
      } catch (e) {
        // 404 y 410 son el navegador diciendo que ese teléfono ya no existe:
        // desinstalaron la app o limpiaron los datos. Sin borrarlas, la lista
        // crece con direcciones muertas y cada aviso tarda más.
        const codigo = (e as { statusCode?: number }).statusCode;
        if (codigo === 404 || codigo === 410) caducadas.push(f.endpoint);
      }
    }),
  );

  if (caducadas.length > 0) {
    await supabase.rpc("olvidar_suscripciones", {
      p_secreto: SECRETO,
      p_endpoints: caducadas,
    });
  }

  return Response.json({ enviados, caducadas: caducadas.length });
}
