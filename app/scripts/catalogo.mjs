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

/**
 * El corte que separa una captura de pantalla de una foto de producto.
 *
 * Las de pantalla completa miden 1320x2868, o sea 0,46. Pero algunas vienen
 * recortadas a la tarjeta y llegan a 0,56, y las fotos de producto no bajan de
 * 0,66. El corte va en medio de esos dos, no pegado a ninguno.
 */
export const CAPTURA = 0.62;

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
  // ----------------------------------------------------------------- Vestido
  "Vestido/modelo 1": {
    externo: "48/0055",
    // Las dos fotos son de surtido: seis colores tendidos juntos, ninguno
    // suelto. No hay forma de darle una foto a cada color, así que se queda en
    // uno. "Por definir" era lo que entró del vídeo.
    renombrar: { "Por definir": "Multicolor" },
    colores: { Multicolor: ["IMG_7730.jpg", "IMG_7731.jpg"] },
  },
  "Vestido/modelo 2": {
    externo: "48/0029",
    colores: {
      "Verde limón": ["IMG_7739.jpg", "IMG_7740.jpg"],
      Amarillo: ["IMG_7741.jpg"],
    },
  },
  "Vestido/modelo 3": {
    externo: "48/0033",
    // La segunda es de surtido, con cinco colores tendidos. Va de galería.
    colores: { Marrón: ["IMG_7746.jpg", "IMG_7747.jpg"] },
  },
  "Vestido/modelo 4": {
    externo: "48/0037",
    colores: { Negro: ["IMG_7749.jpg", "IMG_7748.jpg", "IMG_7750.jpg"] },
  },
  "Vestido/modelo 5": {
    externo: "48/0041",
    colores: { "Verde limón": ["IMG_7752.AVIF", "IMG_7751.AVIF"] },
  },
  "Vestido/modelo 6": {
    externo: "48/0052",
    colores: { Blanco: ["IMG_7753.AVIF", "IMG_7755.jpg"] },
  },
  "Vestido/modelo 7": {
    externo: "48/0047",
    colores: { Azul: ["IMG_7756.AVIF", "IMG_7757.AVIF"] },
  },
  // --------------------------------------------------------------- Chaquetas
  "chaquetas/modelo 1": {
    externo: "35/0065",
    // El .heic no se puede leer, pero Carlos volvió a pasar esa foto en un
    // formato que sí: es la amarilla, y trae los recuadros de detalle que el
    // proveedor le monta encima. Es la única de ese color.
    colores: {
      Rosado: ["IMG_7812.AVIF"],
      Negro: ["IMG_7814.AVIF"],
      Burdeos: ["IMG_7815.AVIF"],
      Marrón: ["IMG_7816.AVIF"],
      Amarillo: ["IMG_7811.jpg"],
    },
  },
  "chaquetas/modelo 2": {
    externo: "35/0080",
    colores: { Blanco: ["IMG_7817.JPG", "IMG_7818.AVIF"] },
  },
  "chaquetas/modelo 3": {
    externo: "35/0061",
    colores: { "Azul marino": ["IMG_7802.jpg", "IMG_7803.jpg"] },
  },
  "chaquetas/modelo 4": {
    externo: "35/0069",
    colores: {
      Burdeos: ["IMG_7819.WEBP"],
      Amarillo: ["IMG_7820.JPG"],
      Rosado: ["IMG_7821.AVIF"],
    },
  },
  "chaquetas/modelo 5": {
    externo: "35/0074",
    // Seis colores con foto propia. El que entró del vídeo como "Por definir"
    // pasa a Negro, que es el de la 7827; los otros cinco se crean.
    renombrar: { "Por definir": "Negro" },
    colores: {
      Negro: ["IMG_7827.JPG", "IMG_7822.AVIF"],
      Fucsia: ["IMG_7823.JPG"],
      Azul: ["IMG_7824.JPG"],
      Marrón: ["IMG_7825.JPG"],
      Blanco: ["IMG_7826.JPG"],
      Beige: ["IMG_7829.AVIF"],
    },
  },
  "chaquetas/modelo 6": {
    externo: "35/0056",
    colores: {
      Lila: ["IMG_7797.jpg"],
      Fucsia: ["IMG_7798.jpg", "IMG_7799.jpg"],
    },
  },
  "chaquetas/modelo 7": {
    externo: "35/0084",
    colores: {
      Negro: ["IMG_7831.jpg", "IMG_7830.jpg"],
      Gris: ["IMG_7832.jpg"],
      Marrón: ["IMG_7833.jpg"],
    },
  },
  // ------------------------------------------------------------------ Shorts
  "short/modelo 1": {
    externo: "55/0109",
    // Solo hay una foto de un color suelto; la otra es el surtido tendido.
    renombrar: { "Por definir": "Verde" },
    colores: { Verde: ["IMG_7848.JPG", "IMG_7847.JPG"] },
  },
  "short/modelo 2": {
    externo: "55/0117",
    colores: {
      Turquesa: ["IMG_7849.JPG"],
      Burdeos: ["IMG_7850.AVIF"],
      Celeste: ["IMG_7851.jpg"],
      Negro: ["IMG_7852.jpg"],
      // Uno claro y otro oscuro, pero la paleta de la tienda tiene un solo
      // gris. Van juntos, con el claro de principal.
      Gris: ["IMG_7853.jpg", "IMG_7854.jpg"],
    },
  },
  // El "Cargo estilo Y2K" de la tienda es este: en la foto que tenía se le ven
  // los cordones colgando del lateral. El modelo 3 es otra prenda, lisa en la
  // pierna, que todavía no está cargada.
  "short/modelo 4": {
    externo: "55/0137",
    colores: { Marrón: ["IMG_7860.JPG"], Negro: ["IMG_7861.AVIF"] },
  },
  // "short/modelo 3" es el mismo corte pero liso en la pierna, sin cordones.
  // Su captura es la del catálogo de WhatsApp, no la de la tienda, porque no
  // está en la tienda. Falta crearlo: hacen falta descripción, tallas y los
  // dos precios. Sus fotos son IMG_7855 (marrón), 7856 (celeste), 7857
  // (rosado), 7858 (negro) y 7859 (rojo).
  "short/modelo 5": {
    externo: "55/0126",
    colores: { "Verde limón": ["IMG_7863.JPG", "IMG_7864.WEBP"] },
  },
  "short/modelo 6": {
    externo: "55/0113",
    colores: { Negro: ["IMG_7865.AVIF", "IMG_7866.AVIF"] },
  },
  "short/modelo 7": {
    externo: "55/0118",
    colores: { Verde: ["IMG_7868.WEBP"] },
  },
  "short/modelo 8": {
    externo: "55/0122",
    colores: {
      "Azul marino": ["IMG_7869.jpg", "IMG_7870.jpg"],
      Rojo: ["IMG_7871.jpg"],
      Azul: ["IMG_7872.jpg"],
      Rosado: ["IMG_7874.jpg"],
    },
  },
  "short/modelo 9": {
    externo: "55/0129",
    renombrar: { "Por definir": "Celeste" },
    colores: {
      Celeste: ["IMG_7878.jpg", "IMG_7875.jpg"],
      Rosado: ["IMG_7876.jpg"],
      Gris: ["IMG_7879.jpg"],
      Verde: ["IMG_7882.jpg"],
    },
  },
  "short/modelo 10": {
    externo: "55/0133",
    renombrar: { "Por definir": "Negro" },
    colores: {
      Negro: ["IMG_7884.jpg", "IMG_7883.jpg"],
      "Azul marino": ["IMG_7885.jpg"],
      Rojo: ["IMG_7886.jpg"],
    },
  },
  // -------------------------------------------------------------------- Tops
  "top/modelo 1": {
    externo: "55/0145",
    colores: { Celeste: ["IMG_7905.AVIF", "IMG_7906.AVIF"] },
  },
  "top/modelo 2": {
    externo: "55/0141",
    colores: {
      Rojo: ["IMG_7900.AVIF", "IMG_7901.AVIF"],
      Negro: ["IMG_7902.AVIF", "IMG_7903.AVIF"],
    },
  },
  "top/modelo 3": {
    externo: "55/0149",
    colores: { Negro: ["IMG_7918.AVIF", "IMG_7920.jpg"] },
  },
  "top/modelo 4": {
    externo: "55/0157",
    colores: { Negro: ["IMG_7921.JPG"], Blanco: ["IMG_7922.jpg"] },
  },
  "top/modelo 5": {
    externo: "55/0193",
    colores: { Blanco: ["IMG_7924.jpg", "IMG_7925.jpg"] },
  },
  "top/modelo 6": {
    externo: "55/0161",
    renombrar: { "Por definir": "Celeste" },
    colores: {
      Celeste: ["IMG_7969.jpg"],
      Rosado: ["IMG_7972.jpg"],
      Blanco: ["IMG_7973.jpg"],
      // La última es el surtido tendido; ahí sale también un azul marino que
      // no tiene foto propia, así que ese color no se crea.
      Negro: ["IMG_7974.jpg", "IMG_7975.jpg"],
    },
  },
  "top/modelo 7": {
    externo: "35/0004",
    colores: {
      Negro: ["IMG_7952.jpg"],
      Blanco: ["IMG_7953.jpg"],
      Rosado: ["IMG_7954.jpg"],
      Amarillo: ["IMG_7955.jpg"],
      Celeste: ["IMG_7956.jpg"],
      Azul: ["IMG_7957.jpg"],
      Morado: ["IMG_7958.jpg"],
    },
  },
  "top/modelo 8": {
    externo: "55/0153",
    // IMG_7914 es la captura, recortada a la tarjeta. No se sube.
    renombrar: { "Por definir": "Negro" },
    colores: {
      Negro: ["IMG_7948.jpg"],
      Blanco: ["IMG_7940.jpg"],
      Morado: ["IMG_7941.jpg"],
      Lila: ["IMG_7942.jpg"],
      Rosado: ["IMG_7943.jpg"],
      Celeste: ["IMG_7944.jpg"],
      Verde: ["IMG_7945.jpg"],
      Azul: ["IMG_7946.jpg"],
      Marrón: ["IMG_7947.jpg"],
    },
  },
  "top/modelo 9": {
    externo: "35/0017",
    colores: { Azul: ["IMG_7933.AVIF", "IMG_7934.AVIF"] },
  },
  "top/modelo 10": {
    externo: "55/0198",
    colores: {
      Rojo: ["IMG_7949.jpg"],
      Negro: ["IMG_7950.jpg"],
      Blanco: ["IMG_7951.jpg"],
    },
  },
  "top/modelo 11": {
    externo: "55/0178",
    colores: { Rojo: ["IMG_7935.AVIF"] },
  },
  "top/modelo 12": {
    externo: "55/0182",
    // IMG_7917 es la captura, recortada a la tarjeta. No se sube.
    colores: {
      Burdeos: ["IMG_8010.jpg"],
      Lila: ["IMG_8016.jpg"],
      Celeste: ["IMG_8011.jpg"],
      Beige: ["IMG_8013.jpg"],
      Negro: ["IMG_8014.jpg"],
      Amarillo: ["IMG_8015.jpg"],
    },
  },
  "top/modelo 13": {
    externo: "35/0030",
    colores: { Negro: ["IMG_7936.JPG", "IMG_7937.JPG", "IMG_7938.AVIF"] },
  },
};
