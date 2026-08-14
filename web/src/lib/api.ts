import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.headers) Object.assign(headers, init.headers);
  if (session) headers["Authorization"] = `Bearer ${session.access_token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error ?? "Algo salió mal. Probá de nuevo.", res.status);
  }
  return body as T;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export function getOrgActual(): Promise<Organization> {
  return request("/api/org/current");
}

export interface EstadoMarcado {
  sucursalNombre: string;
  empleadoNombre: string | null;
}

export function getEstadoMarcado(org: string, sucursal: string): Promise<EstadoMarcado> {
  return request(
    `/api/marcar/estado?org=${encodeURIComponent(org)}&sucursal=${encodeURIComponent(sucursal)}`
  );
}

export interface IdentificarResponse {
  empleadoId?: string;
  sugerencia?: string;
}

export function identificar(
  orgSlug: string,
  sucursalId: string,
  nombre: string
): Promise<IdentificarResponse> {
  return request("/api/marcar/identificar", {
    method: "POST",
    body: JSON.stringify({ orgSlug, sucursalId, nombre }),
  });
}

export interface VerificarResponse {
  ok: true;
  nombre: string;
}

export function verificar(empleadoId: string, code: string): Promise<VerificarResponse> {
  return request("/api/marcar/verificar", {
    method: "POST",
    body: JSON.stringify({ empleadoId, code }),
  });
}

export interface RegistrarResponse {
  ok: true;
  tipo: "entrada" | "salida";
  hora: string;
}

export function registrarMarca(
  sucursalId: string,
  tipo: "entrada" | "salida",
  lat: number,
  lon: number
): Promise<RegistrarResponse> {
  return request("/api/marcar/registrar", {
    method: "POST",
    body: JSON.stringify({ sucursalId, tipo, lat, lon }),
  });
}
