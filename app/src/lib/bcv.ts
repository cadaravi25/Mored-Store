/**
 * Tasa oficial del BCV.
 *
 * Mored cobra en bolívares convirtiendo con la tasa del EURO del BCV, así que
 * la del euro es la que importa para vender; la del dólar se guarda para
 * referencia y para calcular el diferencial.
 *
 * LO QUE HAY QUE RESPETAR: el BCV publica cada tarde la tasa con FECHA VALOR
 * del próximo día hábil. El viernes por la tarde ya está publicada la del
 * lunes, y desde el sábado es la que todo el mundo aplica, porque el fin de
 * semana no hay tasa propia.
 *
 * Por eso se lee del sitio del BCV y no de un intermediario: el sitio dice la
 * fecha valor, que es el dato que decide desde cuándo rige. Los intermediarios
 * publican el número sin esa fecha, o con la del día en que lo copiaron.
 */

const SITIO_BCV = "https://www.bcv.org.ve/";

const RESPALDO = {
  usd: "https://ve.dolarapi.com/v1/dolares/oficial",
  eur: "https://ve.dolarapi.com/v1/euros/oficial",
};

export interface Cotizacion {
  tasa: number;
  fechaEfectiva: string; // aaaa-mm-dd, la fecha valor
}

export interface FilaTasa {
  fecha: string;
  bs_por_usd: number | null;
  bs_por_eur: number | null;
  fuente: string;
}

interface Lectura {
  usd: Cotizacion | null;
  eur: Cotizacion | null;
  fuente: string;
}

/** "861,18672650" y "1.234,56" son números válidos aquí. */
function aNumero(texto: string): number | null {
  const n = Number(texto.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Fecha en Caracas de una marca de tiempo, o de ahora mismo. */
function diaCaracas(iso?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(iso ? new Date(iso) : new Date());
}

/** El valor que el BCV muestra en el recuadro de esa moneda. */
function valorDe(html: string, id: string): number | null {
  const i = html.indexOf(`id="${id}"`);
  if (i < 0) return null;
  const bloque = html.slice(i, i + 900);
  const m = bloque.match(/<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/);
  return m ? aNumero(m[1]) : null;
}

async function consultarSitio(): Promise<Lectura | null> {
  try {
    const respuesta = await fetch(SITIO_BCV, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!respuesta.ok) return null;
    const html = await respuesta.text();

    const fechaValor = html.match(
      /Fecha\s*Valor:[\s\S]{0,300}?content="(\d{4}-\d{2}-\d{2})/,
    )?.[1];
    const usd = valorDe(html, "dolar");
    const eur = valorDe(html, "euro");
    if (!fechaValor || (!usd && !eur)) return null;

    return {
      usd: usd ? { tasa: usd, fechaEfectiva: fechaValor } : null,
      eur: eur ? { tasa: eur, fechaEfectiva: fechaValor } : null,
      fuente: "Banco Central de Venezuela",
    };
  } catch {
    return null;
  }
}

async function unaDelRespaldo(url: string): Promise<Cotizacion | null> {
  try {
    const respuesta = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!respuesta.ok) return null;
    const datos = (await respuesta.json()) as {
      promedio?: number;
      fechaActualizacion?: string;
    };
    if (typeof datos.promedio !== "number") return null;
    return {
      tasa: datos.promedio,
      fechaEfectiva: diaCaracas(datos.fechaActualizacion),
    };
  } catch {
    return null;
  }
}

async function consultarRespaldo(): Promise<Lectura | null> {
  const [usd, eur] = await Promise.all([
    unaDelRespaldo(RESPALDO.usd),
    unaDelRespaldo(RESPALDO.eur),
  ]);
  if (!usd && !eur) return null;
  return { usd, eur, fuente: "dolarapi.com" };
}

/** Agrupa por fecha valor. Las dos monedas casi siempre traen la misma, pero
 *  se agrupa igual por si una se publica antes que la otra. */
function volcar(mapa: Map<string, FilaTasa>, lectura: Lectura | null) {
  if (!lectura) return;
  for (const [moneda, cot] of [
    ["bs_por_usd", lectura.usd],
    ["bs_por_eur", lectura.eur],
  ] as const) {
    if (!cot) continue;
    const previa = mapa.get(cot.fechaEfectiva) ?? {
      fecha: cot.fechaEfectiva,
      bs_por_usd: null,
      bs_por_eur: null,
      fuente: lectura.fuente,
    };
    mapa.set(cot.fechaEfectiva, {
      ...previa,
      [moneda]: cot.tasa,
      fuente: lectura.fuente,
    });
  }
}

/**
 * Se consultan las dos fuentes porque dicen cosas distintas y las dos hacen
 * falta:
 *
 *   El sitio del BCV trae la fecha valor, o sea la del PRÓXIMO día hábil desde
 *   las 4 de la tarde. Es la que van a aplicar el sábado.
 *
 *   El respaldo trae la que está rigiendo HOY. Sin él, si nadie abre el
 *   sistema antes de las 4 de la tarde, el día se quedaría sin su propia tasa
 *   guardada.
 *
 * Cuando las dos hablan del mismo día manda el BCV, que es la fuente.
 */
export async function consultarBcv(): Promise<FilaTasa[]> {
  const [sitio, respaldo] = await Promise.all([
    consultarSitio(),
    consultarRespaldo(),
  ]);

  const mapa = new Map<string, FilaTasa>();
  volcar(mapa, respaldo);
  volcar(mapa, sitio); // el segundo pisa al primero
  return [...mapa.values()];
}
