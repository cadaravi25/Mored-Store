"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * El recuadro que sostiene la ficha por encima del catálogo.
 *
 * Cerrar es siempre `router.back()` y no ir a una dirección: así el catálogo
 * de atrás vuelve exactamente donde estaba. Si alguien venía de la prenda 300,
 * sale y sigue en la 300, que era el problema de antes.
 *
 * Se cierra con la equis, con Escape, tocando el fondo y con el botón de atrás
 * del teléfono, que es el mismo gesto que el resto de la web.
 */
export default function Overlay({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    document.addEventListener("keydown", tecla);

    // Sin esto, rodar dentro de la ficha arrastra también el catálogo de
    // detrás, y al cerrar el catálogo aparece en otro sitio.
    //
    // Al soltar se vuelve al valor vacío en vez de al que hubiera antes: este
    // es el único sitio de la tienda que toca el desplazamiento del cuerpo, y
    // guardar el valor anterior deja el catálogo trabado para siempre si por
    // lo que sea llegaran a montarse dos fichas, porque la segunda guardaría
    // el "hidden" que puso la primera.
    document.body.style.overflow = "hidden";

    // El foco entra en el recuadro para que quien navegue con el teclado no
    // siga tabulando por el catálogo que ya no está mirando.
    caja.current?.focus();

    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
    };
  }, [router]);

  return (
    <div
      // En el teléfono la ficha se pega abajo y deja asomar una franja del
      // catálogo: sin ella la ficha ocupa la pantalla entera y no hay forma de
      // saber que estás encima de algo y no en otra página.
      className="fixed inset-0 z-[60] flex items-end justify-center overscroll-contain bg-carbon/50 p-0 backdrop-blur-md lg:items-center lg:p-8"
      onClick={(e) => {
        // Solo el fondo cierra. Un clic dentro de la ficha no.
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="hoja relative h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-nieve shadow-2xl outline-none lg:h-auto lg:max-h-[90dvh] lg:w-[80%] lg:rounded-2xl"
      >
        {/* El asa de las hojas del teléfono. Es decorativa: quien la ve ya sabe
            que esto se baja. Cerrar de verdad es la equis, el fondo, Escape o
            el botón de atrás. */}
        <div
          aria-hidden="true"
          className="sticky top-0 z-10 flex justify-center bg-nieve pb-1 pt-2.5 lg:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-gris/30" />
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-nieve/90 text-lg leading-none text-gris shadow-sm backdrop-blur hover:text-carbon"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
