"use client";

import { useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { rutaDeFoto } from "@/lib/fotos";

const MAXIMO = 5 * 1024 * 1024;

/**
 * La foto del color, desde la misma tarjeta del inventario.
 *
 * Va a nivel de color y no de variante: cuatro tallas del mismo top en el
 * mismo color son la misma foto. Y es lo que decide si la prenda sale o no en
 * la tienda pública, así que el aviso de que falta vive aquí, donde ellas ya
 * están mirando el inventario, y no en una pantalla aparte que nadie abre.
 */
export default function Foto({
  productoId,
  color,
  hex,
  inicial,
  letra,
}: {
  productoId: string;
  color: string;
  hex: string | null;
  inicial: string | null;
  letra: string;
}) {
  const [url, setUrl] = useState<string | null>(inicial);
  const [enlace, setEnlace] = useState("");
  const [pegando, setPegando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [roto, setRoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El color es único dentro del producto, así que con esos dos datos se llega
  // a la fila sin arrastrar el id por toda la búsqueda.
  async function guardar(valor: string | null) {
    const { error: fallo } = await crearClienteNavegador()
      .from("colores")
      .update({ foto_url: valor })
      .eq("producto_id", productoId)
      .eq("nombre", color);

    if (fallo) {
      setError(fallo.message);
      return false;
    }
    setUrl(valor);
    setRoto(false);
    setError(null);
    return true;
  }

  /** Acepta el enlace del producto, no solo el de la foto: desde un teléfono
   *  sacar el de la imagen es un fastidio y el del producto está a un toque.
   *
   *  Sea cual sea, la foto se baja y se queda en el depósito propio. Apuntar a
   *  la de otro sitio se rompe el día que la borran o bloquean verla desde
   *  fuera, y la tienda queda con un cuadro roto. */
  async function desdeEnlace() {
    const valor = enlace.trim();
    if (!valor.startsWith("http")) {
      setError("Eso no parece un enlace.");
      return;
    }
    setOcupado(true);
    setError(null);

    const r = await fetch("/api/foto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ producto_id: productoId, color, url: valor }),
    });
    const datos = await r.json().catch(() => ({}));

    if (!r.ok) {
      setError(datos.error ?? "No se pudo guardar esa foto.");
      setOcupado(false);
      return;
    }

    setUrl(datos.url);
    setEnlace("");
    setPegando(false);
    setRoto(false);
    setOcupado(false);
  }

  /**
   * Pegar la foto desde el portapapeles.
   *
   * Es la salida al muro de SHEIN. Su servidor nos bloquea y sus fotos no
   * vienen en la página, pero el TELÉFONO de ellas sí las tiene: las está
   * viendo. Mantener presionada la imagen, "Copiar imagen", y pegar aquí.
   * Quien baja la foto es su navegador, que sí tiene permiso de verla.
   */
  async function pegarFoto() {
    setError(null);
    try {
      const partes = await navigator.clipboard.read();
      for (const parte of partes) {
        const tipo = parte.types.find((t) => t.startsWith("image/"));
        if (!tipo) continue;
        const blob = await parte.getType(tipo);
        await subir(
          new File([blob], `pegada.${tipo.split("/")[1]}`, { type: tipo }),
        );
        return;
      }
      setError("No hay ninguna foto copiada. Copia la imagen primero.");
    } catch {
      setError("El navegador no dejó leer lo copiado. Prueba con Subir foto.");
    }
  }

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    if (archivo.size > MAXIMO) {
      setError("Máximo 5 MB.");
      return;
    }
    setOcupado(true);
    setError(null);

    const supabase = crearClienteNavegador();
    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const ruta = rutaDeFoto(productoId, color, extension);

    const { error: fallo } = await supabase.storage
      .from("fotos")
      .upload(ruta, archivo, { cacheControl: "31536000", upsert: true });

    if (fallo) {
      setError(fallo.message);
      setOcupado(false);
      return;
    }

    const { data } = supabase.storage.from("fotos").getPublicUrl(ruta);
    await guardar(data.publicUrl);
    setOcupado(false);
  }

  return (
    <div
      className="shrink-0"
      onPaste={(e) => {
        const archivo = Array.from(e.clipboardData.files).find((f) =>
          f.type.startsWith("image/"),
        );
        if (archivo) {
          e.preventDefault();
          subir(archivo);
        }
      }}
    >
      <label className="relative block h-20 w-20 cursor-pointer">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            subir(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {url && !roto ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt=""
            onError={() => setRoto(true)}
            className="h-20 w-20 rounded-lg border border-borde object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-marron-suave"
            style={{ backgroundColor: hex ?? "#efe9dd" }}
          >
            {!hex && <span className="text-lg text-tinta-suave">{letra}</span>}
          </span>
        )}

        <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border border-borde bg-crema-alto text-tinta-suave">
          {ocupado ? (
            <span className="block h-3 w-3 animate-spin rounded-full border-2 border-marron border-t-transparent" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
          )}
        </span>
      </label>

      <div className="mt-1 flex w-24 flex-wrap gap-x-2 text-[11px] text-tinta-suave">
        <button
          type="button"
          onClick={pegarFoto}
          className="underline-offset-2 hover:underline"
        >
          pegar
        </button>
        <button
          type="button"
          onClick={() => setPegando(!pegando)}
          className="underline-offset-2 hover:underline"
        >
          enlace
        </button>
        {url && (
          <button
            type="button"
            onClick={() => guardar(null)}
            className="underline-offset-2 hover:underline"
          >
            quitar
          </button>
        )}
      </div>

      {pegando && (
        <div className="mt-1 flex w-52 gap-1">
          <input
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            placeholder="enlace del producto o de la foto"
            autoCapitalize="none"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-borde bg-crema px-2 py-1 text-xs outline-none focus:border-marron"
          />
          <button
            type="button"
            onClick={desdeEnlace}
            className="shrink-0 rounded-lg bg-tinta px-2 py-1 text-xs text-crema-alto"
          >
            Usar
          </button>
        </div>
      )}

      {roto && !error && (
        <p className="mt-1 w-52 text-[11px] text-alerta">
          Esa foto no carga. Súbela o prueba con otro enlace.
        </p>
      )}

      {error && <p className="mt-1 w-52 text-[11px] text-alerta">{error}</p>}
    </div>
  );
}
