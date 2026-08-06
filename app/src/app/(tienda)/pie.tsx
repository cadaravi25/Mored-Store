import Link from "next/link";

const COLUMNAS = [
  {
    titulo: "Comprar",
    enlaces: [
      { texto: "Mored Active", href: "/?c=active" },
      { texto: "Mored Swim", href: "/?c=swim" },
      { texto: "Todo el catálogo", href: "/#catalogo" },
    ],
  },
  {
    titulo: "La tienda",
    enlaces: [
      { texto: "CC Manuelita Sáenz", href: "/#visitanos" },
      { texto: "Chacaíto, nivel 2", href: "/#visitanos" },
      { texto: "Local 02-178", href: "/#visitanos" },
    ],
  },
];

export default function Pie() {
  return (
    <footer className="mt-24 border-t border-linea bg-humo">
      <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-10">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mored-texto.png" alt="Mored" className="h-4 w-auto" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-gris">
            Ropa deportiva y de playa. Dos colecciones, una tienda en Caracas y
            envíos a todo el país.
          </p>
        </div>

        {COLUMNAS.map((c) => (
          <div key={c.titulo}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-carbon">
              {c.titulo}
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-gris">
              {c.enlaces.map((e) => (
                <li key={e.texto}>
                  <Link href={e.href} className="hover:text-carbon">
                    {e.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-carbon">
            Escríbenos
          </p>
          <ul className="mt-4 space-y-2.5 text-sm text-gris">
            <li>
              <a
                href="https://instagram.com/mored.active"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-carbon"
              >
                @mored.active
              </a>
            </li>
            <li>
              <a
                href="https://instagram.com/moredswim"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-carbon"
              >
                @moredswim
              </a>
            </li>
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-gris">
            Cambio de talla dentro de 24 horas.
            <br />
            No se aceptan devoluciones.
            <br />
            Los colores claros no se prueban.
          </p>
        </div>
      </div>

      <div className="border-t border-linea px-5 py-5 text-center text-xs text-gris lg:px-10">
        Mored · Caracas, Venezuela
      </div>
    </footer>
  );
}
