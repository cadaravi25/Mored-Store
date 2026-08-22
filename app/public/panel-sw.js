/**
 * El ayudante que recibe los avisos cuando el panel está cerrado.
 *
 * Vive en la raíz pero se registra con alcance /panel/: un ayudante solo puede
 * abarcar su carpeta o menos, y desde la raíz se puede acotar hacia abajo. Así
 * la tienda no queda debajo de él, que no tiene nada que hacer ahí.
 *
 * No guarda nada para trabajar sin internet. El panel enseña stock y precios
 * que cambian con cada venta, y una pantalla vieja servida desde el teléfono
 * es peor que un error de conexión: nadie sabría que está mirando lo de ayer.
 */

self.addEventListener("install", () => {
  // Entra en servicio sin esperar a que cierren las pestañas abiertas.
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener("push", (evento) => {
  let datos = {};
  try {
    datos = evento.data ? evento.data.json() : {};
  } catch {
    datos = { cuerpo: evento.data ? evento.data.text() : "" };
  }

  const titulo = datos.titulo || "Pedido nuevo";
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || "",
      icon: "/panel-192.png",
      badge: "/panel-192.png",
      vibrate: [90, 40, 90],
      // La etiqueta hace que dos avisos del mismo pedido se pisen en vez de
      // apilarse. Si entran tres pedidos distintos, salen los tres.
      tag: datos.etiqueta || "orden",
      renotify: true,
      data: { ruta: datos.ruta || "/panel/ordenes" },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const ruta = (evento.notification.data && evento.notification.data.ruta) || "/panel/ordenes";

  // Si el panel ya está abierto se le lleva a órdenes en vez de abrir otra
  // ventana: acabar con cuatro pestañas del panel es lo que pasa si no.
  evento.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((abiertas) => {
        for (const ventana of abiertas) {
          if (ventana.url.includes("/panel") && "focus" in ventana) {
            ventana.navigate(ruta);
            return ventana.focus();
          }
        }
        return self.clients.openWindow(ruta);
      }),
  );
});
