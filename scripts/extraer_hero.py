"""
Saca las imágenes incrustadas del SVG del hero y las deja como archivos sueltos.

    python scripts/extraer_hero.py "C:/ruta/Hero Mored.svg"

El SVG trae dos mesas de trabajo (Active y Swim), cada una con la modelo
separada del fondo. Separadas es justo lo que hace falta: permiten moverlas a
distinta velocidad y que el cambio entre colecciones se sienta con profundidad
en vez de ser un corte.
"""

import base64
import io
import os
import re
import sys

DESTINO = os.path.join(os.path.dirname(__file__), "..", "app", "public", "hero")


def main() -> None:
    origen = sys.argv[1] if len(sys.argv) > 1 else None
    if not origen or not os.path.exists(origen):
        raise SystemExit("Uso: python scripts/extraer_hero.py <archivo.svg>")

    destino = os.path.abspath(DESTINO)
    os.makedirs(destino, exist_ok=True)

    svg = io.open(origen, encoding="utf-8", errors="replace").read()
    print("svg:", round(len(svg) / 1024 / 1024, 1), "MB")

    # Cada <image> lleva su mapa de bits en base64 dentro del propio atributo.
    patron = re.compile(
        r'<image[^>]*?(?:id="([^"]*)")?[^>]*?'
        r'x="([-\d.]+)"[^>]*?y="([-\d.]+)"[^>]*?'
        r'width="([\d.]+)"[^>]*?height="([\d.]+)"[^>]*?'
        r'xlink:href="data:image/(png|jpeg|jpg);base64,([^"]+)"',
        re.S,
    )

    encontradas = list(patron.finditer(svg))
    if not encontradas:
        # Cuando el orden de los atributos no calza, se cae a lo mínimo: el
        # contenido, que es lo único imprescindible.
        encontradas = list(
            re.finditer(r'data:image/(png|jpeg|jpg);base64,([^"]+)', svg)
        )
        for i, m in enumerate(encontradas, 1):
            datos = base64.b64decode(m.group(2))
            ruta = os.path.join(destino, f"bruto-{i}.{m.group(1)}")
            io.open(ruta, "wb").write(datos)
            print(f"  bruto-{i}.{m.group(1)}", round(len(datos) / 1024), "KB")
        return

    for i, m in enumerate(encontradas, 1):
        _id, x, y, w, h, ext, b64 = m.groups()
        datos = base64.b64decode(b64)
        ruta = os.path.join(destino, f"bruto-{i}.{ext}")
        io.open(ruta, "wb").write(datos)
        print(
            f"  bruto-{i}.{ext}",
            f"x={x} y={y} {w}x{h}",
            round(len(datos) / 1024),
            "KB",
        )


if __name__ == "__main__":
    main()
