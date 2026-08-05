# Publicar el sistema y la tienda

Todo corre desde un mismo proyecto. El panel interno queda protegido por sesión
y la tienda queda abierta al público, sin que haya que publicar dos cosas.

| Dirección | Quién entra |
|---|---|
| `/tienda` | cualquiera, sin sesión |
| `/`, `/inventario`, `/vender`, `/caja`, `/finanzas`, `/clientes` | solo con sesión |

## Antes de publicar

**Borra `app/credenciales-iniciales.txt`.** Tiene las contraseñas iniciales de
las dos socias. Está fuera de git, pero no tiene por qué seguir existiendo una
vez se las entregaste.

**Rota la clave `service_role`** en Project Settings → API Keys → Roll. Quedó
escrita en el chat donde armamos esto. No la usa la aplicación, solo los
guiones de `scripts/`, así que rotarla no rompe nada publicado: solo hay que
actualizarla en tu `.env.local`.

## 1. Subir el código

El proyecto todavía no tiene repositorio remoto. Crea uno **privado** en GitHub
y súbelo:

```bash
git remote add origin https://github.com/TU-USUARIO/mored-store.git
git push -u origin master
```

Privado importa: el repositorio no lleva claves, pero sí lleva el modelo de
datos completo y los costos del negocio en los comentarios.

## 2. Conectar Vercel

Es lo más simple para Next.js: no hay nada que configurar, lo reconoce solo.

1. Entra a **vercel.com**, "Add New" → "Project", e importa el repositorio
2. En **Root Directory** escoge **`app`**, que es donde vive el proyecto
3. Deja el resto como está: detecta Next.js solo

## 3. Cargar las variables

En **Settings → Environment Variables**, las mismas de
[app/.env.example](app/.env.example):

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | igual |
| `NEXT_PUBLIC_WHATSAPP` | el número al que llegan los pedidos |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys |
| `MODELO_LECTOR` | opcional |

**`SUPABASE_SERVICE_ROLE_KEY` no va.** La aplicación no la usa nunca y ahí sería
una filtración esperando ocurrir.

## 4. Comprobar que quedó bien

Con la dirección que te dé Vercel:

- `tudireccion.vercel.app/tienda` abre **sin pedir sesión**
- `tudireccion.vercel.app/inventario` **manda a la pantalla de entrada**
- Entra y verifica que el inventario carga

Y desde tu máquina, contra la base ya publicada:

```bash
node app/scripts/verificar_tienda.mjs
```

## Después: el dominio

Vercel da una dirección `.vercel.app` que funciona perfecto para arrancar y
para mandar por Instagram.

Un dominio propio (`moredstore.com`) cuesta unos 12 USD al año y se conecta
desde Settings → Domains. Vale la pena cuando la tienda ya esté vendiendo: para
las primeras semanas la dirección de Vercel sobra.

## Lo que cuesta

| | |
|---|---|
| Vercel Hobby | 0 USD |
| Supabase Free | 0 USD |
| Fotos (Supabase Storage) | 0 USD hasta 1 GB |
| Lectura de capturas | 0 USD con el modelo gratuito |
| Dominio | ~12 USD al año, opcional |

El límite que hay que vigilar es el de banda de las fotos en Supabase: 2 GB al
mes en el plan gratuito. Si la tienda empieza a recibir mucha visita, las fotos
se mudan a Cloudflare R2, que no cobra por banda de salida. Es cambiar dónde
viven, no rehacer nada.
