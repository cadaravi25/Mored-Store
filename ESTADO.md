# Mored Store: dónde va todo

Documento de traspaso. Lo que hace falta saber para retomar sin releer el
historial. Se actualiza cuando algo cambia de estado, no cada día.

## Cómo se levanta

```bash
cd app && npm run dev -- --port 4500
```

Para verlo desde el iPad, en la misma Wi-Fi: `http://192.168.0.114:4500`. Esa
dirección la da el router por DHCP y cambia si se reinicia. **Proton VPN bloquea
la red local**: si el iPad no entra, hay que activar "Allow LAN connections" en
Proton, sin apagar la VPN.

## Dónde vive publicada

`https://vermillion-horse-359f90.netlify.app`

Netlify escucha la rama `main` de `github.com/cadaravi25/Mored-Store`: **cada
push es un despliegue**, no hay nada más que hacer. La configuración está en
`netlify.toml` y las variables en el panel de Netlify.

Dos cosas que costaron tres intentos y conviene no volver a descubrir:

- **El complemento de Next hay que declararlo.** Netlify detecta el proyecto
  pero no lo ejecuta solo. Sin él la compilación sale en verde y la tienda
  responde 404 en todas sus direcciones, que es el fallo más confuso posible.
- **`publish` hay que escribirlo.** Sin él Netlify supone que es la misma
  carpeta que `base` y el complemento se planta. Va relativo a la base, así que
  `.next` significa `app/.next`.

La tasa del BCV solo se refresca cuando alguien abre Finanzas o el punto de
venta, que son los únicos que llaman a `/api/bcv`. Si pasan días sin entrar al
panel, los precios en bolívares de la tienda salen con la tasa vieja.

## El inventario hoy

| | |
|---|---|
| Swim | 141 productos importados de Treinta |
| Active | 174 productos: 170 de los vídeos y 4 que ya estaban |
| Variantes | 587 |
| En la tienda | 138 tarjetas de Swim y 164 de Active |
| Fotos | todas en el depósito propio, ninguna apunta afuera |

Swim entró con `app/scripts/treinta.mjs` + `importar_treinta.mjs`, llamando a la
acción de servidor del catálogo público de Treinta.

Active **no tiene tienda en Treinta**: su catálogo vive en WhatsApp Business y
llegó en cuatro vídeos de alguien pasando capturas, uno por producto. De cada
captura salen el nombre de SHEIN, la familia, las tallas y los dos precios, y de
la propia imagen se recorta la foto. Todo eso está transcrito en
`app/scripts/datos/active/*.json`, y `importar_active.mjs` lo carga: **los vídeos
ya no hacen falta**. El programa acepta `--ensayo`, `--borrar` y
`--fotos=<carpeta de recortes>`.

## Vocabulario

**El nombre junta, la descripción separa.** Dos prendas con el mismo nombre Y la
misma descripción son la misma prenda en otro color y la tienda las junta en una
tarjeta. Descripción distinta, prendas distintas aunque se llamen igual.

Por eso la tarjeta enseña las dos cosas: sin la descripción, el catálogo de
Active serían ciento y pico tarjetas que dicen "Conjunto" y nada más.

Familias de Swim: Bikini, Trikini, Enterizo, Conjunto bikini, Vestido, Conjunto,
Falda, Top, Sombrero, Lentes, Cartera, Collar, Accesorio.

Familias de Active: Conjunto, Enterizo, Top, Leggin, Short, Suéter, Chaqueta,
Sudadera, Franela, Falda, Vestido, Accesorios deportivos.

Ellas escriben con soltura y eso se normaliza al importar: "jacket" y "chaqueta"
son lo mismo, "licra" y "leggins" también, y "musera", "flare", "bota ancha" o
"dupe dfyne" son apellidos del modelo, no familias aparte. Todo lo que dice
"set" es **Conjunto**, porque esos sí se venden juntos.

En la descripción no se repite el tipo: `bikini` se convierte en "traje de baño
de dos piezas", `trikini` en "traje de baño trikini", `enterizo` en "traje de
baño de una pieza". En los conjuntos la falda o el pareo van al frente. En
Active basta con quitarle la primera palabra al texto de SHEIN, salvo cuando
hace prenda aparte: una "falda pantalón" no es una falda.

## Los dos precios

Cada prenda tiene **precio en divisas** y **precio para pago en bolívares**. No
es una conversión: son dos números que ellas fijan por separado.

Los dos se guardan **en euros**. El de bolívares se multiplica por la tasa BCV
del euro del día.

- `variantes.precio_usd` — el de divisas. **Nunca tuvo dólares dentro**: la tasa
  de venta del sistema es `bcv_eur` desde el principio. El nombre quedó mal en el
  esquema inicial; renombrarlo obliga a rehacer ocho funciones y nueve pantallas
  sin cambiar nada que se vea.
- `variantes.precio_bs` — la base del de bolívares, también en euros.

En Vender, el precio lo decide el método de pago. Si mezclan monedas manda el
primero y la pantalla lo dice.

## Marcas de trabajo pendiente

- `POR DEFINIR` (talla): la prenda tiene tallas pero no se sabe el reparto. **No
  sale a la tienda** hasta completarla desde el panel.
- `ÚNICA` (talla): accesorio sin talla. Está terminado.
- `Por definir` (color): no se sabe el color. Sí sale a la tienda, pero la
  etiqueta no se enseña.

## Reglas que viven en la base, no en la pantalla

- Sin foto una prenda no sale a la tienda. Un color sin foto propia hereda la
  primera del producto, así que sí sale: el panel lo dice en gris ("sale con la
  foto de otro color") y deja el rojo para la prenda que no tiene ninguna.
- Un cambio de prenda tiene que ser por valor igual o mayor. Lo valida
  `registrar_cambio`, no el botón.
- Una prenda no se puede cambiar dos veces.
- La venta original nunca se modifica: un cambio es una nota nueva que apunta a
  la vieja.
- Un cambio de divisas no es ingreso ni gasto: mueve saldo entre cajas.

## El depósito no acepta cualquier nombre de archivo

Las claves de Supabase Storage rechazan acentos y espacios, y escaparlos no
sirve porque el signo de porcentaje también lo rechaza. Y falla de dos maneras:

- `Marrón` → *Invalid key*: la subida falla y al menos se nota.
- `Azul marino` → sube como `Azul%20marino` y **da 400 al pedirla**.

El segundo es el peligroso: la foto parece cargada, la columna guarda su
dirección y la prenda sale con el cuadro roto. Así se rompieron 80 fotos de Swim.
Por eso el nombre se limpia siempre con `rutaDeFoto()` de `src/lib/fotos.ts`, que
usan tanto el panel como la ruta de pegar enlaces. Los programas de importación
llevan su propia copia porque corren fuera de Next.

## Pendiente

**De ellas:**
- **Los costos.** Las 141 de Swim y las 170 de Active entraron con costo cero,
  así que **el margen que muestra Finanzas está inflado**. El "Ref N€" no sirve:
  es el precio en bolívares, no el costo.
- **El stock de Active.** Nadie contó las prendas: cuando el texto nombra una
  talla entró una. Hay que repasarlo en el panel.
- 6 productos sin Ref, con el mismo número en los dos precios: 4 de Swim
  (Lentes, Bikini, Accesorio, Trikini) y 2 de Active (`35/0155` los leggings
  acanalados con corte en V y `55/0033` el conjunto esencial negro).
- 1 producto al revés: el Conjunto de €25 tiene el de bolívares en 22, o sea que
  pagar en Bs sale más barato. Parece error de tecleo en Treinta.
- **13 prendas de Active con el color por definir**: su foto es el muestrario
  del proveedor y el texto no dice cuál tienen.
- **4 prendas de Active donde dicen "demás colores" sin nombrarlos**: `36/0030`,
  `36/0151`, `55/0082` y `55/0209`. Solo entró lo que sí nombran.
- `35/0061`: SHEIN la llama "Chaqueta Holgada **Blanca**" pero la foto es azul
  marino con raya blanca. Se cargó como azul marino.
- Foto del rosado del "Bikini azul y marron": la descripción lo nombra pero
  ninguna de las tres fotos lo muestra.
- 4 prendas de Swim sin descripción: Bikini amarillo floral, Traje de baño negro
  con falda, Vestido negro strapless y el Trikini fucsia. Hay propuestas
  escritas esperando su visto bueno.
- **Los 4 productos de Active que ya estaban** (Short, Conjunto sensación nube,
  Top dupe dfyne, Short musera) no tienen foto y tres no tienen descripción, así
  que no salen en la tienda. Además "Top dupe dfyne" y "Short musera" son
  nombres sueltos que ensucian el filtro por nombre.

**Decidido, esperando el momento:**
- Cambiar el filtro del catálogo a **nombre** y quitar el de tipo. Ya no espera
  a nada: las 141 de Swim y las de Active tienen su nombre nuevo.

**Fotos de Active:**
- Las 164 fotos salieron recortadas del propio vídeo, así que son de 276 px y
  provisionales. Están en el depósito con el sufijo `-video.jpg`, que es por
  donde hay que buscarlas para reemplazarlas de una pasada.
- **Los 6 accesorios deportivos entraron sin ninguna foto** y por eso no salen
  en la tienda: en el vídeo 48 salen ampliados y no hay imagen que recortar.
- 46 colores no tienen foto propia y salen con la de otro color de la misma
  prenda. Se ven en el panel con la nota en gris.
- Por eso hay **19 prendas de Active con varios colores y una sola foto**: la
  tarjeta enseña esa foto se escoja el color que se escoja, así que el color que
  sale por defecto puede no ser el de la imagen. Se arregla solo en cuanto cada
  color tenga la suya.

**Antes de publicar:**
- Rotar la clave `service_role` y revocar la de OpenRouter.
- Borrar `app/credenciales-iniciales.txt`.
- No poner `SUPABASE_SERVICE_ROLE_KEY` en el hosting: solo la usan los programas
  locales.
