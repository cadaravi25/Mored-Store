"""
Recorta el monograma de Mored de su foto de perfil de Instagram y genera los
archivos que usa la aplicación.

    python scripts/extraer_logo.py <ruta de la imagen>

El monograma es blanco puro sobre un degradado marrón. La separación se hace
por DISTANCIA AL BLANCO y no por brillo: el degradado aclara bastante hacia la
derecha, y un umbral de brillo dejaría fantasmas del fondo pegados al borde.
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

    logo = recortar(origen)
    print("Recortado a:", logo.size)

    escalar(logo, 512).save(os.path.join(destino, "mored-blanco.png"))

    # Misma silueta en el marrón de marca, para fondos claros.
    tenido = Image.new("RGBA", logo.size, MARRON + (0,))
    tenido.putalpha(logo.split()[3])
    escalar(tenido, 512).save(os.path.join(destino, "mored-marron.png"))

    # Icono cuadrado con el fondo de marca, como el de su Instagram.
    lado = 512
    icono = Image.new("RGBA", (lado, lado), MARRON + (255,))
    chico = escalar(logo, round(lado * 0.58))
    icono.paste(chico, ((lado - chico.size[0]) // 2, (lado - chico.size[1]) // 2), chico)
    icono.save(os.path.join(destino, "icono.png"))
    icono.resize((32, 32), Image.LANCZOS).save(
        os.path.join(destino, "favicon.ico"), sizes=[(32, 32)]
    )

    for nombre in ("mored-blanco.png", "mored-marron.png", "icono.png", "favicon.ico"):
        ruta = os.path.join(destino, nombre)
        print(" ", nombre, os.path.getsize(ruta), "bytes")


if __name__ == "__main__":
    main()
