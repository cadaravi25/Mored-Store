"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { leerMoneda, MONEDA_POR_DEFECTO, type Moneda } from "./moneda";

interface Estado {
  moneda: Moneda;
  /** Bolívares por euro, del BCV. Null si todavía no hay tasa del día. */
  tasa: number | null;
}

const Contexto = createContext<Estado>({
  moneda: MONEDA_POR_DEFECTO,
  tasa: null,
});

/**
 * La moneda escogida y la tasa del día, disponibles en toda la tienda.
 *
 * Va por contexto y no como propiedad porque el precio se pinta en sitios muy
 * repartidos: la tarjeta, la ficha, el carrito y la franja de destacados.
 * Hilarlo a mano por diez componentes sería ruido en todos ellos para un dato
 * que no cambia nunca dentro de una visita.
 */
export function ProveedorMoneda({
  tasa,
  children,
}: {
  tasa: number | null;
  children: ReactNode;
}) {
  // Arranca en la de por defecto y no en la guardada a propósito: el servidor
  // no puede leer el localStorage, y si el primer dibujo no coincidiera con el
  // suyo React se quejaría de que el HTML no cuadra. Se lee tras montar.
  const [moneda, setMoneda] = useState<Moneda>(MONEDA_POR_DEFECTO);

  useEffect(() => {
    const mirar = () => setMoneda(leerMoneda());
    mirar();
    window.addEventListener("moneda", mirar);
    window.addEventListener("storage", mirar);
    return () => {
      window.removeEventListener("moneda", mirar);
      window.removeEventListener("storage", mirar);
    };
  }, []);

  return (
    <Contexto.Provider value={{ moneda, tasa }}>{children}</Contexto.Provider>
  );
}

export function useMoneda(): Estado {
  return useContext(Contexto);
}
