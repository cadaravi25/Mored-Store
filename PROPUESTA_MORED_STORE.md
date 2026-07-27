# Mored Store: propuesta de solución

Fecha: 26 de julio de 2026
Cliente: Mored Store (Mored Active + Mored Swim), Venezuela
Versión 2, con las precisiones del cliente.

## Datos confirmados por el cliente

- Lo que no llega en un pedido **no se pierde, se retrasa**. Un mismo pedido llega en varias tandas a lo largo de semanas.
- Tallas y colores son **variantes con stock independiente**.
- Las cuentas bancarias están **a nombre personal**. Están en proceso de registro, pero no se cuenta con eso todavía.
- Hoy pagan aproximadamente **25 USD/mes por cada app** (Fina + Treinta), unos **50 USD/mes** en total, con la información regada entre las dos.
- Prioridad número uno: **inventariado rápido**. Y el costo de infraestructura no puede comerse el presupuesto.

## La tesis del proyecto

Hoy pagan ~600 USD al año para tener el negocio partido en dos sistemas que no resuelven su problema principal. La propuesta tiene que costar **menos que eso en operación** y resolver lo que ninguna de las dos hace. Si no, tienen razón en quedarse donde están.

Meta de infraestructura: **0 a 6 USD/mes.** Es alcanzable y abajo está el detalle.

---

## 1. Recepción de pedidos: rediseñado para entregas por tandas

El diseño anterior asumía "pedí 50, llegaron 30, reclamo 20". La realidad es distinta y más simple de modelar: **un pedido queda abierto y va recibiendo paquetes durante semanas hasta completarse**. Eso cambia todo el flujo.

### Modelo

```
Pedido (SHEIN #12345, abierto)
├── Líneas esperadas: variante, cantidad pedida, cantidad recibida, costo unitario
└── Recepciones (tandas)
    ├── Tanda 1 (12 jul, paquete ABC) → 18 piezas
    ├── Tanda 2 (21 jul, paquete DEF) → 9 piezas
    └── Tanda 3 (...)
```

El pedido se cierra solo cuando todas las líneas están completas, o se cierra a mano si deciden dar algo por perdido.

### Flujo paso por paso

**Paso 1: cargar el pedido una sola vez (al comprar, no al recibir)**

Apenas hacen el pedido en SHEIN, lo cargan al sistema. Suben las capturas de la pantalla del pedido y un modelo de visión extrae las líneas: producto, color, talla, cantidad, precio unitario. Queda como **pedido abierto** con todo en estado "por llegar". Esto se hace una vez, con calma, no en el apuro de abrir cajas. La especificación detallada del importador está más abajo.

**Paso 2: cada paquete que llega es una "tanda"**

Se abre el pedido en el teléfono y la pantalla muestra **solo lo que todavía está pendiente**, en cuadrícula de fotos grandes. No una lista de texto, no todo el pedido completo.

- Tocas la foto: +1 recibido.
- Botón "llegó completo": cierra la tanda de un golpe cuando el paquete vino entero.

**Sobre el escaneo con cámara: descartado.** Se validó con etiquetas reales y **no sirve**. Dos bolsitas del mismo artículo en tallas distintas (S y M) traen **el mismo código de barras y el mismo número impreso**; lo único que las diferencia es la letra de la talla en la esquina. O sea que el código no identifica la variante. Lo único aprovechable sería leer la letra de la talla con OCR, y eso no justifica el trabajo frente a simplemente tocar la foto. La cuadrícula de fotos con solo lo pendiente ya deja la recepción en un par de minutos por tanda.

Al guardar, ese stock entra de inmediato y ya se puede vender. Lo demás sigue pendiente esperando la próxima tanda.

**Paso 3: la vista "Por llegar"**

Esta es la pantalla que hoy no tienen en ningún lado. Transversal a todos los pedidos abiertos: qué falta, de qué pedido, hace cuántos días, con foto y monto. Ordenada por antigüedad, con alerta cuando algo pasa de X días para que decidan si reclamar. Reemplaza por completo el "ir consultando el pedido de SHEIN para ver qué faltó".

**Paso 4: costeo real**

El flete se prorratea **por tanda**, que además es lo correcto porque SHEIN cobra el envío por paquete. Como una misma variante puede venir en varios pedidos a distinto costo, el costo unitario se lleva como **promedio ponderado móvil**. Resultado: costo real en dólares por pieza y margen real por producto y por colección. Hoy eso lo están estimando a ojo.

### Modelo de variantes

```
Producto (nombre, colección Active/Swim, categoría, descripción)
└── Color (nombre, FOTO)
    └── Variante = color + talla (SKU propio, stock propio, costo landed)
```

Detalle importante de diseño: **la foto va a nivel de color, no de variante**. Un traje de baño en 4 tallas y 3 colores son 12 variantes pero solo 3 fotos. Esto reduce el almacenamiento a la doceava parte y es como el cliente ya piensa el producto. SHEIN entrega color y talla en cada línea del pedido, así que el mapeo es directo.

Cuenta rápida: 500 productos con 3 colores cada uno, en WebP optimizado, son unos **120 MB**. Cabe de sobra en cualquier tier gratuito.

### Especificación del importador, validada con pedidos reales

Analicé dos pedidos reales de SHEIN (`GSU18F02U00NEJJ`, 5 artículos, 65,14 USD; `GSU18F02U00NESW`, 15 artículos, 144,27 USD). Estructura confirmada de la pantalla de pedido:

- Artículos **agrupados por vendedor** (ZJ.WANGWANG, agile).
- Cada línea trae: miniatura, título truncado a dos renglones, `Color / Talla`, precio pagado, precio tachado, y cantidad.
- Al final: **total del pedido** y **número de pedido**.

Cinco hallazgos que definen el diseño:

1. **Los títulos vienen cortados** ("Set de 3 piezas Mujeres Leggings ce ñidos de cintura alta 3/4, Shorts de y"). No se pueden recuperar completos desde la captura, y no importa: para inventario no sirve el título SEO de SHEIN. El sistema propone un nombre corto editable ("Set 3 piezas leggings 3/4"). Para el catálogo público esto es una ventaja, no una limitación.
2. **Toda línea es cantidad 1, y las repetidas aparecen como líneas separadas.** En el pedido de 15 artículos hay dos líneas idénticas de "Multicolor / 4(S)" a 13,85 USD. El importador debe **consolidar líneas idénticas en cantidad**, y la recepción se convierte en un checklist de presente/ausente en vez de un conteo.
3. **Las tallas vienen en formato SHEIN**: `2(XS)`, `4(S)`, `6(M)`. Numeración más letra entre paréntesis. Mapeo directo a XS/S/M, resuelto con una tabla de equivalencias.
4. **Los colores ya vienen en español**: Multicolor, Blanco, Celeste, Morado, Negro, Burdeos. Nada que traducir.
5. **La suma de las líneas cuadra exactamente con el total del pedido** (verificado: 14,34 + 14,03 + 14,19 + 14,11 + 8,47 = 65,14). O sea que SHEIN no cobra envío aparte en estos pedidos. El flete real a prorratear es el del **courier a Venezuela**, que se paga por caja y se captura al registrar cada tanda. Eso simplifica el costeo.

**No hay SKU visible en la pantalla del pedido.** La identidad del producto se construye con vendedor + título + color, y el sistema **propone** el match contra productos ya existentes en el catálogo para que ellas confirmen. No se puede automatizar al 100%, y no hace falta.

### Las fotos salen de la misma captura, sin scraping

Este es el hallazgo que elimina el costo del módulo de fotos. Las miniaturas ya están en la captura del pedido, en columna izquierda, una por línea. Se recortan de la propia imagen y quedan asociadas a cada artículo. **Cero scraping, cero dependencia de SHEIN, cero riesgo de que se rompa.**

Resolución: unos 100 × 100 píxeles. Suficiente y de sobra para la pantalla de recepción, donde solo hace falta reconocer la prenda que se tiene en la mano. **No sirve para el catálogo público** (fase 3), que necesita fotos propias o traídas de la URL del producto. Son dos necesidades distintas y solo una de ellas es urgente.

### Costo real del importador

Cada captura de pantalla (591 × 1280 px) son unos 1.000 tokens de imagen. Un pedido de seis capturas: unos 7.000 tokens de entrada y 2.000 de salida.

| Modelo | Por pedido | 10 pedidos/mes |
|---|---|---|
| Haiku 4.5 | ~0,02 USD | ~0,20 USD |
| Sonnet 5 | ~0,05 USD | ~0,50 USD |
| Opus 5 | ~0,09 USD | ~0,90 USD |

**Menos de 1 USD al mes incluso usando el modelo más caro.** Construir un importador con OCR gratuito para ahorrar eso costaría decenas de horas de desarrollo y daría un resultado peor y más frágil. No vale la pena optimizarlo.

---

## 2. Infraestructura: cómo llegar a 0 a 6 USD al mes

El error de la versión anterior fue asumir Vercel Pro + Supabase Pro. Revisando los números reales de julio de 2026, no hace falta.

### El punto crítico: Vercel Hobby no sirve

El plan Hobby de Vercel **prohíbe explícitamente el uso comercial**, definido como cualquier deployment usado con fines de lucro, incluyendo proyectos hechos por un consultor pagado. Violarlo puede terminar en suspensión de la cuenta. Así que Vercel es Pro (20 USD/mes) o no es Vercel.

No es Vercel. Hay alternativas gratuitas que **sí permiten uso comercial**: Cloudflare Pages/Workers y Netlify.

### El segundo punto crítico: las fotos

Lo que revienta los tiers gratuitos en una tienda no es la base de datos, es el **almacenamiento y la banda de las imágenes**. La solución es sacar las fotos del proveedor de base de datos y ponerlas en **Cloudflare R2**, que da 10 GB gratis y, lo más importante, **cobra cero por egreso**. Las fotos del catálogo nunca van a generar costo de banda, sin importar cuánta gente vea la tienda.

### Opción A, recomendada: Supabase Free + Cloudflare (0 USD/mes)

| Componente | Servicio | Límite gratuito | ¿Alcanza? |
|---|---|---|---|
| Base de datos | Supabase Free | 500 MB DB, 5 GB egreso | Sí. Productos, variantes, pedidos y ventas son texto. Van a estar en decenas de MB durante años |
| Fotos | Cloudflare R2 | 10 GB, egreso ilimitado sin costo | Sí, con enorme margen |
| Hosting de la app | Cloudflare Pages / Workers | Ancho de banda ilimitado, sin restricción comercial | Sí |
| Dominio | Cualquier registrador | ~12 USD/año | |

**Total: 0 USD/mes + ~12 USD/año de dominio.**

Dos advertencias honestas:
- Supabase Free **pausa el proyecto tras 7 días sin actividad**. Con uso diario no aplica, y de todos modos se resuelve con un ping automático.
- El tier gratuito de Supabase permite 2 proyectos activos. Si ya tienes otros proyectos ahí, hay que revisar.

Esta opción mantiene Postgres, que es lo que permite modelar bien las variantes y reutilizar el código de finanzas de Con Alma Clinic. Es la que recomiendo.

### Opción B: todo en Cloudflare (0 a 5 USD/mes)

Workers + D1 (base de datos, 5 GB gratis) + R2. Sale prácticamente gratis y todo queda en un solo proveedor. La contra: D1 es SQLite, no Postgres, así que hay más trabajo de adaptación y se pierde parte de la reutilización de Con Alma Clinic. La dejo como plan B.

### Opción C, para cuando crezcan: VPS propio (~5 USD/mes)

Un Hetzner CX22 (2 vCPU, 4 GB RAM, 40 GB NVMe) cuesta **4,49 EUR/mes**, unos 5 USD. Con Coolify encima corre la app, Postgres y el almacenamiento de fotos, todo junto, sin límites de tier. La contra es real: hay que mantenerlo, actualizarlo y respaldarlo. Es la opción de techo alto pero con trabajo de operación. No la recomiendo para arrancar.

### Costos variables

| Concepto | Costo estimado |
|---|---|
| IA para leer los pedidos de SHEIN | Menos de 1 USD/mes al volumen de ellas, usando el modelo pequeño |
| Scraper de fotos (opcional) | 0 USD con el crédito gratuito mensual de Apify |

Alternativa de cero costo para la carga de pedidos: un **bookmarklet o extensión** que corra en la página del pedido de SHEIN y extraiga los artículos y las URLs de las fotos directamente. Cuesta 0 USD, pero se rompe cada vez que SHEIN cambia su página y hay que arreglarlo. La lectura con IA cuesta centavos y no requiere mantenimiento. Recomiendo IA, con carga manual siempre disponible como respaldo.

### El número que le importa al cliente

| | Hoy | Propuesta |
|---|---|---|
| Costo mensual | ~50 USD (Fina + Treinta) | **0 a 6 USD** |
| Costo anual | ~600 USD | **~12 a 85 USD** |
| Sistemas | 2, con la info regada | 1, unificado |
| Recepción de pedidos | Manual contra SHEIN | Automatizada, por tandas |
| Fotos en inventario | Solo en Treinta | En todo |
| Finanzas Bs/$ | A mano | Automática con tasa BCV |
| Catálogo de venta | No tienen | Incluido |

El ahorro operativo de ~550 USD al año paga una parte del desarrollo por sí solo.

---

## 3. Finanzas en bolívares y dólares

Se reutiliza casi tal cual lo construido en Con Alma Clinic, que ya resuelve:

- **Moneda ancla** (allá euro, acá dólar). Cada movimiento guarda monto original, moneda, tasa usada y equivalente. Auditable hacia atrás sin perder el dato original.
- **Tasa BCV automática** desde `ve.dolarapi.com`, gratis y sin llave, con el detalle fino ya resuelto: el BCV publica a las 4 p. m. la tasa del día siguiente, así que el sistema mantiene historial por fecha efectiva y distingue **tasa vigente hoy** de **tasa próxima**. Los montos no se mueven solos a media tarde.
- **Cuentas separadas divisa y bolívares**, cada una con sus métodos de pago.
- **Cambios de divisa** que mueven saldo pero no cuentan como ingreso, que es el error contable clásico de este tipo de negocio.

Adaptaciones para Mored: ancla en dólares, **tasa de venta propia configurable** además de la BCV (con cálculo del diferencial), costo de mercancía vendida basado en el costo landed del módulo 1, y manejo de **apartados y abonos**.

Costo: 0 USD. Es el módulo que más horas de desarrollo ahorra.

---

## 4. Catálogo, órdenes y cobros

### El estado real de los pagos

Todas las pasarelas serias de Venezuela (Mercantil, BNC, Banco Venezolano de Crédito, Banco de Venezuela, Instapago, Megasoft, PagoFlash, Ubii) **exigen cuenta jurídica y RIF de empresa**. Con cuentas a nombre personal esa puerta está cerrada hoy. No hay forma técnica de saltarlo.

### Lo que se hace mientras tanto

Orden con **pago reportado y verificación manual**, que es como operan las tiendas serias del país:

1. El cliente arma el pedido en el catálogo, con fotos, tallas, colores y stock real por variante.
2. Elige método: pago móvil, transferencia, Zelle, Binance o efectivo contra entrega.
3. El sistema muestra los datos de pago y el monto exacto en la moneda que aplique, con la tasa del día.
4. El cliente paga y **reporta la referencia**.
5. La orden queda en "verificando pago" con el stock reservado por un tiempo límite, para que no le vendan dos veces la misma talla.
6. Alguien confirma desde el panel y se dispara la nota de entrega.

Más un botón de **"enviar pedido por WhatsApp"** con el resumen prellenado, que es como su clientela ya compra. El link `wa.me` es gratis.

Costo: **0 USD.**

### Después

- **Verificación automática con Pabilo** (~35 USD/mes): declaran soportar **cuentas personales** además de jurídicas, lo que significa que sí sería viable sin esperar el registro. Verifica pago móvil y transferencias de Banco de Venezuela, Mercantil, Banesco, Bancaribe, Banco Plaza y Binance vía API REST. Hay que confirmarlo directo con ellos. Pero a 35 USD/mes contra un presupuesto de 50, **no vale la pena hoy**. Se activa cuando el volumen de órdenes haga que verificar a mano duela.
- **C2P y botón de pago bancario** (~1,5% por transacción) cuando se complete el registro.

La arquitectura se deja lista para ambos, sin rehacer nada.

---

## 5. Notas de entrega y facturación

Sin RIF jurídico ni autorización del SENIAT no se puede emitir factura fiscalmente válida (Providencia SNAT/2011/00071), y hay normativa reciente que aprieta específicamente a quienes venden solo por medios digitales. No soy contador y esto no es asesoría fiscal, vale la pena que lo conversen con uno.

Lo que sí se entrega: **nota de entrega no fiscal** en PDF, con correlativo propio, datos del cliente, detalle por variante, montos en dólares y bolívares con la tasa y su fecha, y la leyenda "documento no fiscal, no válido como factura".

**Clave:** el módulo se construye desde ahora con el modelo de datos de una factura fiscal completa (serie, correlativo, RIF emisor, base imponible, IVA por línea). Como ya están en proceso de registro, el día que salga el RIF solo se activan los campos y las reglas de IVA, y el mismo módulo emite facturas sin rehacer nada.

Costo hoy: 0 USD.

---

## 6. Fases

| Fase | Alcance | Resultado visible |
|---|---|---|
| 0 | Exportar Fina y Treinta, unificar catálogo con variantes | Un solo catálogo limpio |
| 1 | **Inventario + recepción por tandas + vista "Por llegar" + costeo landed** | Se acaba el cruce manual contra SHEIN |
| 2 | Finanzas Bs/dólar | Se acaba la conversión a mano |
| 3 | Catálogo público + órdenes + pago reportado | Canal de venta propio |
| 4 | Notas de entrega en PDF | Ciclo de venta cerrado |
| 5 | Facturación fiscal (al salir el RIF) y verificación automática de pagos | Cuando el negocio lo pida |

Dado que la prioridad es el inventariado, **la fase 1 se puede entregar sola y ya justifica migrar**. Ese es el argumento de venta: no les pido que confíen en el proyecto completo, les entrego primero lo que más les duele.

---

## 7. Preguntas que quedan abiertas

1. ¿Cuántos productos activos y cuántas ventas al mes? Confirma que los tiers gratuitos alcanzan.
2. ¿Venden a tasa BCV, paralela o una propia?
3. ¿Cuántas personas usan el sistema y con qué permisos? Por ejemplo, si alguien recibe mercancía pero no debe ver las finanzas.
4. ¿Un catálogo con dos marcas o dos sitios separados? Impacta el trabajo de front.
5. ¿Las fotos son las de SHEIN o toman propias? Si toman propias, hay que pensar el flujo de carga desde el teléfono.
6. ¿Hacen apartados o ventas con abonos?
7. ~~¿La etiqueta de la bolsita trae un código de barras con el SKU?~~ **Validado y descartado**: el código de barras es el mismo para tallas distintas del mismo artículo, así que no identifica la variante. La recepción va por cuadrícula de fotos, sin escáner.

---

## Fuentes consultadas

- Límites del plan Hobby de Vercel: https://vercel.com/docs/plans/hobby
- Límites del tier gratuito de Supabase 2026: https://uibakery.io/blog/supabase-pricing
- Precios y límites de Cloudflare Workers, D1 y R2: https://developers.cloudflare.com/workers/platform/pricing/
- Comparativa de tiers gratuitos de hosting 2026: https://agentdeals.dev/hosting-free-tier-comparison-2026
- Precios Hetzner Cloud CX22 2026: https://vpsfor.dev/posts/hetzner-cx22-pricing-2026/
- Pasarelas y botones de pago en Venezuela: https://cujiware.com/pasarelas-pago-venezuela
- Pago móvil a comercio C2P, Bancaribe: https://www.bancaribe.com.ve/pago-movil-a-comercio
- Pabilo, verificación de pagos: https://pabilo.app/
- Providencia SNAT/2011/00071, SENIAT: https://tributos.ivecofi.net/informacion/legislacion/providencias/pa-2011-71
