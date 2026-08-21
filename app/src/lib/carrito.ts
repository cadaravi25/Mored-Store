/**
 * El carrito de la tienda pública.
 *
 * Vive en el navegador de quien compra y nunca toca la base. La venta se cierra
 * por WhatsApp, así que el carrito es apenas una lista para armar el mensaje:
 * guardarlo en el servidor sería inventarle estado a algo que no lo necesita.
 */

import { colorVisible, SIN_TALLA } from "./prendas";
import { precioVisible, type Moneda } from "./moneda";

const LLAVE = "mored-carrito";
const LLAVE_FECHA = "mored-carrito-fecha";

/**
 * Cuánto vive un carrito abandonado, en horas.
 *
 * Sin esto el carrito no caduca nunca: se entra, se sale, se vuelve tres días
 * después y ahí sigue la prenda con el contador puesto, como si el pedido
 * estuviera a medias. Un día es tiempo de sobra para volver a rematar una
 * compra, y pasado eso lo honesto es empezar limpio.
 */
const HORAS_DE_VIDA = 24;

export interface ItemCarrito {
  variante_id: string;
  producto: string;
  color: string;
  talla: string;
  precio_usd: number;
  /** Base del precio en bolívares, también en euros. */
  precio_bs: number;
  foto_url: string | null;
  cantidad: number;
}

export function leerCarrito(): ItemCarrito[] {
  if (typeof window === "undefined") return [];
  try {
    const desde = Number(window.localStorage.getItem(LLAVE_FECHA) ?? 0);
    if (desde && Date.now() - desde > HORAS_DE_VIDA * 3600_000) {
      window.localStorage.removeItem(LLAVE);
      window.localStorage.removeItem(LLAVE_FECHA);
      return [];
    }
    const crudo = window.localStorage.getItem(LLAVE);
    const lista = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? (lista as ItemCarrito[]) : [];
  } catch {
    return [];
  }
}

export function guardarCarrito(items: ItemCarrito[]) {
  window.localStorage.setItem(LLAVE, JSON.stringify(items));
  // La fecha es la del último cambio, no la del primero: mientras sigan
  // agregando, el carrito sigue vivo.
  if (items.length) window.localStorage.setItem(LLAVE_FECHA, String(Date.now()));
  else window.localStorage.removeItem(LLAVE_FECHA);
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

/**
 * El total en la moneda que se esté mirando.
 *
 * No es una conversión del mismo número: son dos precios distintos, así que el
 * total en bolívares no es el total en euros por la tasa.
 */
export function totalCarrito(
  items: ItemCarrito[],
  moneda: Moneda = "eur",
  tasa: number | null = null,
): number {
  const enBs = moneda === "bs" && tasa;
  return items.reduce(
    (s, x) =>
      s +
      x.cantidad *
        (enBs ? Number(x.precio_bs ?? x.precio_usd) * tasa : Number(x.precio_usd)),
    0,
  );
}

/** La suma de las bases de bolívares, en euros. Se multiplica por la tasa
 *  para mostrarla; separada así porque el total en bolívares no es el total
 *  en euros convertido. */
export function baseBsCarrito(items: ItemCarrito[]): number {
  return items.reduce(
    (s, x) => s + x.cantidad * Number(x.precio_bs ?? x.precio_usd),
    0,
  );
}

const dinero = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "EUR",
});

/** El mensaje que llega al WhatsApp de la tienda. */
export function mensajeWhatsapp(
  items: ItemCarrito[],
  moneda: Moneda = "eur",
  tasa: number | null = null,
): string {
  const lineas = items.map((x) => {
    // Ni el color pendiente ni la marca de talla única entran al mensaje: son
    // vocabulario interno, y en un pedido leído por una persona solo confunden.
    const partes = [
      `${x.cantidad}x ${x.producto}`,
      colorVisible(x.color),
      x.talla === SIN_TALLA ? "talla única" : `talla ${x.talla}`,
    ].filter(Boolean);

    // El precio va en la moneda que escogió: es lo que va a pagar.
    const linea = precioVisible(
      x.cantidad * Number(x.precio_usd),
      x.cantidad * Number(x.precio_bs ?? x.precio_usd),
      moneda,
      tasa,
    );
    return `• ${partes.join(" · ")} — ${linea}`;
  });
  return [
    "¡Hola! Quiero pedir:",
    "",
    ...lineas,
    "",
    `Total: ${
      moneda === "bs" && tasa
        ? `Bs ${totalCarrito(items, "bs", tasa).toLocaleString("es-VE", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
        : dinero.format(totalCarrito(items))
    }`,
  ].join("\n");
}

export function enlaceWhatsapp(
  items: ItemCarrito[],
  numero: string,
  moneda: Moneda = "eur",
  tasa: number | null = null,
): string {
  return `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(
    mensajeWhatsapp(items, moneda, tasa),
  )}`;
}
