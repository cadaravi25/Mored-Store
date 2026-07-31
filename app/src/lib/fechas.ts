/**
 * El día del negocio es el de Caracas, no el del servidor.
 *
 * `new Date().toISOString()` da la fecha en UTC. Venezuela está en UTC-4, así
 * que a las 8:00 pm de Caracas para UTC ya es mañana: sin esto, el panel se
 * pondría en cero justo a la hora en que están cerrando el local.
 */

const ZONA = "America/Caracas";

/** Fecha de hoy en Caracas, como aaaa-mm-dd. */
export function diaEnCaracas(momento: Date = new Date()): string {
  // "en-CA" da el formato aaaa-mm-dd, que es el que entiende Postgres.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(momento);
}

/** El desfase de Caracas ese día, como "-04:00". Se consulta en vez de
 *  escribirlo fijo por si alguna vez vuelve a haber horario de verano. */
function desfase(fecha: string): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(`${fecha}T12:00:00Z`));
  const nombre = partes.find((p) => p.type === "timeZoneName")?.value ?? "";
  return nombre.replace("GMT", "") || "+00:00";
}

/** Medianoche de Caracas de ese día, en formato absoluto. */
export function inicioDelDia(fecha: string): string {
  return `${fecha}T00:00:00${desfase(fecha)}`;
}

/** Medianoche del día siguiente: el límite de arriba, sin incluirlo. */
export function finDelDia(fecha: string): string {
  const siguiente = new Date(`${fecha}T12:00:00Z`);
  siguiente.setUTCDate(siguiente.getUTCDate() + 1);
  return inicioDelDia(diaEnCaracas(siguiente));
}

const CON_DIA = new Intl.DateTimeFormat("es-VE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: ZONA,
});

const CORTA = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "short",
  timeZone: ZONA,
});

/** "martes, 28 de julio" a partir de aaaa-mm-dd. */
export function enPalabras(fecha: string): string {
  return CON_DIA.format(new Date(`${fecha}T12:00:00Z`));
}

/** "28 jul" a partir de aaaa-mm-dd. */
export function enCorto(fecha: string): string {
  return CORTA.format(new Date(`${fecha}T12:00:00Z`));
}
