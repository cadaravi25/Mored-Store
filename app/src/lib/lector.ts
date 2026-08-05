/**
 * Lectura de la captura del pedido.
 *
 * Lee SOLO TEXTO: qué prenda, de qué color, en qué talla y cuántas piezas.
 * Los precios NO se leen y no se van a leer. Un precio mal leído corrompe el
 * costeo en silencio, y el costeo es lo que sostiene el margen de todo el
 * negocio. Se escriben a mano, que toma diez segundos por línea.
 *
 * Va contra OpenRouter, que habla el mismo protocolo que OpenAI. Cambiar de
 * modelo, gratis o pago, es cambiar una variable de entorno.
 */

const URL_MODELO = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Modelos a probar, en orden. Los gratuitos de OpenRouter salen de un pool
 * compartido con todo el mundo, así que devuelven 429 cada tanto sin que pase
 * nada raro: hay que reintentar y tener con qué caerse parado. MODELO_LECTOR
 * pone uno de primero, para poder pasar a uno de pago sin tocar el código.
 */
const MODELOS = [
  process.env.MODELO_LECTOR,
  "google/gemma-4-26b-a4b-it:free",
  "openrouter/free",
  "google/gemma-4-31b-it:free",
].filter((m, i, todos): m is string => Boolean(m) && todos.indexOf(m) === i);

const RONDAS = 2;
const ESPERA_MS = 3000;

export interface LineaLeida {
  titulo: string;
  tipo: string | null;
  estilo: string | null;
  talla: string | null;
  piezas: number;
  colores: string[];
}

export interface Vocabulario {
  tipos: string[];
  estilos: string[];
  colores: string[];
}

function instrucciones(v: Vocabulario): string {
  return `Lees capturas de pantalla de pedidos de SHEIN para una tienda de ropa
en Venezuela. Devuelves SOLO datos, sin explicar nada.

Por cada artículo del pedido devuelve un objeto con:

  titulo   el título del producto tal como aparece, aunque venga cortado
  tipo     qué prenda es, escogido de esta lista: ${v.tipos.join(", ")}
  estilo   el detalle del corte, si lo dice, de esta lista: ${v.estilos.join(", ")}
  talla    XS, S, M, L, XL o XXL. null si no aparece
  piezas   cuántas prendas trae ese artículo (ver la regla de abajo)
  colores  los colores, de esta lista: ${v.colores.join(", ")}

REGLA DE LOS PACKS, la más importante:

Un "set de 3 piezas", un "pack x2" o un "combo" NO es una prenda. Son varias
prendas sueltas que se venden por separado. Si el título dice
"Set de 3 piezas Top musera dupe", eso son TRES tops musera dupe:

  tipo: "Top", estilo: "musera dupe", piezas: 3

NUNCA devuelvas "Set", "Pack", "Combo" ni "3 piezas" como tipo ni como estilo.
Esas palabras describen cómo viene empaquetado, no qué prenda es. El tipo es
siempre la prenda suelta.

Si el artículo trae una sola prenda, piezas es 1.
Si un pack trae colores distintos, ponlos todos en colores.
Si un dato no aparece en la captura, devuelve null. No lo inventes.

NO leas precios. No devuelvas ningún precio, costo ni total, aunque aparezcan
en la imagen.

Responde únicamente con un JSON así, sin texto alrededor y sin markdown:

{"articulos":[{"titulo":"...","tipo":"Top","estilo":"musera dupe","talla":"S","piezas":3,"colores":["negro","blanco","rosado"]}]}`;
}

/** El modelo suele envolver el JSON en ```json aunque se le pida que no. */
function extraerJson(texto: string): unknown {
  const limpio = texto
    .replace(/^[\s\S]*?```(?:json)?/i, "")
    .replace(/```[\s\S]*$/, "")
    .trim();
  const candidato = limpio || texto.trim();
  const desde = candidato.indexOf("{");
  const hasta = candidato.lastIndexOf("}");
  if (desde < 0 || hasta < desde) throw new Error("La respuesta no traía JSON.");
  return JSON.parse(candidato.slice(desde, hasta + 1));
}

const TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];

/** Nada de lo que devuelve el modelo se cree sin revisar. */
function sanear(crudo: unknown, v: Vocabulario): LineaLeida[] {
  const lista = (crudo as { articulos?: unknown[] })?.articulos;
  if (!Array.isArray(lista)) return [];

  const enLista = (valor: unknown, opciones: string[]): string | null => {
    if (typeof valor !== "string") return null;
    const limpio = valor.trim().toLowerCase();
    return opciones.find((o) => o.toLowerCase() === limpio) ?? null;
  };

  return lista.flatMap((crudoItem) => {
    const item = crudoItem as Record<string, unknown>;
    const titulo = typeof item.titulo === "string" ? item.titulo.trim() : "";
    if (!titulo) return [];

    const piezas = Math.min(
      Math.max(Math.round(Number(item.piezas) || 1), 1),
      12,
    );
    const colores = Array.isArray(item.colores)
      ? item.colores
          .map((c) => enLista(c, v.colores))
          .filter((c): c is string => c !== null)
      : [];

    const talla = typeof item.talla === "string" ? item.talla.trim().toUpperCase() : "";

    return [
      {
        titulo,
        tipo: enLista(item.tipo, v.tipos),
        estilo: enLista(item.estilo, v.estilos),
        talla: TALLAS.includes(talla) ? talla : null,
        piezas,
        colores,
      },
    ];
  });
}

async function preguntar(
  modelo: string,
  clave: string,
  imagenes: string[],
  vocabulario: Vocabulario,
): Promise<{ texto?: string; ocupado: boolean; fallo?: string }> {
  const respuesta = await fetch(URL_MODELO, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
      "X-Title": "Mored Store",
    },
    body: JSON.stringify({
      model: modelo,
      // Sin creatividad: esto es transcribir, no redactar.
      temperature: 0,
      messages: [
        { role: "system", content: instrucciones(vocabulario) },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Lee los artículos de este pedido. Solo el JSON.",
            },
            ...imagenes.map((url) => ({
              type: "image_url" as const,
              image_url: { url },
            })),
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (respuesta.status === 429) return { ocupado: true };
  if (!respuesta.ok) {
    const cuerpo = await respuesta.text().catch(() => "");
    return { ocupado: false, fallo: `${respuesta.status} ${cuerpo.slice(0, 160)}` };
  }

  const datos = (await respuesta.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return { ocupado: false, texto: datos.choices?.[0]?.message?.content };
}

export async function leerPedido(
  imagenes: string[],
  vocabulario: Vocabulario,
): Promise<LineaLeida[]> {
  const clave = process.env.OPENROUTER_API_KEY;
  if (!clave) throw new Error("Falta la clave de OpenRouter.");

  let ultimoFallo: string | undefined;

  for (let ronda = 0; ronda < RONDAS; ronda++) {
    for (const modelo of MODELOS) {
      const r = await preguntar(modelo, clave, imagenes, vocabulario);
      if (r.ocupado) continue; // ese modelo está saturado: se prueba el siguiente
      if (r.fallo) {
        ultimoFallo = r.fallo;
        continue;
      }
      if (!r.texto) {
        ultimoFallo = "el modelo respondió vacío";
        continue;
      }
      try {
        return sanear(extraerJson(r.texto), vocabulario);
      } catch {
        // Un modelo pequeño a veces contesta con prosa en vez de JSON. No es
        // un error del sistema: se le pregunta al siguiente.
        ultimoFallo = "la respuesta no venía en el formato esperado";
      }
    }
    if (ronda + 1 < RONDAS) {
      await new Promise((listo) => setTimeout(listo, ESPERA_MS));
    }
  }

  throw new Error(
    ultimoFallo
      ? `No se pudo leer la captura: ${ultimoFallo}. Carga las líneas a mano.`
      : "Los modelos gratuitos están saturados en este momento. Prueba en un minuto o carga las líneas a mano.",
  );
}
