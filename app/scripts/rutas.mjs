/**
 * Cómo se llama una foto dentro del depósito.
 *
 * Es la misma regla que `src/lib/fotos.ts`, escrita otra vez porque estos
 * programas corren fuera de Next y no pueden importar TypeScript. Si cambia
 * una, cambia la otra.
 *
 * Las claves de Supabase Storage rechazan acentos y espacios, y escaparlos no
 * arregla nada porque el porcentaje también lo rechaza. Falla de dos maneras y
 * la segunda es la mala:
 *
 *   "Marrón"       -> Invalid key, la subida falla y al menos se nota.
 *   "Azul marino"  -> se sube como "Azul%20marino" y da 400 al pedirla.
 */

export function enRuta(texto) {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "color"
  );
}

/** La clave completa de la foto de un color. La marca de tiempo evita que la
 *  foto vieja se quede pegada en la caché del navegador al reemplazarla. */
export function rutaDeFoto(productoId, color, extension = "jpg") {
  return `${productoId}/${enRuta(color)}-${Date.now()}.${enRuta(extension) || "jpg"}`;
}
