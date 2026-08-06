"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Item {
  href: string;
  etiqueta: string;
  icono: React.ReactNode;
  pronto?: boolean;
}

const trazo = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ITEMS: Item[] = [
  {
    href: "/panel",
    etiqueta: "Panel",
    icono: (
      <svg viewBox="0 0 24 24" {...trazo}>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/panel/inventario",
    etiqueta: "Inventario",
    icono: (
      <svg viewBox="0 0 24 24" {...trazo}>
        <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
        <path d="M3 7l9 4 9-4M12 11v10" />
      </svg>
    ),
  },
  {
    href: "/panel/recibir",
    etiqueta: "Recibir",
    icono: (
      <svg viewBox="0 0 24 24" {...trazo}>
        <path d="M21 8v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8" />
        <rect x="2" y="3" width="20" height="5" rx="1.5" />
        <path d="M10 12h4" />
      </svg>
    ),
  },
  {
    href: "/panel/vender",
    etiqueta: "Vender",
    icono: (
      <svg viewBox="0 0 24 24" {...trazo}>
        <path d="M6 2l1.5 4h13L18 15H8L6 2zM6 2H3" />
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="17" cy="20" r="1.5" />
      </svg>
    ),
  },
  {
    href: "/panel/caja",
    etiqueta: "Caja",
    icono: (
      <svg viewBox="0 0 24 24" {...trazo}>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.6" />
        <path d="M6 10v4M18 10v4" />
      </svg>
    ),
  },
  {
    href: "/panel/finanzas",
    etiqueta: "Finanzas",
    icono: (
      <svg viewBox="0 0 24 24" {...trazo}>
        <path d="M3 17l5-6 4 3 5-7 4 4" />
        <path d="M3 21h18" />
      </svg>
    ),
  },
  {
    href: "/panel/clientes",
    etiqueta: "Clientes",
    icono: (
      <svg viewBox="0 0 24 24" {...trazo}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
        <path d="M17 9.5a2.8 2.8 0 100-5.4M18 19.5c0-2.3-1-4-2.5-5" />
      </svg>
    ),
  },
];

function Enlace({ item, activo }: { item: Item; activo: boolean }) {
  const contenido = (
    <>
      <span className="h-5 w-5 shrink-0">{item.icono}</span>
      <span className="truncate">{item.etiqueta}</span>
      {item.pronto && (
        <span className="ml-auto shrink-0 rounded-full bg-borde/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-tinta-suave">
          pronto
        </span>
      )}
    </>
  );

  const clases = `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
    activo
      ? "bg-marron-tenue text-tinta"
      : item.pronto
        ? "text-tinta-suave/50"
        : "text-tinta-suave hover:bg-crema hover:text-tinta"
  }`;

  // Lo que aún no existe no navega: mostrarlo comunica el alcance, pero
  // llevar a una pantalla en blanco haría sentir el sistema incompleto.
  if (item.pronto) {
    return (
      <span className={clases} aria-disabled>
        {contenido}
      </span>
    );
  }
  return (
    <Link href={item.href} className={clases}>
      {contenido}
    </Link>
  );
}

export function Lateral({ usuario }: { usuario: string }) {
  const ruta = usePathname();
  const router = useRouter();

  async function salir() {
    await crearClienteNavegador().auth.signOut();
    router.replace("/entrar");
    router.refresh();
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-borde bg-crema-alto p-4 md:flex">
      <div className="mb-8 flex items-center gap-3 px-2 pt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mored-avatar.png"
          alt=""
          className="h-9 w-9 rounded-full object-cover"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mored-texto.png" alt="Mored" className="h-4 w-auto" />
      </div>

      <nav className="flex-1 space-y-1">
        {ITEMS.map((i) => (
          <Enlace key={i.href} item={i} activo={ruta === i.href} />
        ))}
      </nav>

      <div className="border-t border-borde pt-3">
        <p className="px-3 pb-2 text-sm text-tinta">{usuario}</p>
        <button
          type="button"
          onClick={salir}
          className="w-full rounded-xl px-3 py-2 text-left text-sm text-tinta-suave hover:bg-crema hover:text-tinta"
        >
          Salir
        </button>
      </div>
    </aside>
  );
}

/** En el teléfono la navegación va abajo, al alcance del pulgar. */
export function Inferior() {
  const ruta = usePathname();
  const visibles = ITEMS.filter((i) => !i.pronto);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-borde bg-crema-alto/95 backdrop-blur md:hidden">
      {visibles.map((i) => {
        const activo = ruta === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
              activo ? "text-marron-hondo" : "text-tinta-suave"
            }`}
          >
            <span className="h-5 w-5">{i.icono}</span>
            <span className="max-w-full truncate px-0.5">{i.etiqueta}</span>
          </Link>
        );
      })}
    </nav>
  );
}
