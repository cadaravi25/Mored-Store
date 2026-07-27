"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { usuarioACorreo } from "@/lib/auth";

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);

    const supabase = crearClienteNavegador();
    const { error: fallo } = await supabase.auth.signInWithPassword({
      email: usuarioACorreo(usuario),
      password: clave,
    });

    if (fallo) {
      // Mensaje genérico a propósito: decir "ese usuario no existe" le
      // confirmaría a un desconocido qué cuentas son válidas.
      setError("Usuario o contraseña incorrectos.");
      setEnviando(false);
      return;
    }

    // Solo rutas internas: un "volver" con URL completa sería una vía para
    // redirigir a un sitio ajeno desde un enlace preparado.
    const volver = params.get("volver");
    router.replace(volver?.startsWith("/") ? volver : "/");
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="space-y-4">
      <div>
        <label htmlFor="usuario" className="mb-1.5 block text-sm text-tinta-suave">
          Usuario
        </label>
        <input
          id="usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          placeholder="yolima"
          className="w-full rounded-lg border border-borde bg-crema-alto px-4 py-3 text-base text-tinta outline-none placeholder:text-tinta-suave/50 focus:border-dorado"
        />
      </div>

      <div>
        <label htmlFor="clave" className="mb-1.5 block text-sm text-tinta-suave">
          Contraseña
        </label>
        <input
          id="clave"
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-borde bg-crema-alto px-4 py-3 text-base text-tinta outline-none focus:border-dorado"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-alerta-tenue px-4 py-3 text-sm text-alerta"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-tinta px-4 py-3.5 text-base text-crema-alto transition-opacity disabled:opacity-50"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function Entrar() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-crema px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-dorado-claro bg-crema-alto">
            <span className="text-3xl text-dorado">M</span>
          </div>
          <h1 className="text-2xl tracking-[0.25em] text-tinta">MORED</h1>
          <p className="mt-2 text-sm text-tinta-suave">Sistema interno</p>
        </div>

        {/* useSearchParams() obliga a un límite de Suspense para poder
            prerenderizar la parte estática de la pantalla. */}
        <Suspense
          fallback={<div className="h-64 animate-pulse rounded-lg bg-crema-alto" />}
        >
          <Formulario />
        </Suspense>
      </div>
    </main>
  );
}
