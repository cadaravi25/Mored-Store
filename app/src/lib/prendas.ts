/**
 * Las marcas que lleva una prenda que entró a medias.
 *
 * Vienen del catálogo de Treinta, que guarda un solo número de stock por
 * producto y mete las tallas dentro del texto de la descripción. Lo que no se
 * puede saber al importar queda marcado y se completa contándolo en el panel.
 *
 * Están acá y no repetidas en cada pantalla porque son la misma palabra
 * escrita en la base: si algún día cambia, tiene que cambiar en un solo sitio.
 */

/** La prenda tiene tallas pero todavía no se sabe cuántas de cada una. */
export const SIN_DEFINIR = "POR DEFINIR";

/** El accesorio no tiene talla y nunca la va a tener. Esto no está pendiente. */
export const SIN_TALLA = "ÚNICA";

/** Todavía no se sabe de qué color es. */
export const COLOR_PENDIENTE = "Por definir";

/**
 * El color, o nada si aún no se sabe.
 *
 * En el panel la marca se enseña, porque es trabajo por hacer. En la tienda
 * no: quien compra no tiene por qué leer las notas internas de la tienda.
 */
export function colorVisible(color: string): string | null {
  return color === COLOR_PENDIENTE ? null : color;
}

/** La talla como se le dice a la clienta. */
export function tallaVisible(talla: string): string {
  return talla === SIN_TALLA ? "talla única" : talla;
}
