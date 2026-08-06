"""
Prepara las fotos de campaña de Mored para la tienda.

    python scripts/preparar_fotos.py

Toma las carpetas de sesión tal como las entrega el fotógrafo y deja copias
livianas en app/public/fotos. Los originales pesan más de un mega cada uno:
servirlos así haría que la tienda tarde una eternidad en un teléfono con datos
móviles, que es como la va a ver casi todo el mundo.
"""

import io
import os

from PIL import Image

ORIGENES = [
    r"C:/Users/Carlo/Downloads/Yoli",
    r"C:/Users/Carlo/Downloads/Mored 0406",
]

DESTINO = os.path.join(os.path.dirname(__file__), "..", "app", "public", "fotos")

# Ancho suficiente para ocupar media pantalla en un monitor grande sin que se
# note el reescalado, y nada más.
ANCHO = 1400
CALIDAD = 82


def main() -> None:
    destino = os.path.abspath(DESTINO)
    os.makedirs(destino, exist_ok=True)

    total = 0
    peso = 0
    for carpeta in ORIGENES:
        if not os.path.isdir(carpeta):
            print(f"  no existe: {carpeta}")
            continue

        for nombre in sorted(os.listdir(carpeta)):
            if not nombre.lower().endswith((".jpg", ".jpeg", ".png")):
                continue

            im = Image.open(os.path.join(carpeta, nombre)).convert("RGB")
            if im.size[0] > ANCHO:
                alto = round(ANCHO * im.size[1] / im.size[0])
                im = im.resize((ANCHO, alto), Image.LANCZOS)

            salida = os.path.splitext(nombre)[0].lower().replace(" ", "-") + ".webp"
            ruta = os.path.join(destino, salida)
            im.save(ruta, quality=CALIDAD, method=6)

            total += 1
            peso += os.path.getsize(ruta)
            print(f"  {salida:24} {im.size[0]}x{im.size[1]}  "
                  f"{round(os.path.getsize(ruta) / 1024)} KB")

    print(f"\n{total} fotos, {round(peso / 1024 / 1024, 1)} MB en total")


if __name__ == "__main__":
    main()
