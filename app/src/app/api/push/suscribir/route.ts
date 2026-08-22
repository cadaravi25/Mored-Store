import { crearClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Apunta un teléfono para que le lleguen los avisos de pedidos.
 *
 * La suscripción la da el navegador y es una dirección a la que se le pueden
 * empujar mensajes. Se guarda contra el perfil de quien esté dentro, así que
 * hace falta haber entrado al panel: si no, cualquiera podría apuntarse a los
 * pedidos de la tienda.
 */
export async function POST(peticion: Request) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Hay que entrar primero" }, { status: 401 });
  }

  let cuerpo: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    agente?: string;
  };
  try {
    cuerpo = await peticion.json();
  } catch {
    return Response.json({ error: "Cuerpo ilegible" }, { status: 400 });
  }

  const { endpoint, keys, agente } = cuerpo;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json({ error: "Suscripción incompleta" }, { status: 400 });
  }

  // El mismo teléfono reinstalado devuelve el mismo endpoint. Se actualiza en
  // vez de duplicar, o acabaría recibiendo el aviso dos veces.
  const { error } = await supabase.from("suscripciones_push").upsert(
    {
      perfil_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      agente: agente?.slice(0, 200) ?? null,
    },
    { onConflict: "endpoint" },
  );

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}

/** Deja de recibir avisos en este teléfono. */
export async function DELETE(peticion: Request) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Hay que entrar primero" }, { status: 401 });
  }

  const { endpoint } = (await peticion.json().catch(() => ({}))) as {
    endpoint?: string;
  };
  if (!endpoint) {
    return Response.json({ error: "Falta la suscripción" }, { status: 400 });
  }

  const { error } = await supabase
    .from("suscripciones_push")
    .delete()
    .eq("endpoint", endpoint);

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
