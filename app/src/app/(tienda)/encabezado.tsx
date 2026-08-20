"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { leerCarrito } from "@/lib/carrito";

const ENLACES = [
  { href: "/?c=active", texto: "Active" },
  { href: "/?c=swim", texto: "Swim" },
  { href: "/catalogo", texto: "Catálogo" },
];

/** Barra fina y blanca, con el logotipo al centro. Lo que tiene que resaltar
 *  es la ropa, no la navegación. */
export default function Encabezado() {
  const [piezas, setPiezas] = useState(0);
  const [enSwim, setEnSwim] = useState(false);

  useEffect(() => {
    const contar = () =>
      setPiezas(leerCarrito().reduce((s, x) => s + x.cantidad, 0));
    contar();
    window.addEventListener("carrito", contar);
    window.addEventListener("storage", contar);
    return () => {
      window.removeEventListener("carrito", contar);
      window.removeEventListener("storage", contar);
    };
  }, []);

  /**
   * En qué colección está parado quien mira.
   *
   * Se lee de la dirección y no de un estado compartido porque el encabezado
   * vive en la plantilla, por encima de las páginas, y no tiene forma de
   * preguntárselo a ninguna. Se mira en cada navegación: sin eso, el logotipo
   * devuelve a Active desde una prenda de Swim.
   */
  useEffect(() => {
    const mirar = () =>
      setEnSwim(new URLSearchParams(window.location.search).get("c") === "swim");
    mirar();
    window.addEventListener("popstate", mirar);
    return () => window.removeEventListener("popstate", mirar);
  });

  return (
    <header className="sticky top-0 z-30 border-b border-linea bg-nieve/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-5 py-4 lg:px-10">
        <nav className="hidden flex-1 gap-7 text-[13px] uppercase tracking-[0.14em] text-gris md:flex">
          {ENLACES.map((e) => (
            <Link key={e.href} href={e.href} className="hover:text-carbon">
              {e.texto}
            </Link>
          ))}
        </nav>

        <Link href={enSwim ? "/?c=swim" : "/"} className="shrink-0 md:mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mored-texto.png" alt="Mored" className="h-4 w-auto lg:h-5" />
        </Link>

        <div className="flex flex-1 items-center justify-end gap-5">
          <a
            href="https://instagram.com/mored.active"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="hidden text-gris hover:text-carbon sm:block"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.4}>
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </a>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("abrir-carrito"))}
            aria-label="Ver el pedido"
            className="relative text-carbon"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.4}>
              <path d="M6 8h12l-1 12H7z" />
              <path d="M9 8V6a3 3 0 016 0v2" />
            </svg>
            {piezas > 0 && (
              <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-carbon px-1 text-[10px] tabular-nums text-nieve">
                {piezas}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* En el teléfono la navegación va debajo del logotipo, en una fila que
          se desliza: así el encabezado no se come la pantalla. */}
      <nav className="-mt-1 flex gap-6 overflow-x-auto px-5 pb-3 text-[13px] uppercase tracking-[0.14em] text-gris md:hidden">
        {ENLACES.map((e) => (
          <Link key={e.href} href={e.href} className="shrink-0">
            {e.texto}
          </Link>
        ))}
      </nav>
    </header>
  );
}
