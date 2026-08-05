import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mored",
  description:
    "Ropa deportiva y de playa. Mored Active y Mored Swim, en Caracas.",
};

/**
 * La tienda no lleva el armazón del panel: ni menú lateral ni sesión. Es lo
 * que ve quien llega desde Instagram, y tiene que abrir rápido en un teléfono.
 */
export default function TiendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-crema">
      <header className="sticky top-0 z-20 border-b border-borde bg-crema/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 py-3">
          <Link href="/tienda" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mored-avatar.png"
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mored-texto.png" alt="Mored" className="h-3.5 w-auto" />
          </Link>
        </div>
      </header>

      {children}

      <footer className="mt-16 border-t border-borde px-5 py-10 text-center text-sm text-tinta-suave">
        <p>CC Manuelita Sáenz · Chacaíto · nivel 2, local 02-178</p>
        <p className="mt-2">
          <a
            href="https://instagram.com/mored.active"
            className="underline-offset-4 hover:underline"
          >
            @mored.active
          </a>
          <span className="px-2">·</span>
          <a
            href="https://instagram.com/moredswim"
            className="underline-offset-4 hover:underline"
          >
            @moredswim
          </a>
        </p>
        <p className="mt-4 text-xs">
          Cambio de talla dentro de 24 horas. No se aceptan devoluciones.
        </p>
      </footer>
    </div>
  );
}
