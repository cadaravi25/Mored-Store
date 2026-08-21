/**
 * Qué carpeta es qué prenda, y qué foto es de qué color.
 *
 * Está aparte porque lo usan dos guiones: el que crea los colores que faltan
 * en el inventario y el que sube las fotos. Si cada uno tuviera su copia,
 * arreglar un color en uno lo dejaría mal en el otro.
 *
 * POR QUÉ ESTÁ ESCRITO A MANO
 *
 * El detector de color acierta bastante, pero no lo suficiente: un enterizo
 * blanco sobre fondo claro lo lee como negro, porque descarta lo muy claro por
 * fondo y se queda con las sombras. Y un azul marino oscuro y un negro se
 * confunden cuando la única diferencia es la luz del estudio.
 *
 * Equivocarse aquí no se ve: la tienda enseña una prenda azul bajo el nombre
 * "Negro" y nadie lo nota hasta que llega la clienta. Así que las carpetas con
 * más de un color se miraron una por una y quedan escritas. Las de un color
 * solo no hacen falta: ahí no hay nada que confundir.
 */

/** Lo que dijo Carlos: carpeta -> captura del vídeo. */
export const PAREJAS = {
  "IMG_7544": "36/0047",
  "IMG_7638": "36/0151",
  "IMG_7647": "36/0015",
  "modelo 1": "36/0004",
  "Modelo 2": "36/0091",
  "modelo 3": "36/0030",
  "modelo 4": "36/0039",
  "modelo 5": "36/0053",
  "modelo 6": "36/0059",
  "modelo 7": "36/0114",
  "modelo 8": "36/0066",
  "modelo 9": "36/0069",
  "modelo 10": "36/0073",
  "modelo 11": "36/0095",
  "modelo 12": "36/0082",
  "modelo 13": "36/0084",
  "modelo 14": "36/0100",
  "modelo 15": "36/0103",
  "modelo 18": "36/0034",
  "Modelo 17": "36/0005",
  "modelo 19": "36/0107",
  "modelo 20": "36/0111",
  "modelo 21": "36/0077",
  "modelo 22": "36/0089",
  "modelo 23": "36/0119",
  "modelo 24": "36/0124",
  "modelo 25": "36/0128",
  "modelo 26": "36/0137",
  "modelo 27": "36/0140",
  "modelo 28": "36/0143",
  "modelo 29": "36/0147",
  "modelo 31": "36/0167",
  "modelo 32": "36/0159",
};

/**
 * Colores que el vídeo nombró mal.
 *
 * El vídeo es el catálogo del proveedor y a veces el nombre no es el de la
 * prenda. Renombrar en vez de crear otro color evita dejar huérfanas las
 * ventas y los movimientos de stock que ya cuelgan de ese color.
 */
export const RENOMBRES = {
  // Carlos, mirando la carpeta: "3 colores, azul, vinotinto y negro".
  "modelo 14|Morado": "Burdeos",
  // Entró sin color porque el vídeo no lo decía. Las fotos son rojo y negro.
  "modelo 13|Por definir": "Rojo",
};

/**
 * Carpeta -> color -> las fotos de ese color, la primera es la principal.
 *
 * Manda sobre el reparto automático: lo que esté aquí no se adivina. Un color
 * que aparezca aquí y no esté en el inventario se crea, con las mismas tallas
 * y precios que los colores que la prenda ya tenía.
 */
export const COLORES = {
  "modelo 1": {
    Turquesa: ["IMG_7521.WEBP", "IMG_7522.PNG"],
    Fucsia: ["IMG_7523.JPG"],
    // Un caqui grisáceo que la paleta no tiene. Beige es la familia correcta.
    Beige: ["IMG_7524.JPG"],
  },
  "modelo 3": {
    Morado: ["IMG_7538.jpg"],
    Blanco: ["IMG_7532.PNG"],
    Rosado: ["IMG_7533.PNG", "IMG_7534.PNG"],
    Celeste: ["IMG_7536.PNG"],
  },
  "modelo 4": {
    Celeste: ["IMG_7542.WEBP"],
    Gris: ["IMG_7543.WEBP"],
  },
  "modelo 5": {
    Rojo: ["IMG_7545.JPG", "IMG_7546.JPG"],
    Burdeos: ["IMG_7547.JPG"],
  },
  "modelo 6": {
    Rojo: ["IMG_7551.jpg", "IMG_7552.jpg"],
    Marrón: ["IMG_7553.jpg", "IMG_7554.jpg"],
  },
  "modelo 7": {
    // Las dos negras se distinguen solo por el ribete, verde en una y blanco
    // en la otra. La prenda es la misma y el color es el mismo.
    Negro: ["IMG_7567.jpg", "IMG_7559.AVIF"],
    "Azul marino": ["IMG_7565.JPG"],
    Marrón: ["IMG_7568.WEBP"],
  },
  "modelo 8": {
    Burdeos: ["IMG_7569.JPG"],
    "Azul marino": ["IMG_7571.jpg"],
    Negro: ["IMG_7572.jpg"],
    Azul: ["IMG_7573.JPG"],
  },
  "modelo 9": {
    Rojo: ["IMG_7575.JPG", "IMG_7574.JPG"],
    Azul: ["IMG_7576.WEBP"],
    Negro: ["IMG_7577.WEBP"],
  },
  "modelo 10": {
    Negro: ["IMG_7578.jpg"],
    Morado: ["IMG_7579.JPG", "IMG_7580.jpg"],
    Burdeos: ["IMG_7582.JPG"],
  },
  "modelo 11": {
    Fucsia: ["IMG_7597.AVIF", "IMG_7596.JPG"],
    Azul: ["IMG_7599.jpg"],
  },
  "modelo 12": {
    Azul: ["IMG_7586.AVIF", "IMG_7587.AVIF"],
    Negro: ["IMG_7588.AVIF", "IMG_7589.AVIF"],
  },
  "modelo 13": {
    Rojo: ["IMG_7590.jpg"],
    // La unica donde sale la negra es la foto de producto, con las dos
    // prendas juntas. Vale mas que dejarla sin foto: sin foto propia hereda
    // la del primer color, y la tienda enseñaria la roja bajo "Negro".
    Negro: ["IMG_7593.jpg"],
  },
  "modelo 14": {
    Negro: ["IMG_7600.AVIF"],
    Burdeos: ["IMG_7602.jpg", "IMG_7601.jpg"],
    Azul: ["IMG_7603.jpg"],
  },
  "modelo 15": {
    Rojo: ["IMG_7605.AVIF", "IMG_7604.AVIF"],
    Negro: ["IMG_7606.AVIF"],
    // Verde militar. No estaba en la paleta y se agrega con la prenda.
    "Verde oliva": ["IMG_7607.AVIF"],
  },
  "modelo 23": {
    "Azul marino": ["IMG_7610.JPG"],
    Negro: ["IMG_7608.JPG", "IMG_7609.JPG"],
    Rosado: ["IMG_7611.AVIF", "IMG_7612.AVIF"],
    Burdeos: ["IMG_7613.AVIF"],
  },
  "modelo 27": {
    Negro: ["IMG_7621.AVIF", "IMG_7622.AVIF"],
    Celeste: ["IMG_7623.JPG"],
    "Azul marino": ["IMG_7624.JPG"],
  },
  "modelo 28": {
    Negro: ["IMG_7625.JPG"],
    Burdeos: ["IMG_7626.WEBP"],
    "Azul marino": ["IMG_7627.WEBP"],
  },
  "modelo 31": {
    Negro: ["IMG_7640.jpg", "IMG_7639.jpg"],
    Burdeos: ["IMG_7641.jpg"],
    "Azul marino": ["IMG_7642.jpg"],
  },
  "modelo 32": {
    Negro: ["IMG_7646.jpg"],
    "Azul marino": ["IMG_7643.jpg", "IMG_7644.jpg"],
    Burdeos: ["IMG_7645.jpg"],
  },
};

/** Colores que hacen falta y la paleta de la tienda todavía no tiene. */
export const PALETA_NUEVA = [{ nombre: "Verde oliva", hex: "#5f5a2e" }];
