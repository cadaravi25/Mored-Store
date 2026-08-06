"""
Saca las imágenes incrustadas de los SVG del hero.

    python scripts/extraer_hero.py active "C:/ruta/Hero mored active.svg"
    python scripts/extraer_hero.py swim   "C:/ruta/Hero mored swim.svg"

Cada SVG trae la escena de una colección con sus capas separadas: el paisaje
por un lado y la modela recortada por otro. Separadas es justo lo que hace
falta: permiten moverlas a distinta velocidad y que el cambio entre
colecciones tenga profundidad en vez de ser un corte.

Se ordenan por peso: el paisaje ocupa toda la escena y siempre pesa más que un
recorte. La que tiene transparencia es la modela.
"""

import base64
import os
import sys

from PIL import Image

DESTINO = os.path.join(os.path.dirname(__file__), "..", "app", "public", "hero")

ANCHO_FONDO = 1800
ANCHO_MODELA = 1200


def incrustadas(ruta: str) -> list[bytes]:
    """Los mapas de bits viajan en base64 dentro del propio SVG."""
    crudo = open(ruta, "rb").read()
    salida: list[bytes] = []
    pos = 0
    while True:
        i = crudo.find(b"base64,", pos)
        if i < 0:
            return salida
        ini = i + 7
        fin = crudo.find(b'"', ini)
        salida.append(base64.b64decode(crudo[ini:fin]))
        pos = fin


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("Uso: python scripts/extraer_hero.py <active|swim> <svg>")

    coleccion, origen = sys.argv[1], sys.argv[2]
    if coleccion not in ("active", "swim"):
        raise SystemExit("La colección es 'active' o 'swim'.")
    if not os.path.exists(origen):
        raise SystemExit(f"No existe: {origen}")

    destino = os.path.abspath(DESTINO)
    os.makedirs(destino, exist_ok=True)

    import io

    imagenes = [Image.open(io.BytesIO(b)) for b in incrustadas(origen)]
    if len(imagenes) < 2:
        raise SystemExit(
            f"Solo encontré {len(imagenes)} imagen(es). El SVG debería traer el "
            "paisaje y la modela recortada."
        )

    for im in imagenes:
        print(" ", im.size, im.mode)

    # La modela es la que tiene transparencia. Si ninguna la tiene, se usa la
    # más pequeña: un recorte nunca es más grande que el paisaje completo.
    conAlfa = [im for im in imagenes if im.mode in ("RGBA", "LA")]
    modela = (
        min(conAlfa, key=lambda im: im.size[0] * im.size[1])
        if conAlfa
        else min(imagenes, key=lambda im: im.size[0] * im.size[1])
    )
    fondo = max(
        [im for im in imagenes if im is not modela],
        key=lambda im: im.size[0] * im.size[1],
    )

    def guardar(im: Image.Image, nombre: str, ancho: int, alfa: bool) -> None:
        alto = round(ancho * im.size[1] / im.size[0])
        chica = im.convert("RGBA" if alfa else "RGB").resize(
            (ancho, alto), Image.LANCZOS
        )
        ruta = os.path.join(destino, nombre)
        chica.save(ruta, quality=88, method=6)
        print(f"  {nombre}  {chica.size}  {round(os.path.getsize(ruta) / 1024)} KB")

    guardar(fondo, f"{coleccion}-fondo.webp", ANCHO_FONDO, False)
    guardar(modela, f"{coleccion}-modela.webp", ANCHO_MODELA, True)


if __name__ == "__main__":
    main()
