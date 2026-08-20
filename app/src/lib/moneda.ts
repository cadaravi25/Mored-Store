/**
 * En qué moneda mira los precios quien está en la tienda.
 *
 * Aquí una prenda no vale lo mismo pagada en divisas que pagada en bolívares.
 * No es una conversión: son dos precios que ellas fijan prenda por prenda. Por
 * eso el interruptor no es una comodidad, es parte del precio, y tiene que
 * estar siempre a la vista.
 *
 * Los dos precios se guardan en euros. El de bolívares se multiplica por la
 * tasa del BCV del día, que llega desde el servidor: si se guardaran bolívares
 * ya calculados, el número caducaría cada mañana.
 */

export type Moneda = "eur" | "bs";

const LLAVE = "mored-moneda";

/**
 * Divisas por defecto.
 *
 * Es el precio más bajo de los dos y el que la mayoría busca. Quien paga en
 * bolívares toca el interruptor una vez y la tienda se lo recuerda.
 */
export const MONEDA_POR_DEFECTO: Moneda = "eur";

export function leerMoneda(): Moneda {
  if (typeof window === "undefined") return MONEDA_POR_DEFECTO;
  return window.localStorage.getItem(LLAVE) === "bs" ? "bs" : MONEDA_POR_DEFECTO;
}

export function ponerMoneda(m: Moneda) {
  window.localStorage.setItem(LLAVE, m);
  // El localStorage solo avisa a las OTRAS pestañas, y aquí hace falta que
  // todas las tarjetas de ESTA se enteren.
  window.dispatchEvent(new CustomEvent("moneda"));
}

const euros = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "EUR",
});

const bolivares = new Intl.NumberFormat("es-VE", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/**
 * El precio como se lee en pantalla.
 *
 * Sin tasa no se puede dar un precio en bolívares, y poner uno inventado sería
 * peor que no ponerlo: se cae al de divisas, que siempre es cierto.
 */
export function precioVisible(
  precioEur: number,
  precioBsBase: number,
  moneda: Moneda,
  tasa: number | null,
): string {
  if (moneda === "bs" && tasa) {
    return `Bs ${bolivares.format(Number(precioBsBase) * tasa)}`;
  }
  return euros.format(Number(precioEur));
}
