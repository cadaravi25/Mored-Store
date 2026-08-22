"use client";

import { useEffect, useState } from "react";

/**
 * Activar los avisos de pedidos en este teléfono.
 *
 * Se activa por dispositivo y no por persona: el permiso lo da el navegador,
 * así que Yolima con el teléfono y con la tablet son dos activaciones. Por eso
 * el botón dice "en este teléfono" y no "activar notificaciones", que haría
 * pensar que con hacerlo una vez ya está en todos lados.
 *
 * EN IPHONE HAY QUE INSTALARLO PRIMERO
 *
 * Apple solo deja mandar avisos web a las aplicaciones que están en la
 * pantalla de inicio. En el navegador normal no hay forma, y no es algo que se
 * pueda arreglar de este lado: lo único honesto es decirlo.
 */

/** La clave pública viaja en base64 de dirección; el navegador la pide cruda. */
function aBytes(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const limpio = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = window.atob(limpio);
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
}

type Estado = "mirando" | "sin-soporte" | "hay-que-instalar" | "apagado" | "encendido";

export default function Avisos() {
  const [estado, setEstado] = useState<Estado>("mirando");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enIphone, setEnIphone] = useState(false);

  useEffect(() => {
    const iphone = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setEnIphone(iphone);

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // En iPhone sin instalar, PushManager ni siquiera existe. Es el caso más
      // común de "no me sale el botón", así que se distingue del navegador
      // viejo de verdad.
      const instalada = window.matchMedia("(display-mode: standalone)").matches;
      setEstado(iphone && !instalada ? "hay-que-instalar" : "sin-soporte");
      return;
    }

    (async () => {
      try {
        const registro = await navigator.serviceWorker.register("/panel-sw.js", {
          scope: "/panel/",
          updateViaCache: "none",
        });
        const suscripcion = await registro.pushManager.getSubscription();
        setEstado(suscripcion ? "encendido" : "apagado");
      } catch {
        setEstado("sin-soporte");
      }
    })();
  }, []);

  async function encender() {
    setOcupado(true);
    setError(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setError(
          "El navegador no dio permiso. Hay que darlo desde los ajustes del teléfono.",
        );
        return;
      }

      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: aBytes(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
        ),
      });

      const respuesta = await fetch("/api/push/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...suscripcion.toJSON(),
          agente: navigator.userAgent,
        }),
      });
      if (!respuesta.ok) {
        // Si el servidor no la guardó, quitarla del navegador también: dejarla
        // a medias haría creer que está activa cuando no va a llegar nada.
        await suscripcion.unsubscribe();
        throw new Error((await respuesta.json()).error ?? "No se pudo guardar");
      }
      setEstado("encendido");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar");
    } finally {
      setOcupado(false);
    }
  }

  async function apagar() {
    setOcupado(true);
    setError(null);
    try {
      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.getSubscription();
      if (suscripcion) {
        await fetch("/api/push/suscribir", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: suscripcion.endpoint }),
        });
        await suscripcion.unsubscribe();
      }
      setEstado("apagado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo apagar");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "mirando") return null;

  if (estado === "hay-que-instalar") {
    return (
      <p className="mb-4 rounded-xl border border-borde bg-crema-alto px-4 py-3 text-sm text-tinta-suave">
        Para que te avise de los pedidos en el iPhone, primero hay que guardar
        el panel en la pantalla de inicio: toca Compartir y luego{" "}
        <span className="text-tinta">Agregar a inicio</span>. Después vuelve
        aquí y actívalo.
      </p>
    );
  }

  if (estado === "sin-soporte") {
    return (
      <p className="mb-4 rounded-xl border border-borde bg-crema-alto px-4 py-3 text-sm text-tinta-suave">
        Este navegador no puede recibir avisos de pedidos.
      </p>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borde bg-crema-alto px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-tinta">
          {estado === "encendido"
            ? "Te avisa en este teléfono cuando entra un pedido"
            : "Avisos de pedidos apagados en este teléfono"}
        </p>
        {error && <p className="mt-1 text-xs text-alerta">{error}</p>}
        {estado === "apagado" && enIphone && (
          <p className="mt-1 text-xs text-tinta-suave">
            En iPhone hace falta tener el panel en la pantalla de inicio.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={estado === "encendido" ? apagar : encender}
        disabled={ocupado}
        className={`shrink-0 rounded-lg px-4 py-2 text-sm disabled:opacity-50 ${
          estado === "encendido"
            ? "border border-borde text-tinta-suave"
            : "bg-tinta text-crema-alto"
        }`}
      >
        {ocupado
          ? "Un momento…"
          : estado === "encendido"
            ? "Apagar"
            : "Activar avisos"}
      </button>
    </div>
  );
}
