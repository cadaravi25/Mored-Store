"""
Genera los archivos de marca a partir de la foto de perfil de Instagram.

    python scripts/extraer_logo.py <ruta de la imagen>

La aplicación usa la foto tal cual, con su degradado (mored-avatar.png). Además
se recorta el monograma solo, con fondo transparente, para lo que va sobre
fondo claro más adelante: notas de entrega, catálogo, papelería.

La separación se hace por DISTANCIA AL BLANCO y no por brillo: el degradado
aclara bastante hacia la derecha, y un umbral de brillo dejaría fantasmas del
fondo pegados al borde.
"""

import os
import sys

from PIL import Image

DESTINO = os.path.join(os.path.dirname(__file__), "..", "app", "public")
MARRON = (173, 130, 95)

# Por debajo de DENTRO es logo, por encima de FUERA es fondo, y en medio se
# interpola para conservar el suavizado del borde.
DENTRO, FUERA = 30.0, 62.0


def recortar(origen: str) -> Image.Image:
    im = Image.open(origen).convert("RGB")
    print("Original:", im.size)

    px = im.load()
    ancho, alto = im.size
    mascara = Image.new("L", im.size, 0)
    mp = mascara.load()

    for y in range(alto):
        for x in range(ancho):
            r, g, b = px[x, y]
            d = max(255 - r, 255 - g, 255 - b)
            if d <= DENTRO:
                mp[x, y] = 255
            elif d >= FUERA:
                mp[x, y] = 0
            else:
                mp[x, y] = int(255 * (FUERA - d) / (FUERA - DENTRO))

    logo = Image.new("RGBA", im.size, (255, 255, 255, 0))
    logo.putalpha(mascara)
    caja = mascara.getbbox()
    if caja is None:
        raise SystemExit("No se encontró ninguna forma clara en la imagen.")
    return logo.crop(caja)


def escalar(logo: Image.Image, ancho: int) -> Image.Image:
    alto = round(ancho * logo.size[1] / logo.size[0])
    return logo.resize((ancho, alto), Image.LANCZOS)


def main() -> None:
    origen = sys.argv[1] if len(sys.argv) > 1 else None
    if not origen or not os.path.exists(origen):
        raise SystemExit("Uso: python scripts/extraer_logo.py <imagen>")

    destino = os.path.abspath(DESTINO)
    os.makedirs(destino, exist_ok=True)

    # La foto tal cual, con su degradado. Es lo que se ve en la aplicación.
    avatar = Image.open(origen).convert("RGB")
    lado = min(avatar.size)
    izq = (avatar.size[0] - lado) // 2
    arr = (avatar.size[1] - lado) // 2
    avatar = avatar.crop((izq, arr, izq + lado, arr + lado)).resize(
        (512, 512), Image.LANCZOS
    )
    avatar.save(os.path.join(destino, "mored-avatar.png"))
    avatar.save(os.path.join(destino, "icono.png"))
    # El .ico va en RGBA: Next rechaza el PNG que lleva dentro si no lo está.
    avatar.resize((32, 32), Image.LANCZOS).convert("RGBA").save(
        os.path.join(destino, "favicon.ico"), sizes=[(32, 32)]
    )

    logo = recortar(origen)
    print("Recortado a:", logo.size)

    escalar(logo, 512).save(os.path.join(destino, "mored-blanco.png"))

    # Misma silueta en el marrón de marca, para fondos claros.
    tenido = Image.new("RGBA", logo.size, MARRON + (0,))
    tenido.putalpha(logo.split()[3])
    escalar(tenido, 512).save(os.path.join(destino, "mored-marron.png"))

    for nombre in (
        "mored-avatar.png",
        "mored-blanco.png",
        "mored-marron.png",
        "icono.png",
        "favicon.ico",
    ):
        ruta = os.path.join(destino, nombre)
        print(" ", nombre, os.path.getsize(ruta), "bytes")


if __name__ == "__main__":
    main()
