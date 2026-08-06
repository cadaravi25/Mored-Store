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
  /** ACTIVE y SWIM son parte del logotipo, no texto: vienen del propio
   *  archivo de marca y no se recomponen con una tipografía cualquiera.
   *  MORED va aparte porque no cambia entre colecciones. */
  palabra: string;
  /** Ancho de la palabra respecto al de MORED, tal como está en el diseño. */
  anchoPalabra: string;
  /** Se ve mientras carga la foto, y si el archivo todavía no existe. */
  respaldo: string;
  etiqueta: string;
}

const ESCENAS: Record<Coleccion, Escena> = {
  active: {
    nombre: "Active",
    fondo: "/hero/active-fondo.webp",
    modela: "/hero/active-modela.webp",
    palabra: "/hero/active-palabra.svg",
    anchoPalabra: "41.5%",
    respaldo: "linear-gradient(150deg, #c9a583 0%, #a78a6a 50%, #6f5942 100%)",
    etiqueta: "Ropa deportiva",
  },
  swim: {
    nombre: "Swim",
    fondo: "/hero/swim-fondo.webp",
    modela: "/hero/swim-modela.webp",
    palabra: "/hero/swim-palabra.svg",
    anchoPalabra: "28.7%",
    respaldo: "linear-gradient(150deg, #f3d9c9 0%, #e0827a 55%, #9fc3cc 100%)",
    etiqueta: "Trajes de baño",
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
  const ref = useRef<HTMLImageElement>(null);
  const [estado, setEstado] = useState<"cargando" | "lista" | "falta">(
    "cargando",
  );

  // Si la imagen ya estaba cargada antes de que React tomara el control, su
  // onLoad nunca se dispara y se quedaría invisible para siempre. Pasa
  // siempre que viene de la caché, que es casi todas las veces.
  useEffect(() => {
    const im = ref.current;
    if (!im?.complete) return;
    setEstado(im.naturalWidth > 0 ? "lista" : "falta");
  }, []);

  if (estado === "falta") return null;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      ref={ref}
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
          así se cruzan sin taparse del todo, como en la referencia.

          MORED no se mueve nunca: es el mismo en las dos colecciones y verlo
          desaparecer para volver igual no aporta nada. Lo único que cambia es
          la palabra de abajo. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex justify-center px-6 lg:justify-end lg:pr-[9%]">
        <div className="flex h-full w-[74vw] max-w-[520px] flex-col justify-center lg:w-[36vw]">
          <div className="acerca w-full drop-shadow-[0_2px_20px_rgba(0,0,0,0.22)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero/mored.svg" alt="Mored" className="w-full" />

            {/* Las dos palabras van centradas bajo MORED, como en el archivo
                de marca, y del mismo alto relativo. */}
            <div className="relative mt-[5.14%] aspect-[2032/100] w-full">
              {(["active", "swim"] as const).map((id) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={id}
                  src={ESCENAS[id].palabra}
                  alt={ESCENAS[id].nombre}
                  className="absolute left-1/2 top-1/2 h-auto transition-all duration-[700ms]"
                  style={{
                    ...SUAVE,
                    width: ESCENAS[id].anchoPalabra,
                    opacity: coleccion === id ? 1 : 0,
                    transform: `translate(-50%, -50%) ${
                      coleccion === id ? "" : "translateY(8px)"
                    }`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fundido simple, las dos a la vez. Escalonarlas evitaba el instante
          con las dos superpuestas, pero se sentía como si la página se hubiera
          trabado: peor el remedio que la enfermedad. */}
      <div className="pointer-events-none absolute inset-0 z-20">
        {(["active", "swim"] as const).map((id) => (
          <div
            key={id}
            className="absolute bottom-0 left-0 h-[88%] w-[62%] sm:h-[94%] sm:w-[46%] lg:w-[42%]"
            style={{
              ...SUAVE,
              transitionProperty: "opacity, transform",
              transitionDuration: "700ms",
              opacity: coleccion === id ? 1 : 0,
              transform:
                coleccion === id ? "none" : "translateY(18px) scale(0.985)",
            }}
          >
            <Foto
              src={ESCENAS[id].modela}
              className="h-full w-full object-contain object-left-bottom"
            />
          </div>
        ))}
      </div>

      {/* El botón repite EXACTAMENTE el contenedor del logotipo: mismo padre a
          toda altura, mismo relleno lateral y mismo ancho de columna. Con
          contenedores distintos, cualquier diferencia de relleno lo corría
          unos píxeles y el centro dejaba de coincidir con MORED. */}
      <div className="pointer-events-none absolute inset-0 z-30 flex justify-center px-6 lg:justify-end lg:pr-[9%]">
        <div className="flex h-full w-[74vw] max-w-[520px] items-end justify-center pb-[16%] lg:w-[36vw] lg:pb-[13%]">
          <button
            type="button"
            onClick={() => onCambiar(otra)}
            className="surge pointer-events-auto rounded-full border border-nieve/80 px-11 py-3.5 text-[12px] uppercase tracking-[0.28em] text-nieve backdrop-blur-[2px] transition-colors hover:bg-nieve hover:text-carbon"
            style={{ animationDelay: "0.55s" }}
          >
            Ver {ESCENAS[otra].nombre}
          </button>
        </div>
      </div>

      {/* Una sola etiqueta, a la derecha: dice qué es esta colección. La otra
          esquina repetía datos que ya están en el pie. */}
      <p
        key={`e${clave}`}
        className="surge absolute bottom-7 right-5 z-30 text-[10px] uppercase tracking-[0.24em] text-nieve/70 lg:right-10"
      >
        {ESCENAS[coleccion].etiqueta}
      </p>

    </section>
  );
}
