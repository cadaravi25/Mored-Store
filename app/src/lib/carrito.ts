/**
 * El carrito de la tienda pública.
 *
 * Vive en el navegador de quien compra y nunca toca la base. La venta se cierra
 * por WhatsApp, así que el carrito es apenas una lista para armar el mensaje:
 * guardarlo en el servidor sería inventarle estado a algo que no lo necesita.
 */

const LLAVE = "mored-carrito";

export interface ItemCarrito {
  variante_id: string;
  producto: string;
  color: string;
  talla: string;
  precio_usd: number;
  foto_url: string | null;
  cantidad: number;
}

export function leerCarrito(): ItemCarrito[] {
  if (typeof window === "undefined") return [];
  try {
    const crudo = window.localStorage.getItem(LLAVE);
    const lista = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? (lista as ItemCarrito[]) : [];
  } catch {
    return [];
  }
}

export function guardarCarrito(items: ItemCarrito[]) {
  window.localStorage.setItem(LLAVE, JSON.stringify(items));
  // Un evento propio: el localStorage solo avisa a las OTRAS pestañas, y acá
  // hace falta que el contador del carrito se entere en esta misma.
  window.dispatchEvent(new CustomEvent("carrito"));
}

export function agregarAlCarrito(item: Omit<ItemCarrito, "cantidad">) {
  const items = leerCarrito();
  const i = items.findIndex((x) => x.variante_id === item.variante_id);
  if (i >= 0) items[i] = { ...items[i], cantidad: items[i].cantidad + 1 };
  else items.push({ ...item, cantidad: 1 });
  guardarCarrito(items);
}

export function cambiarCantidad(variante_id: string, delta: number) {
  const items = leerCarrito()
    .map((x) =>
      x.variante_id === variante_id ? { ...x, cantidad: x.cantidad + delta } : x,
    )
    .filter((x) => x.cantidad > 0);
  guardarCarrito(items);
}

export function vaciarCarrito() {
  guardarCarrito([]);
}

export function totalCarrito(items: ItemCarrito[]): number {
  return items.reduce((s, x) => s + x.cantidad * Number(x.precio_usd), 0);
}

const dinero = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

/** El mensaje que llega al WhatsApp de la tienda. */
export function mensajeWhatsapp(items: ItemCarrito[]): string {
  const lineas = items.map(
    (x) =>
      `• ${x.cantidad}x ${x.producto} · ${x.color} · talla ${x.talla} — ${dinero.format(
        x.cantidad * Number(x.precio_usd),
      )}`,
  );
  return [
    "¡Hola! Quiero pedir:",
    "",
    ...lineas,
    "",
    `Total: ${dinero.format(totalCarrito(items))}`,
  ].join("\n");
}

export function enlaceWhatsapp(items: ItemCarrito[], numero: string): string {
  return `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(
    mensajeWhatsapp(items),
  )}`;
}
