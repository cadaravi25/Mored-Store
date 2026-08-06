"use client";

import { useEffect, useRef, useState } from "react";

export type Coleccion = "active" | "swim";

/**
 * El hero de la portada.
 *
 * Cuatro capas, y el orden es lo que le da profundidad:
 *
 *   z-0   el paisaje
 *   z-10  MORED y el nombre de la colección
 *   z-20  la modela recortada, que tapa parte del logotipo
 *   z-30  el botón y las esquinas
 *
 * Al entrar y al cambiar de colección cada capa se mueve a distinta velocidad.
 * Para eso hacía falta la modela recortada aparte del fondo.
 */

interface Escena {
  nombre: string;
  fondo: string;
  modela: string;
  /** MORED ACTIVE y MORED SWIM son el logotipo, no texto: vienen del propio
   *  archivo de marca y no se recomponen con una tipografía cualquiera. */
  logo: string;
  /** Se ve mientras carga la foto, y si el archivo todavía no existe. */
  respaldo: string;
  esquinaIzq: string;
  esquinaDer: string;
}

const ESCENAS: Record<Coleccion, Escena> = {
  active: {
    nombre: "Active",
    fondo: "/hero/active-fondo.webp",
    modela: "/hero/active-modela.webp",
    logo: "/hero/active-logo.svg",
    respaldo: "linear-gradient(150deg, #c9a583 0%, #a78a6a 50%, #6f5942 100%)",
    esquinaIzq: "Ropa deportiva",
    esquinaDer: "Tienda en Chacaíto",
  },
  swim: {
    nombre: "Swim",
    fondo: "/hero/swim-fondo.webp",
    modela: "/hero/swim-modela.webp",
    logo: "/hero/swim-logo.svg",
    respaldo: "linear-gradient(150deg, #f3d9c9 0%, #e0827a 55%, #9fc3cc 100%)",
    esquinaIzq: "Trajes de baño",
    esquinaDer: "Envíos a todo el país",
  },
};

const SUAVE = { transitionTimingFunction: "var(--curva)" } as const;

/**
 * Una foto que todavía no existe no debe dejar el ícono de imagen rota. Nace
 * invisible y solo se muestra cuando cargó; si falla, desaparece y queda el
 * degradado de marca.
 */
function Foto({
  src,
  className,
  style,
}: {
  src: string;
  className: string;
  style?: React.CSSProperties;
}) {
  const [estado, setEstado] = useState<"cargando" | "lista" | "falta">(
    "cargando",
  );
  if (estado === "falta") return null;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      aria-hidden
      onLoad={() => setEstado("lista")}
      onError={() => setEstado("falta")}
      className={`${className} transition-opacity duration-700`}
      style={{ ...style, opacity: estado === "lista" ? undefined : 0 }}
    />
  );
}

function Fondo({ escena, activa }: { escena: Escena; activa: boolean }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 transition-opacity duration-[900ms]"
      style={{ ...SUAVE, opacity: activa ? 1 : 0 }}
    >
      <div
        className="absolute inset-0 transition-transform duration-[1600ms]"
        style={{
          ...SUAVE,
          transform: activa ? "scale(1)" : "scale(1.08)",
          background: escena.respaldo,
        }}
      >
        <Foto src={escena.fondo} className="h-full w-full object-cover" />
      </div>
      {/* Velo muy tenue: el logotipo es blanco y tiene que leerse también
          sobre un cielo claro, sin apagar la foto. */}
      <div className="absolute inset-0 bg-gradient-to-b from-carbon/15 via-transparent to-carbon/30" />
    </div>
  );
}

export default function Hero({
  coleccion,
  onCambiar,
}: {
  coleccion: Coleccion;
  onCambiar: (c: Coleccion) => void;
}) {
  const otra: Coleccion = coleccion === "active" ? "swim" : "active";
  const [clave, setClave] = useState(0);
  const primera = useRef(true);

  // El nombre de la colección se rearma en cada cambio: se lee como una escena
  // nueva y no como un texto que se reemplazó.
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    setClave((n) => n + 1);
  }, [coleccion]);

  return (
    <section className="relative h-[76vh] min-h-[500px] w-full overflow-hidden bg-carbon lg:h-[86vh]">
      <Fondo escena={ESCENAS.active} activa={coleccion === "active"} />
      <Fondo escena={ESCENAS.swim} activa={coleccion === "swim"} />

      {/* El logotipo va corrido a la derecha: la modela ocupa la izquierda, y
          así se cruzan sin taparse del todo, como en la referencia. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 lg:justify-end lg:pr-[9%]">
        <div className="relative aspect-[705/227] w-[74vw] max-w-[520px] lg:w-[36vw]">
          {(["active", "swim"] as const).map((id) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={id}
              src={ESCENAS[id].logo}
              alt={`Mored ${ESCENAS[id].nombre}`}
              className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_2px_20px_rgba(0,0,0,0.22)] transition-all duration-[900ms]"
              style={{
                ...SUAVE,
                opacity: coleccion === id ? 1 : 0,
                transform:
                  coleccion === id ? "none" : "translateY(14px) scale(0.97)",
              }}
            />
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        {(["active", "swim"] as const).map((id) => (
          <div
            key={id}
            className="absolute bottom-0 left-0 h-[88%] w-[62%] transition-all duration-[1100ms] sm:h-[94%] sm:w-[46%] lg:w-[42%]"
            style={{
              ...SUAVE,
              opacity: coleccion === id ? 1 : 0,
              transform:
                coleccion === id ? "none" : "translateY(26px) scale(0.97)",
            }}
          >
            <Foto
              src={ESCENAS[id].modela}
              className="h-full w-full object-contain object-left-bottom"
            />
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 px-5 pb-7 lg:px-10">
        <div className="flex justify-center pb-9 lg:justify-end lg:pb-14 lg:pr-[10%]">
          <button
            type="button"
            onClick={() => onCambiar(otra)}
            className="surge border border-nieve/80 px-11 py-3.5 text-[12px] uppercase tracking-[0.28em] text-nieve backdrop-blur-[2px] transition-colors hover:bg-nieve hover:text-carbon"
            style={{ animationDelay: "0.55s" }}
          >
            Ver {ESCENAS[otra].nombre}
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-nieve/70">
          <span key={`i${clave}`} className="surge">
            {ESCENAS[coleccion].esquinaIzq}
          </span>
          <span key={`d${clave}`} className="surge text-right">
            {ESCENAS[coleccion].esquinaDer}
          </span>
        </div>
      </div>
    </section>
  );
}
