/**
 * Mored Store entra con NOMBRE DE USUARIO, no con correo.
 *
 * Supabase autentica contra un correo, pero no exige que exista de verdad.
 * Se le agrega este dominio interno al usuario que escriben y quedan cuentas
 * como "yolima@mored.store", que ellas nunca ven.
 *
 * El día que haya correos reales se cambian desde el panel de Supabase: es la
 * misma cuenta, conserva permisos e historial, y esta constante deja de usarse
 * para las cuentas migradas.
 */
export const DOMINIO_INTERNO = "mored.store";

/** "Yolima" o "yolima@mored.store" -> "yolima@mored.store" */
export function usuarioACorreo(entrada: string): string {
  const limpio = entrada.trim().toLowerCase();
  return limpio.includes("@") ? limpio : `${limpio}@${DOMINIO_INTERNO}`;
}

/** "yolima@mored.store" -> "yolima". Para saludar sin mostrar el correo. */
export function correoAUsuario(correo: string | undefined | null): string {
  if (!correo) return "";
  return correo.split("@")[0];
}
