import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import Subir, { type ColorFoto } from "./subir";

export const dynamic = "force-dynamic";

interface Fila {
  id: string;
  nombre: string;
  foto_url: string | null;
  producto_id: string;
  productos: { nombre: string; coleccion: "active" | "swim"; activo: boolean } | null;
  variantes: { id: string }[];
}

export default async function Fotos() {
  const supabase = await crearClienteServidor();

  const [{ data: filas }, { data: catalogo }] = await Promise.all([
    supabase
      .from("colores")
      .select(
        "id,nombre,foto_url,producto_id,productos(nombre,coleccion,activo),variantes(id)",
      )
      .order("nombre"),
    supabase.from("colores_catalogo").select("nombre,hex"),
  ]);

  const hex = new Map(
    (catalogo ?? []).map((c) => [c.nombre.toLowerCase(), c.hex as string | null]),
  );

  const colores: ColorFoto[] = ((filas ?? []) as unknown as Fila[])
    .filter((f) => f.productos?.activo)
    .map((f) => ({
      id: f.id,
      nombre: f.nombre,
      foto_url: f.foto_url,
      producto_id: f.producto_id,
      producto: f.productos?.nombre ?? "",
      coleccion: f.productos?.coleccion ?? "active",
      hex: hex.get(f.nombre.toLowerCase()) ?? null,
      variantes: f.variantes?.length ?? 0,
    }))
    .sort((a, b) =>
      Number(Boolean(a.foto_url)) - Number(Boolean(b.foto_url)) ||
      a.producto.localeCompare(b.producto),
    );

  const faltan = colores.filter((c) => !c.foto_url).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-7">
      <header className="mb-6">
        <h1 className="text-2xl text-tinta">Fotos</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          {colores.length === 0
            ? "Todavía no hay prendas cargadas"
            : faltan === 0
              ? `Las ${colores.length} tienen foto. La tienda está completa.`
              : `Faltan ${faltan} de ${colores.length}. Sin foto, la prenda no sale en la tienda.`}
        </p>
        {faltan < colores.length && (
          <Link
            href="/tienda"
            target="_blank"
            className="mt-2 inline-block text-sm text-marron-hondo underline-offset-4 hover:underline"
          >
            Ver la tienda ↗
          </Link>
        )}
      </header>

      {colores.length === 0 ? (
        <p className="rounded-2xl border border-borde bg-crema-alto py-14 text-center text-sm text-tinta-suave">
          Carga mercancía en Recibir y aquí van apareciendo los colores.
        </p>
      ) : (
        <ul className="space-y-2">
          {colores.map((c) => (
            <li key={c.id}>
              <Subir color={c} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
