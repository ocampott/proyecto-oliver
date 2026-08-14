import { createServiceClient } from "./supabase/service";

export interface Sucursal {
  id: string;
  org_id: string;
  nombre: string;
  lat: number | null;
  lon: number | null;
  radio_metros: number;
  activa: boolean;
  created_at: string;
}

export async function listSucursales(orgId: string): Promise<Sucursal[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .select("*")
    .eq("org_id", orgId)
    .order("nombre");
  if (error) throw error;
  return data;
}

export async function createSucursal(
  orgId: string,
  input: { nombre: string; lat?: number; lon?: number; radio_metros?: number }
): Promise<Sucursal> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .insert({
      org_id: orgId,
      nombre: input.nombre,
      lat: input.lat ?? null,
      lon: input.lon ?? null,
      radio_metros: input.radio_metros ?? 100,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSucursal(
  orgId: string,
  id: string,
  patch: {
    nombre?: string;
    lat?: number | null;
    lon?: number | null;
    radio_metros?: number;
    activa?: boolean;
  }
): Promise<Sucursal> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSucursal(orgId: string, id: string): Promise<Sucursal | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
