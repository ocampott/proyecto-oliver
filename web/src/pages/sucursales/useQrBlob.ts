import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/**
 * Pide el PNG del QR de una sucursal mandando el Bearer token (un <img
 * src="..."> directo no puede mandar headers), y devuelve un blob URL
 * listo para usar en <img src={...}>. null mientras no hay sucursalId o
 * todavía no cargó.
 */
export function useQrBlob(sucursalId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sucursalId) {
      setUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    async function cargar() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/api/sucursales/${sucursalId}/qr`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok || cancelled) return;

      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      if (!cancelled) setUrl(objectUrl);
    }

    cargar();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sucursalId]);

  return url;
}
