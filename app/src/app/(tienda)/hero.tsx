"use client";

import { useEffect, useRef, useState } from "react";

export type Coleccion = "active" | "swim";

/**
 * El hero de la portada.
 *
 * La idea que lo sostiene: el LOGOTIPO VA DETRÁS DE LA MODELO. El fondo, el
 * texto y la modelo son tres capas separadas y por eso el apilado importa:
 *
 *   z-0  el paisaje
 *   z-10 MORED y el nombre de la colección
 *   z-20 la modelo recortada, tapando parte del logotipo
 *   z-30 el botón
 *
 * Al entrar y al cambiar de colección cada capa se mueve a distinta velocidad,
 * así la escena tiene profundidad en vez de ser una foto plana con letras
 * encima. Para eso hacía falta la modelo recortada aparte del fondo.
 */

interface Escena {
  nombre: string;
  fondo: string;
  modelo: string;
  /** Se ve mientras carga la foto, y si el archivo todavía no existe. */
  respaldo: string;
  esquinaIzq: string;
  esquinaDer: string;
}

const ESCENAS: Record<Coleccion, Escena> = {
  active: {
    nombre: "Active",
    fondo: "/hero/active-fondo.webp",
    modelo: "/hero/active-modelo.webp",
    respaldo: "linear-gradient(160deg, #c9a583 0%, #a78a6a 45%, #6f5942 100%)",
    esquinaIzq: "Ropa deportiva",
    esquinaDer: "Tienda en Chacaíto",
  },
  swim: {
    nombre: "Swim",
    fondo: "/hero/swim-fondo.webp",
    modelo: "/hero/swim-modelo.webp",
    respaldo: "linear-gradient(160deg, #f3d9c9 0%, #e0827a 55%, #9fc3cc 100%)",
    esquinaIzq: "Trajes de baño",
    esquinaDer: "Envíos a todo el país",
  },
};

const SUAVE = { transitionTimingFunction: "var(--curva)" } as const;

function Fondo({ escena, activa }: { escena: Escena; activa: boolean }) {
  const [falta, setFalta] = useState(false);
  return (
    <div
      aria-hidden
      className="absolute inset-0 transition-opacity duration-[900ms]"
      style={{ ...SUAVE, opacity: activa ? 1 : 0 }}
    >
      <div
        className="absolute inset-0 transition-transform duration-[1400ms]"
        style={{
          ...SUAVE,
          transform: activa ? "scale(1)" : "scale(1.08)",
          background: escena.respaldo,
        }}
      >
        {!falta && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={escena.fondo}
            alt=""
            onError={() => setFalta(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      {/* Velo tenue: el logotipo es blanco y tiene que leerse sobre cualquier
          foto, incluidas las de cielo claro. */}
      <div className="absolute inset-0 bg-gradient-to-b from-carbon/25 via-carbon/10 to-carbon/35" />
    </div>
  );
}

function Modelo({ escena, activa }: { escena: Escena; activa: boolean }) {
  const [falta, setFalta] = useState(false);
  if (falta) return null;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={escena.modelo}
      alt=""
      aria-hidden
      onError={() => setFalta(true)}
      className="absolute bottom-0 left-0 h-[86%] w-auto max-w-[70%] object-contain object-left-bottom transition-all duration-[1100ms] sm:h-[92%] sm:max-w-[52%] lg:h-[95%] lg:max-w-[44%]"
      style={{
        ...SUAVE,
        opacity: activa ? 1 : 0,
        transform: activa ? "none" : "translateY(28px) scale(0.97)",
      }}
    />
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

  // El nombre de la colección se rearma en cada cambio. Es el detalle que hace
  // que se lea como una escena nueva y no como un texto reemplazado.
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    setClave((n) => n + 1);
  }, [coleccion]);

  return (
    <section className="relative h-[78vh] min-h-[520px] w-full overflow-hidden bg-carbon lg:h-[88vh]">
      <Fondo escena={ESCENAS.active} activa={coleccion === "active"} />
      <Fondo escena={ESCENAS.swim} activa={coleccion === "swim"} />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-5 text-center">
        <div className="acerca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mored-blanco.png"
            alt="Mored"
            className="w-[64vw] max-w-[560px] drop-shadow-[0_2px_28px_rgba(0,0,0,0.28)] sm:w-[48vw]"
          />
        </div>
        <p
          key={clave}
          className="abre-letras mt-5 pl-[0.5em] text-[13px] uppercase tracking-[0.5em] text-nieve sm:text-base"
        >
          {ESCENAS[coleccion].nombre}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        <Modelo escena={ESCENAS.active} activa={coleccion === "active"} />
        <Modelo escena={ESCENAS.swim} activa={coleccion === "swim"} />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 px-5 pb-7 lg:px-10">
        <div className="flex justify-center pb-8 lg:pb-12">
          <button
            type="button"
            onClick={() => onCambiar(otra)}
            className="surge border border-nieve/70 bg-nieve/10 px-10 py-3.5 text-[13px] uppercase tracking-[0.24em] text-nieve backdrop-blur-sm transition-colors hover:bg-nieve hover:text-carbon"
            style={{ animationDelay: "0.5s" }}
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
