/**
 * Qué carpeta de la carpeta "Catálogo" es qué prenda, y qué foto es de qué
 * color.
 *
 * CÓMO SE EMPAREJA
 *
 * Carlos dejó una carpeta por prenda y, dentro, además de las fotos buenas,
 * una captura de la prenda tal como se ve hoy en la tienda. Esa captura es la
 * que dice de qué prenda se trata: lleva el nombre, la descripción y el
 * precio, así que no hay que adivinar contra un catálogo de trescientas.
 *
 * La captura no se sube. Se reconoce sola porque mide 1320x2868, la pantalla
 * del teléfono, mientras que las fotos de producto rondan el 0,75 de ancho
 * entre alto. El guion la descarta por esa proporción y avisa de lo que
 * descarta, para que no se cuele una foto buena por error.
 *
 * POR QUÉ ESTÁ ESCRITO A MANO
 *
 * Lo mismo que en los enterizos: el detector de color no da. Un beige sobre
 * piel se confunde con la piel, y un negro sobre fondo oscuro desaparece.
 * Equivocarse aquí no se ve hasta que llega la clienta.
 */

/** El corte que separa una captura de pantalla de una foto de producto. */
export const CAPTURA = 0.55;

/**
 * Carpeta -> prenda.
 *
 * `externo` es el id que trae la prenda de su origen. `colores` dice, por cada
 * color, sus fotos en orden: la primera es la principal y las demás quedan de
 * galería. Un color que no exista todavía se crea con las mismas tallas y
 * precios que los que la prenda ya tenía.
 *
 * `renombrar` es para los colores que entraron mal desde el vídeo.
 */
export const PRENDAS = {
  // -------------------------------------------------------------- Accesorios
  "Accesorios/Bandana": {
    externo: "48/0003",
    // Entró sin color porque la captura del vídeo no lo decía. Se venden en
    // bolsa surtida, que es lo que enseña la foto.
    renombrar: { "Por definir": "Multicolor" },
    colores: { Multicolor: ["IMG_7701.jpg", "IMG_7704.jpg"] },
  },
  "Accesorios/Calentadores 1": {
    externo: "48/0006",
    // La del surtido va de principal: el color registrado es Multicolor y la
    // del par blanco haría creer que solo hay blanco.
    colores: { Multicolor: ["IMG_7707.jpg", "IMG_7706.jpg"] },
  },
  "Accesorios/Calentadores 2": {
    externo: "48/0008",
    colores: { Multicolor: ["IMG_7705.jpg", "IMG_7709.jpg"] },
  },
  "Accesorios/Faja": {
    externo: "48/0012",
    // La que no salía en la tienda por no tener foto. Ya tiene cuatro, y tres
    // colores: el beige y el rosado no estaban registrados.
    colores: {
      Negro: ["IMG_7711.AVIF", "IMG_7710.AVIF"],
      Beige: ["IMG_7712.AVIF"],
      Rosado: ["IMG_7713.jpg"],
    },
  },
  "Accesorios/Guantes 1": {
    externo: "48/0021",
    colores: { Negro: ["IMG_7714.jpg", "IMG_7715.jpg"] },
  },
  "Accesorios/Guantes 2": {
    externo: "48/0025",
    colores: { Negro: ["IMG_7716.jpg"] },
  },
};
