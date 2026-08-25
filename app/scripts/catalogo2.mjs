/**
 * Segunda tanda de fotos buenas: la carpeta "Mored 2".
 *
 * Va aparte de catalogo.mjs porque las familias se repiten —hay "short" en las
 * dos tandas— y mezclarlas obligaría a mirar la fecha de cada carpeta para
 * saber cuál es cuál. Separadas, cada una se corre con su tanda y no hay forma
 * de equivocarse.
 *
 * El emparejamiento es el mismo: dentro de cada carpeta hay una captura de la
 * prenda tal como está hoy en la tienda, y esa captura dice de cuál se trata.
 */

export const PRENDAS2 = {
  // ------------------------------------------------------------------ Suéter
  "Sueter/Modelo 1": {
    externo: "35/0025",
    // La segunda enseña la espalda cruzada de la negra, que no estaba.
    colores: { Gris: ["IMG_7787.jpg"], Negro: ["IMG_7788.jpg"] },
  },
  "Sueter/modelo 2": {
    externo: "55/0209",
    colores: {
      Negro: ["IMG_7789.jpg"],
      Azul: ["IMG_7791.jpg"],
      Blanco: ["IMG_7793.jpg"],
      Beige: ["IMG_7795.jpg"],
      Rojo: ["IMG_8215.jpg"],
    },
  },
  "Sueter/Modelo 3": {
    externo: "35/0045",
    colores: { Negro: ["IMG_8216.jpg", "IMG_8217.jpg"] },
  },
  "Sueter/modelo 4": {
    externo: "35/0035",
    colores: { Blanco: ["IMG_8218.jpg", "IMG_8219.jpg"] },
  },
  "Sueter/modelo 5": {
    externo: "35/0041",
    colores: { Blanco: ["IMG_8220.jpg", "IMG_8221.jpg"] },
  },
  // ---------------------------------------------------------------- Sudadera
  Sudadera: {
    externo: "35/0049",
    colores: { Gris: ["IMG_7800.jpg", "IMG_7801.jpg"] },
  },
  // ---------------------------------------------------------------- Enterizo
  Enterizo: {
    externo: "36/0132",
    colores: { Rojo: ["IMG_8304.jpg", "IMG_8305.jpg"] },
  },
  // ------------------------------------------------------------------- Short
  // Las mismas cinco del cargo liso que ya estaban, pero a 1320 px en vez de
  // 750. La captura de esta carpeta es un mensaje escribiendo el nombre de la
  // prenda, no una pantalla de la tienda.
  "Short": {
    externo: "55/0137-liso",
    colores: {
      Marrón: ["IMG_8222.jpg"],
      Celeste: ["IMG_8223.jpg"],
      Rosado: ["IMG_8224.jpg"],
      Negro: ["IMG_8225.jpg"],
      Rojo: ["IMG_8227.jpg"],
    },
  },
};
