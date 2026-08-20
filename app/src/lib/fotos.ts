/**
 * Cómo se llama una foto dentro del depósito.
 *
 * EL DEPÓSITO NO ACEPTA CUALQUIER NOMBRE
 *
 * Las claves de Supabase Storage rechazan los acentos y los espacios, y
 * escaparlos no arregla nada: el signo de porcentaje también lo rechaza. Y lo
 * hace de dos maneras distintas, las dos malas:
 *
 *   "Marrón"       -> Invalid key, la subida falla y al menos se nota.
 *   "Azul marino"  -> se sube como "Azul%20marino" y da 400 al pedirla.
 *
 * El segundo caso es el peligroso: la foto parece cargada, la columna guarda
 * su dirección, y la prenda sale en la tienda con el cuadro roto. Así se
 * rompieron 80 fotos de Swim antes de que alguien las mirara una por una.
 *
 * Por eso el nombre se limpia: fuera acentos y fuera todo lo que no sea letra
 * o número. La marca de tiempo va detrás para que la foto vieja no se quede
 * pegada en la caché del navegador cuando la reemplacen.
 */

/** El color convertido en algo que el depósito sí acepta. */
export function enRuta(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "color"
  );
}

/** La clave completa de la foto de un color. */
export function rutaDeFoto(
  productoId: string,
  color: string,
  extension: string,
): string {
  const limpia = enRuta(extension) || "jpg";
  return `${productoId}/${enRuta(color)}-${Date.now()}.${limpia}`;
}
