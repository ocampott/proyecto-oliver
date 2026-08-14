import { createServiceClient } from "./supabase/service";
import { validarEmpleado, buscarEmpleadoParecido } from "./nomina";

export interface Empleado {
  id: string;
  org_id: string;
  nombre: string;
  celular: string | null;
  device_token: string | null;
  activo: boolean;
  created_at: string;
}

export async function listEmpleados(orgId: string): Promise<Empleado[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("empleados")
    .select("*")
    .eq("org_id", orgId)
    .order("nombre");
  if (error) throw error;
  return data;
}

export async function createEmpleado(
  orgId: string,
  input: { nombre: string; celular?: string }
): Promise<Empleado> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("empleados")
    .insert({ org_id: orgId, nombre: input.nombre, celular: input.celular ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEmpleado(
  orgId: string,
  id: string,
  patch: { nombre?: string; celular?: string | null }
): Promise<Empleado> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("empleados")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setEmpleadoActivo(orgId: string, id: string, activo: boolean): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("empleados")
    .update({ activo })
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) throw error;
}

export async function getEmpleadoById(id: string): Promise<Empleado | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("empleados")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getEmpleadoByDeviceToken(
  orgId: string,
  token: string
): Promise<Empleado | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("empleados")
    .select("*")
    .eq("org_id", orgId)
    .eq("device_token", token)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function vincularDispositivo(
  orgId: string,
  empleadoId: string,
  token: string
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("empleados")
    .update({ device_token: token })
    .eq("org_id", orgId)
    .eq("id", empleadoId);
  if (error) throw error;
}

export async function desvincularDispositivo(orgId: string, empleadoId: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("empleados")
    .update({ device_token: null })
    .eq("org_id", orgId)
    .eq("id", empleadoId);
  if (error) throw error;
}

export interface ResultadoNomina {
  empleado: Empleado;
  /** true = match exacto/subset; false = sugerencia aproximada ("¿sos Fulano?") */
  exacto: boolean;
}

/**
 * Busca un nombre tipeado por el empleado en la nómina activa de la org.
 * Primero exacto/subset (validarEmpleado); si no, aproximado por Levenshtein
 * (buscarEmpleadoParecido) marcándolo como sugerencia a confirmar.
 */
export async function buscarEnNomina(
  orgId: string,
  input: string
): Promise<ResultadoNomina | null> {
  const service = createServiceClient();
  const { data: activos, error } = await service
    .from("empleados")
    .select("*")
    .eq("org_id", orgId)
    .eq("activo", true);
  if (error) throw error;

  const nombres = activos.map((e) => e.nombre);

  const exacto = validarEmpleado(nombres, input);
  if (exacto) {
    return { empleado: activos.find((e) => e.nombre === exacto)!, exacto: true };
  }

  const parecido = buscarEmpleadoParecido(nombres, input);
  if (parecido) {
    return { empleado: activos.find((e) => e.nombre === parecido)!, exacto: false };
  }

  return null;
}
