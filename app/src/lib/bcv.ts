/**
 * Tasa oficial del BCV.
 *
 * Mored cobra en bolívares convirtiendo con la tasa del EURO del BCV, así que
 * la del euro es la que importa para vender; la del dólar se guarda para
 * referencia y para calcular el diferencial.
 *
 * Detalle que hay que respetar: el BCV publica a las 4 p.m. la tasa que rige
 * el día siguiente. Por eso se guarda por FECHA EFECTIVA y no por fecha de
 * consulta: lo que rige hoy no se puede mover a media tarde porque a alguien
 * le tocó cobrar a las 5.
 */

const FUENTES = {
  usd: "https://ve.dolarapi.com/v1/dolares/oficial",
  eur: "https://ve.dolarapi.com/v1/euros/oficial",
};

interface RespuestaDolarApi {
  promedio?: number;
  fechaActualizacion?: string;
}

export interface Cotizacion {
  tasa: number;
  fechaEfectiva: string; // YYYY-MM-DD en horario de Caracas
}

/** Fecha efectiva en Caracas de una marca de tiempo ISO. */
function diaCaracas(iso: string | undefined): string {
  const fecha = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

async function consultar(url: string): Promise<Cotizacion | null> {
  try {
    const respuesta = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!respuesta.ok) return null;
    const datos = (await respuesta.json()) as RespuestaDolarApi;
    if (typeof datos.promedio !== "number") return null;
    return {
      tasa: datos.promedio,
      fechaEfectiva: diaCaracas(datos.fechaActualizacion),
    };
  } catch {
    // Sin conexión o fuente caída: se devuelve null y la app sigue con la
    // última tasa guardada. Nunca debe impedir cobrar.
    return null;
  }
}

export async function consultarBcv(): Promise<{
  usd: Cotizacion | null;
  eur: Cotizacion | null;
}> {
  const [usd, eur] = await Promise.all([
    consultar(FUENTES.usd),
    consultar(FUENTES.eur),
  ]);
  return { usd, eur };
}
