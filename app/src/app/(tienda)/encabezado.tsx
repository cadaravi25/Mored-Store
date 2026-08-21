"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { leerCarrito } from "@/lib/carrito";

/**
 * Barra fina y blanca, con el logotipo al centro. Lo que tiene que resaltar
 * es la ropa, no la navegación.
 *
 * TODO EN UNA FILA, TAMBIÉN EN EL TELÉFONO
 *
 * Antes la navegación bajaba a una segunda fila en pantallas pequeñas y el
 * encabezado ocupaba el doble. Cabe en una: los enlaces se achican un punto y
 * el logotipo se queda en el centro con las dos mitades empujando por igual.
 *
 * LOS ENLACES NO DICEN LO MISMO EN TODAS PARTES
 *
 * En la portada, Active y Swim llevan a la portada de esa colección. Dentro
 * del catálogo eso era un callejón: pulsabas Swim estando en el catálogo y te
 * sacaba a la página principal. Ahí los mismos dos enlaces cambian de
 * colección sin sacarte, y Catálogo desaparece porque ya estás en él.
 */
export default function Encabezado() {
  const [piezas, setPiezas] = useState(0);
  const [enSwim, setEnSwim] = useState(false);
  const ruta = usePathname();
  const enCatalogo = ruta?.startsWith("/catalogo") ?? false;

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

  const enlaces = enCatalogo
    ? [
        { href: "/catalogo?c=active", texto: "Active", puesto: !enSwim },
        { href: "/catalogo?c=swim", texto: "Swim", puesto: enSwim },
      ]
    : [
        { href: "/?c=active", texto: "Active", puesto: false },
        { href: "/?c=swim", texto: "Swim", puesto: false },
        { href: "/catalogo", texto: "Catálogo", puesto: false },
      ];

  return (
    <header className="sticky top-0 z-30 border-b border-linea bg-nieve/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-5 py-4 sm:gap-4 lg:px-10">
        <nav className="flex flex-1 gap-3.5 text-[11px] uppercase tracking-[0.1em] text-gris sm:gap-7 sm:text-[13px] sm:tracking-[0.14em]">
          {enlaces.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              // Dentro del catálogo hay una de las dos puesta, y se nota:
              // si no, no hay forma de saber qué estás mirando.
              className={`whitespace-nowrap hover:text-carbon ${
                e.puesto ? "text-carbon" : ""
              }`}
            >
              {e.texto}
            </Link>
          ))}
        </nav>

        <Link
          href={enSwim ? "/?c=swim" : "/"}
          aria-label="Mored, ir al inicio"
          className="shrink-0"
        >
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
    </header>
  );
}
