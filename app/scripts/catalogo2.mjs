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
  // -------------------------------------------------------------------- Tops
  "Tops/Modelo 1": {
    externo: "55/0169",
    // Estos colores estaban puestos con la foto de surtido del vídeo, porque
    // no había ninguna suelta. Ahora sí las hay, salvo la del negro.
    colores: {
      Blanco: ["IMG_8128.jpg"],
      Azul: ["IMG_8129.jpg"],
      Burdeos: ["IMG_8153.JPG"],
      Marrón: ["IMG_8157.JPG"],
      Gris: ["IMG_8176.JPG"],
    },
  },
  "Tops/modelo 6": {
    externo: "55/0163",
    colores: {
      Burdeos: ["IMG_8206.jpg"],
      Negro: ["IMG_8207.jpg"],
      "Azul marino": ["IMG_8208.jpg"],
    },
  },
  // ------------------------------------------------------------------ Faldas
  "Faldas/Modelo 1": {
    externo: "35/0107",
    colores: {
      Negro: ["IMG_8233.jpg"],
      Rosado: ["IMG_8234.jpg"],
      Blanco: ["IMG_8235.jpg"],
      Fucsia: ["IMG_8236.jpg"],
    },
  },
  "Faldas/Modelo 2": {
    externo: "35/0093",
    colores: { Negro: ["IMG_8231.jpg"], Blanco: ["IMG_8232.jpg"] },
  },
  "Faldas/Modelo 3": {
    externo: "35/0089",
    colores: { Rojo: ["IMG_8229.jpg"], Negro: ["IMG_8230.jpg"] },
  },
  // ---------------------------------------------------------------- Franelas
  "Franelas/modelo 1": {
    externo: "55/0175",
    colores: {
      Negro: ["IMG_8194.jpg"],
      Marrón: ["IMG_8195.jpg"],
      Rosado: ["IMG_8198.jpg"],
      Blanco: ["IMG_8199.jpg"],
      // Uno claro y otro oscuro; la paleta tiene un solo gris.
      Gris: ["IMG_8200.jpg", "IMG_8201.jpg"],
      "Azul marino": ["IMG_8202.jpg"],
      Rojo: ["IMG_8203.jpg"],
      Beige: ["IMG_8204.jpg"],
    },
  },
  "Franelas/modelo 2": {
    externo: "55/0189",
    colores: {
      Lila: ["IMG_8177.jpg"],
      Burdeos: ["IMG_8178.jpg"],
      Negro: ["IMG_8180.jpg"],
      Gris: ["IMG_8181.jpg"],
    },
  },
  "Franelas/modelo 3": {
    externo: "35/0181",
    // Dos estampados distintos sobre la misma franela negra.
    colores: {
      Negro: ["IMG_8182.jpg", "IMG_8184.jpg"],
      Blanco: ["IMG_8183.jpg"],
      Beige: ["IMG_8191.jpg"],
    },
  },
  "Franelas/modelo 4": {
    externo: "35/0188",
    // Cuatro estampados sobre la misma franela beige: no son cuatro colores,
    // es un color con cuatro diseños. Van todas al beige.
    colores: {
      Beige: ["IMG_8186.jpg", "IMG_8187.jpg", "IMG_8188.jpg", "IMG_8189.jpg"],
    },
  },
  // ----------------------------------------------------------------- Leggins
  "Leggins/Modelo 1": {
    externo: "35/0125",
    // Ninguna de las tres es el negro que ya estaba: ese se queda con la suya.
    colores: {
      Marrón: ["IMG_8247.jpg"],
      Burdeos: ["IMG_8248.jpg"],
      Verde: ["IMG_8249.jpg"],
    },
  },
  "Leggins/Modelo 2": {
    externo: "35/0119",
    colores: {
      Celeste: ["IMG_8243.jpg"],
      Rosado: ["IMG_8244.jpg"],
      Lila: ["IMG_8245.jpg"],
      Beige: ["IMG_8246.jpg"],
    },
  },
  "Leggins/Modelo 3": {
    externo: "35/0117",
    // El lila solo sale en el surtido de la 8241, tendido junto al rosa.
    colores: {
      Azul: ["IMG_8253.jpg"],
      Burdeos: ["IMG_8254.jpg"],
      Rojo: ["IMG_8255.jpg"],
      "Azul marino": ["IMG_8256.jpg"],
      Rosado: ["IMG_8252.jpg"],
      Gris: ["IMG_8257.jpg"],
      Lila: ["IMG_8241.jpg"],
    },
  },
  "Leggins/Modelo 4": {
    externo: "35/0159",
    colores: { Celeste: ["IMG_8259.jpg"] },
  },
  "Leggins/Modelo 5": {
    externo: "35/0164",
    colores: {
      Azul: ["IMG_8261.jpg"],
      Marrón: ["IMG_8262.jpg"],
      Burdeos: ["IMG_8263.jpg"],
    },
  },
  "Leggins/Modelo 6": {
    externo: "35/0129",
    colores: {
      Negro: ["IMG_8265.jpg"],
      Marrón: ["IMG_8266.jpg"],
      Blanco: ["IMG_8267.jpg"],
    },
  },
  "Leggins/Modelo 7": {
    externo: "35/0134",
    colores: { Gris: ["IMG_8270.jpg", "IMG_8271.jpg"] },
  },
  "Leggins/Modelo 8": {
    externo: "35/0137",
    colores: {
      Morado: ["IMG_8272.jpg"],
      Amarillo: ["IMG_8273.jpg"],
      Gris: ["IMG_8274.jpg"],
    },
  },
  "Leggins/Modelo 9": {
    externo: "35/0141",
    // El lila y el celeste que la prenda ya tenía no aparecen en estas fotos:
    // se quedan con la del vídeo.
    colores: {
      Morado: ["IMG_8281.jpg"],
      Burdeos: ["IMG_8282.jpg"],
      Amarillo: ["IMG_8283.jpg"],
      Rosado: ["IMG_8284.jpg"],
    },
  },
  "Leggins/modelo 10": {
    externo: "35/0150",
    colores: { "Azul marino": ["IMG_8286.jpg", "IMG_8287.jpg"] },
  },
  "Leggins/modelo 11": {
    externo: "35/0155",
    colores: {
      Gris: ["IMG_8276.jpg"],
      Beige: ["IMG_8278.jpg"],
      Negro: ["IMG_8279.jpg"],
    },
  },
  "Leggins/modelo 12": {
    externo: "35/0177",
    colores: { Negro: ["IMG_8290.jpg", "IMG_8291.jpg"] },
  },
  "Leggins/Modelo 13": {
    externo: "35/0146",
    colores: { Burdeos: ["IMG_8300.jpg"], Gris: ["IMG_8301.jpg"] },
  },
  "Leggins/modelo 14": {
    externo: "35/0169",
    colores: {
      // Uno claro y otro oscuro; la paleta tiene un solo gris.
      Gris: ["IMG_8295.jpg", "IMG_8296.jpg"],
      Morado: ["IMG_8298.jpg"],
      Rosado: ["IMG_8299.jpg"],
      Negro: ["IMG_8294.jpg"],
    },
  },
  // ------------------------------------------------------------- Conjuntos 2
  // En estas carpetas los archivos se llaman "Captura de pantalla 2026-08-24 a
  // la(s) 11.08.34 p. m..png", así que las fotos se piden por su posición.
  // La primera de cada carpeta es siempre la tarjeta de la tienda, la que dice
  // qué prenda es; las siguientes son las fotos buenas.
  "conjuntos 2/modelo 51": {
    externo: "48/0141",
    colores: { "Azul marino": [2] },
  },
  "conjuntos 2/modelo 52": {
    externo: "48/0109",
    colores: { Marrón: [2] },
  },
  "conjuntos 2/modelo 53": {
    externo: "55/0105",
    colores: { Gris: [2], Amarillo: [3] },
  },
  "conjuntos 2/modelo 54": {
    externo: "55/0049",
    colores: { Negro: [2, 3] },
  },
  "conjuntos 2/modelo 55": {
    externo: "55/0013",
    colores: {
      Rosado: [2],
      Burdeos: [3],
      Negro: [4],
      "Azul marino": [5],
      Gris: [6],
    },
  },
  "conjuntos 2/modelo 56": {
    externo: "55/0041",
    colores: { Negro: [2, 3] },
  },
  "conjuntos 2/modelo 57": {
    externo: "55/0061",
    colores: { Negro: [2], Burdeos: [3, 4] },
  },
  "conjuntos 2/modelo 58": {
    externo: "48/0121",
    colores: { Rojo: [2, 3] },
  },
  "conjuntos 2/modelo 59": {
    externo: "55/0045",
    colores: { Negro: [2, 3] },
  },
  "conjuntos 2/modelo 60": {
    externo: "48/0101",
    colores: { Rojo: [2], Marrón: [3], Negro: [4] },
  },
  "conjuntos 2/modelo 61": {
    externo: "55/0039",
    colores: { Negro: [2] },
  },
  "conjuntos 2/modelo 62": {
    externo: "55/0077",
    colores: { Negro: [2, 3] },
  },
  "conjuntos 2/modelo 63": {
    externo: "48/0201",
    colores: { Celeste: [2, 3] },
  },
  "conjuntos 2/modelo 64": {
    externo: "48/0185",
    colores: { Blanco: [2], Amarillo: [3] },
  },
  "Conjuntos/Modelo 1": {
    externo: "48/0059",
    colores: { Fucsia: [2, 3] },
  },
  "Conjuntos/modelo 2": {
    externo: "48/0157",
    colores: { "Azul marino": [2], Burdeos: [3] },
  },
  "Conjuntos/modelo 3": {
    externo: "55/0056",
    colores: { Negro: [2, 3] },
  },
  "Conjuntos/modelo 4": {
    externo: "48/0087",
    colores: { Negro: [2] },
  },
  "Conjuntos/modelo 5": {
    externo: "48/0173",
    colores: { Azul: [2], "Verde oscuro": [3] },
  },
  "Conjuntos/modelo 6": {
    externo: "55/0030",
    colores: { Burdeos: [2], Negro: [3], Crema: [4] },
  },
  "Conjuntos/modelo 7": {
    externo: "55/0078",
    colores: { Burdeos: [2], Rosado: [3] },
  },
  "Conjuntos/modelo 8": {
    externo: "48/0075",
    colores: { Verde: [2], Negro: [3], Morado: [4] },
  },
  "Conjuntos/modelo 9": {
    externo: "48/0125",
    colores: { "Marrón": [2], Negro: [3], Blanco: [4] },
  },
  "Conjuntos/modelo 10": {
    externo: "55/0025",
    colores: { "Azul marino": [2], Negro: [3] },
  },
  "Conjuntos/Modelo 11": {
    externo: "55/0050",
    colores: { "Azul marino": [2, 3] },
  },
  // Las fotos 3 y 4 son otro corte (manga corta, una con cierre): no se tocan
  // hasta que Carlos diga si son de esta prenda.
  "Conjuntos/modelo 12": {
    externo: "48/0062",
    colores: { Lila: [2] },
  },
  "Conjuntos/modelo 13": {
    externo: "55/0058",
    colores: { Burdeos: [2, 3] },
  },
  "Conjuntos/modelo 14": {
    externo: "55/0004",
    colores: { "Marrón": [2], Negro: [3], Burdeos: [4] },
  },
  // La foto de frente viene con el rótulo de la marca china encima, así que se
  // queda fuera: mejor solo la de espaldas, que está limpia.
  "Conjuntos/modelo 15": {
    externo: "48/0149",
    colores: { Rosado: [3] },
  },
  "Conjuntos/modelo 16": {
    externo: "55/0102",
    colores: { Morado: [2], "Azul marino": [3] },
  },
  "Conjuntos/modelo 17": {
    externo: "48/0071",
    colores: { "Marrón": [2, 3] },
  },
  "Conjuntos/modelo 18": {
    externo: "55/0073",
    colores: { Menta: [2, 3] },
  },
  "Conjuntos/modelo 19": {
    externo: "48/0093",
    colores: { "Azul marino": [2] },
  },
  "Conjuntos/modelo 20": {
    externo: "48/0067",
    colores: { Turquesa: [2, 3] },
  },
  "Conjuntos/modelo 21": {
    externo: "48/0177",
    colores: { Azul: [2, 3] },
  },
  "Conjuntos/modelo 22": {
    externo: "48/0097",
    colores: { Burdeos: [2], Negro: [3], "Azul marino": [4] },
  },
  // Aquí la captura de la tienda no es la primera: va en medio.
  "Conjuntos/modelo 23": {
    externo: "48/0145",
    colores: { Negro: [1, 3] },
  },
  "Conjuntos/modelo 24": {
    externo: "48/0104",
    colores: { Negro: [2] },
  },
  "Conjuntos/modelo 25": {
    externo: "55/0101",
    colores: { "Azul marino": [2, 3] },
  },
  "Conjuntos/modelo 26": {
    externo: "55/0082",
    colores: { Amarillo: [3], Rosado: [2], Burdeos: [4], Celeste: [5] },
  },
  "Conjuntos/modelo 27": {
    externo: "55/0010",
    colores: {
      Azul: [2],
      Blanco: [3],
      "Azul marino": [4],
      Rojo: [5],
      "Marrón": [6],
    },
  },
  "Conjuntos/modelo 28": {
    externo: "55/0027",
    colores: { "Marrón": [2, 3] },
  },
  "Conjuntos/modelo 29": {
    externo: "55/0089",
    colores: { Blanco: [2, 3] },
  },
  // La única carpeta sin captura de la tienda: seis fotos y ninguna pista. Va
  // emparejada por lo que se ve (top de espalda descubierta y minishorts de
  // cintura alta), pero conviene que Carlos la mire.
  "Conjuntos/modelo 30": {
    externo: "55/0085",
    colores: {
      Blanco: [2],
      "Marrón": [3],
      Azul: [4],
      Burdeos: [5],
      Gris: [6],
    },
  },
  "Conjuntos/modelo 31": {
    externo: "55/0093",
    colores: { "Azul marino": [2, 3] },
  },
  "Conjuntos/modelo 32": {
    externo: "55/0021",
    colores: {
      "Azul marino": [2],
      Rosado: [3],
      "Verde oscuro": [4],
      Gris: [5],
    },
  },
  "Conjuntos/modelo 33": {
    externo: "55/0097",
    colores: { Beige: [2] },
  },
  "Conjuntos/modelo 34": {
    externo: "48/0169",
    colores: { Negro: [2, 3] },
  },
  "Conjuntos/modelo 35": {
    externo: "48/0133",
    colores: { "Marrón": [2, 3] },
  },
  "Conjuntos/modelo 36": {
    externo: "48/0161",
    colores: { "Azul marino": [2, 3] },
  },
  "Conjuntos/modelo 37": {
    externo: "48/0085",
    colores: { Rojo: [2] },
  },
  "Conjuntos/modelo 38": {
    externo: "48/0153",
    colores: { "Azul marino": [2] },
  },
  "Conjuntos/modelo 39": {
    externo: "48/0113",
    colores: { Azul: [2, 3] },
  },
  "Conjuntos/Modelo 40": {
    externo: "48/0195",
    colores: { "Azul marino": [2] },
  },
  "Conjuntos/modelo 41": {
    externo: "48/0137",
    colores: { Rojo: [2, 3] },
  },
  "Conjuntos/modelo 42": {
    externo: "48/0129",
    colores: { Rojo: [2, 3] },
  },
  "Conjuntos/modelo 43": {
    externo: "55/0069",
    colores: { "Azul marino": [2, 3] },
  },
  "Conjuntos/modelo 44": {
    externo: "55/0066",
    colores: { Negro: [2, 3] },
  },
  "Conjuntos/modelo 45": {
    externo: "55/0033",
    colores: { Negro: [2, 3] },
  },
  "Conjuntos/modelo 46": {
    externo: "48/0182",
    colores: { Negro: [2], "Marrón": [3] },
  },
  "Conjuntos/modelo 47": {
    externo: "48/0119",
    colores: { "Azul marino": [2, 3] },
  },
  // La 2 es un primer plano: de portada va la 3, que se ve entera.
  "Conjuntos/modelo 48": {
    externo: "48/0191",
    colores: { Negro: [3, 2], Rosado: [4] },
  },
  "Conjuntos/modelo 49": {
    externo: "48/0081",
    colores: { Negro: [2] },
  },
  // El del surtido de Lau: once colores en la misma pose.
  "Conjuntos/modelo 50": {
    externo: "55/0017",
    colores: {
      Blanco: [2],
      Celeste: [3],
      Rojo: [4],
      Burdeos: [5],
      Negro: [6],
      Amarillo: [7],
      "Marrón": [8],
      Fucsia: [9],
      Morado: [10],
      Rosado: [11],
      Crema: [12],
    },
  },
};
