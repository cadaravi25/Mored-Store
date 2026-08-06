"""
Saca el logotipo de cada escena del hero como un SVG suelto.

    python scripts/extraer_logo_hero.py active "C:/ruta/Hero mored active.svg"
    python scripts/extraer_logo_hero.py swim   "C:/ruta/Hero mored swim.svg"

MORED ACTIVE y MORED SWIM son el logotipo, no texto: no se pueden volver a
componer con una tipografía cualquiera. Vienen en vector dentro del SVG del
hero, así que se copian tal cual y se recortan a su caja.

Sale un SVG y no un PNG a propósito: el logotipo se ve nítido en cualquier
pantalla y pesa unos pocos kilobytes.
"""

import os
import re
import sys

# La franja de abajo del diseño es el botón "VER ACTIVE / VER SWIM". Se
# reconoce por dónde está, y no forma parte del logotipo.
Y_BOTON = 850.0

NUMERO = re.compile(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?")
COMANDO = re.compile(r"([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)")


def caja(d: str) -> tuple[float, float, float, float]:
    """Caja que encierra un trazado.

    Las curvas se aproximan por sus puntos de control: da una caja un pelo
    más grande que la real, que para recortar un logotipo es justo lo que se
    quiere.
    """
    x = y = 0.0
    ix = iy = 0.0
    xs: list[float] = []
    ys: list[float] = []

    for orden, resto in COMANDO.findall(d):
        n = [float(v) for v in NUMERO.findall(resto)]
        rel = orden.islower()
        o = orden.upper()

        if o == "Z":
            x, y = ix, iy
            continue

        if o == "H":
            for v in n:
                x = x + v if rel else v
                xs.append(x)
                ys.append(y)
            continue

        if o == "V":
            for v in n:
                y = y + v if rel else v
                xs.append(x)
                ys.append(y)
            continue

        paso = {"M": 2, "L": 2, "T": 2, "S": 4, "Q": 4, "C": 6, "A": 7}[o]
        for i in range(0, len(n) - paso + 1, paso):
            trozo = n[i : i + paso]
            if o == "A":
                # De un arco solo importa dónde termina.
                puntos = [(trozo[5], trozo[6])]
            else:
                puntos = [(trozo[j], trozo[j + 1]) for j in range(0, paso, 2)]

            for px, py in puntos:
                ax = x + px if rel else px
                ay = y + py if rel else py
                xs.append(ax)
                ys.append(ay)

            x = x + puntos[-1][0] if rel else puntos[-1][0]
            y = y + puntos[-1][1] if rel else puntos[-1][1]

            if o == "M" and i == 0:
                ix, iy = x, y

    if not xs:
        return (0.0, 0.0, 0.0, 0.0)
    return (min(xs), min(ys), max(xs), max(ys))


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit(
            "Uso: python scripts/extraer_logo_hero.py <active|swim> <svg>"
        )

    coleccion, origen = sys.argv[1], sys.argv[2]
    if coleccion not in ("active", "swim"):
        raise SystemExit("La colección es 'active' o 'swim'.")

    crudo = open(origen, "rb").read().decode("utf-8", "replace")
    # Fuera los mapas de bits: acá solo interesa el vector.
    crudo = re.sub(r'base64,[^"]+', "base64,", crudo)

    trazados = []
    for m in re.finditer(r'<path\s+d="([^"]+)"([^>]*)/?>', crudo):
        d, atributos = m.group(1), m.group(2)
        x0, y0, x1, y1 = caja(d)
        if y0 >= Y_BOTON:
            continue  # es el botón
        if (x1 - x0) < 5 or (y1 - y0) < 5:
            continue
        trazados.append((d, (x0, y0, x1, y1)))
        print(f"  trazado  {x0:7.1f},{y0:7.1f} a {x1:7.1f},{y1:7.1f}")

    if not trazados:
        raise SystemExit("No encontré el logotipo en ese SVG.")

    x0 = min(t[1][0] for t in trazados)
    y0 = min(t[1][1] for t in trazados)
    x1 = max(t[1][2] for t in trazados)
    y1 = max(t[1][3] for t in trazados)

    margen = 2.0
    x0, y0 = x0 - margen, y0 - margen
    ancho, alto = (x1 - x0) + margen, (y1 - y0) + margen

    cuerpo = "".join(f'<path d="{d}"/>' for d, _ in trazados)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="{x0:.2f} {y0:.2f} {ancho:.2f} {alto:.2f}" '
        f'fill="#ffffff" fill-rule="evenodd" clip-rule="evenodd">'
        f"{cuerpo}</svg>"
    )

    destino = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "app", "public", "hero")
    )
    os.makedirs(destino, exist_ok=True)
    ruta = os.path.join(destino, f"{coleccion}-logo.svg")
    open(ruta, "w", encoding="utf-8").write(svg)

    print(
        f"  {coleccion}-logo.svg  {ancho:.0f}x{alto:.0f}  "
        f"{round(len(svg) / 1024)} KB"
    )


if __name__ == "__main__":
    main()
