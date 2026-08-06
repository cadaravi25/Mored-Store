/**
 * El pie es el único sitio donde vive esta información.
 *
 * Antes estaba repetida: una franja encima decía lo mismo que el pie con otras
 * palabras. Repetir no refuerza, resta: al leerlo dos veces se nota el relleno.
 */
export default function Pie() {
  return (
    <footer id="visitanos" className="mt-24 border-t border-linea bg-humo">
      <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-10">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mored-texto.png" alt="Mored" className="h-4 w-auto" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-gris">
            Ropa deportiva y de playa. Dos colecciones, una tienda en Caracas y
            envíos a todo el país.
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-carbon">
            Cómo se pide
          </p>
          <p className="mt-4 text-sm leading-relaxed text-gris">
            Armas tu pedido y se abre el chat de WhatsApp con todo escrito. Ahí
            acordamos el pago y la entrega.
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-carbon">
            La tienda
          </p>
          <p className="mt-4 text-sm leading-relaxed text-gris">
            CC Manuelita Sáenz
            <br />
            Chacaíto, nivel 2
            <br />
            Local 02-178
          </p>
          <p className="mt-3 text-sm text-gris">
            Puedes venir a medirte lo que viste aquí.
          </p>
        </div>

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
