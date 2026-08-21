import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/**
 * Pide un archivo mandando el Bearer token (un <a href="..."> directo no
 * puede mandar headers) y dispara la descarga del blob resultante. Mismo
 * patrón que useQrBlob.ts, pero on-demand (por click) en vez de por mount.
 */
export async function descargarArchivo(path: string, filename: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("No se pudo descargar el archivo.");

  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error("No se pudo descargar el archivo.");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
