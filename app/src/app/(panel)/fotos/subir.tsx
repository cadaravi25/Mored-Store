"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

export interface ColorFoto {
  id: string;
  nombre: string;
  foto_url: string | null;
  producto_id: string;
  producto: string;
  coleccion: "active" | "swim";
  hex: string | null;
  variantes: number;
}

const MAXIMO = 5 * 1024 * 1024;

/**
 * Una foto por color. No por variante: cuatro tallas del mismo top en el mismo
 * color son la misma foto, y pedirla cuatro veces sería trabajo inventado.
 */
export default function Subir({ color }: { color: ColorFoto }) {
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const [pegando, setPegando] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function guardarUrl(valor: string) {
    const { error: fallo } = await crearClienteNavegador()
      .from("colores")
      .update({ foto_url: valor })
      .eq("id", color.id);

    if (fallo) {
      setError(fallo.message);
      return false;
    }
    router.refresh();
    return true;
  }

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    if (archivo.size > MAXIMO) {
      setError("Esa foto pesa demasiado. Máximo 5 MB.");
      return;
    }
    setSubiendo(true);
    setError(null);

    const supabase = crearClienteNavegador();
    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
    // El nombre lleva la marca de tiempo para que reemplazar una foto no se
    // quede pegado en la caché del navegador de nadie.
    const ruta = `${color.producto_id}/${color.id}-${Date.now()}.${extension}`;

    const { error: fallo } = await supabase.storage
      .from("fotos")
      .upload(ruta, archivo, { cacheControl: "31536000", upsert: true });

    if (fallo) {
      setError(fallo.message);
      setSubiendo(false);
      return;
    }

    const { data } = supabase.storage.from("fotos").getPublicUrl(ruta);
    await guardarUrl(data.publicUrl);
    setSubiendo(false);
  }

  async function pegar() {
    const valor = url.trim();
    if (!valor.startsWith("http")) {
      setError("Eso no parece un enlace de imagen.");
      return;
    }
    setSubiendo(true);
    setError(null);
    if (await guardarUrl(valor)) {
      setUrl("");
      setPegando(false);
    }
    setSubiendo(false);
  }

  async function quitar() {
    setSubiendo(true);
    await guardarUrl("");
    // Se guarda vacío y luego se limpia a null, que es lo que la vista pública
    // usa para decidir si la prenda sale o no.
    await crearClienteNavegador()
      .from("colores")
      .update({ foto_url: null })
      .eq("id", color.id);
    router.refresh();
    setSubiendo(false);
  }

  return (
    <div className="rounded-2xl border border-borde bg-crema-alto p-3">
      <div className="flex items-center gap-3">
        {color.foto_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={color.foto_url}
            alt=""
            className="h-16 w-16 shrink-0 rounded-xl border border-borde object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="h-16 w-16 shrink-0 rounded-xl border border-dashed border-borde"
            style={{ background: color.hex ?? "transparent" }}
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-tinta">{color.producto}</p>
          <p className="text-xs capitalize text-tinta-suave">
            {color.nombre} · {color.variantes}{" "}
            {color.variantes === 1 ? "talla" : "tallas"}
          </p>
          {!color.foto_url && (
            <p className="mt-0.5 text-xs text-alerta">No sale en la tienda</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-xl border border-borde px-3 py-2 text-sm text-tinta hover:border-marron-suave">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              subir(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {subiendo ? "Subiendo…" : color.foto_url ? "Cambiar" : "Subir foto"}
        </label>

        <button
          type="button"
          onClick={() => setPegando(!pegando)}
          className="text-sm text-marron-hondo underline-offset-4 hover:underline"
        >
          o pegar un enlace
        </button>

        {color.foto_url && (
          <button
            type="button"
            onClick={quitar}
            className="ml-auto text-sm text-tinta-suave underline-offset-4 hover:underline"
          >
            Quitar
          </button>
        )}
      </div>

      {pegando && (
        <div className="mt-2 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            autoCapitalize="none"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-borde bg-crema px-3 py-2 text-sm outline-none focus:border-marron"
          />
          <button
            type="button"
            onClick={pegar}
            disabled={subiendo}
            className="shrink-0 rounded-lg bg-tinta px-3 py-2 text-sm text-crema-alto disabled:opacity-50"
          >
            Usar
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-alerta">{error}</p>}
    </div>
  );
}
