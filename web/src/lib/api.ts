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

  const headers: Record<string, string> = {};
  if (init?.body) headers["Content-Type"] = "application/json";
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

export interface Sucursal {
  id: string;
  org_id: string;
  nombre: string;
  lat: number | null;
  lon: number | null;
  radio_metros: number;
  direccion: string | null;
  activa: boolean;
  created_at: string;
  tiene_asistencia?: boolean;
}

export function listSucursales(): Promise<Sucursal[]> {
  return request("/api/sucursales");
}

export interface CrearSucursalInput {
  nombre: string;
  lat?: number;
  lon?: number;
  radio_metros?: number;
  direccion?: string;
}

export function createSucursal(input: CrearSucursalInput): Promise<Sucursal> {
  return request("/api/sucursales", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface EditarSucursalInput {
  nombre?: string;
  lat?: number | null;
  lon?: number | null;
  radio_metros?: number;
  direccion?: string | null;
  activa?: boolean;
}

export function updateSucursal(id: string, patch: EditarSucursalInput): Promise<Sucursal> {
  return request(`/api/sucursales/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteSucursal(id: string): Promise<{ ok: true }> {
  return request(`/api/sucursales/${id}`, { method: "DELETE" });
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

export interface EmpleadoOtp {
  code: string;
  expires_at: string;
}

export interface Empleado {
  id: string;
  org_id: string;
  nombre: string;
  celular: string | null;
  device_token: string | null;
  activo: boolean;
  created_at: string;
  otp: EmpleadoOtp | null;
}

export function listEmpleados(): Promise<Empleado[]> {
  return request("/api/empleados");
}

export interface CrearEmpleadoInput {
  nombre: string;
  celular?: string;
}

export function createEmpleado(input: CrearEmpleadoInput): Promise<Empleado> {
  return request("/api/empleados", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface EditarEmpleadoInput {
  nombre?: string;
  celular?: string | null;
  activo?: boolean;
}

export function updateEmpleado(id: string, patch: EditarEmpleadoInput): Promise<Empleado | { ok: true }> {
  return request(`/api/empleados/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deactivateEmpleado(id: string): Promise<{ ok: true }> {
  return request(`/api/empleados/${id}`, { method: "DELETE" });
}

export function desvincularDispositivo(id: string): Promise<{ ok: true }> {
  return request(`/api/empleados/${id}/desvincular`, { method: "POST" });
}

export interface GenerarOtpResponse {
  code: string;
}

export function generarOtp(id: string): Promise<GenerarOtpResponse> {
  return request(`/api/empleados/${id}/otp`, { method: "POST" });
}

export type TipoMarca = "entrada" | "salida";

export interface AsistenciaRegistro {
  id: string;
  org_id: string;
  empleado_id: string;
  sucursal_id: string;
  tipo: TipoMarca;
  lat: number;
  lon: number;
  created_at: string;
  empleado_nombre: string | null;
  sucursal_nombre: string | null;
}

export function listAsistencia(desde: string, hasta: string): Promise<AsistenciaRegistro[]> {
  return request(`/api/asistencia?desde=${desde}&hasta=${hasta}`);
}

export function deleteAsistencia(id: string): Promise<{ ok: true }> {
  return request(`/api/asistencia/${id}`, { method: "DELETE" });
}

export type MotivoRechazo =
  | "fuera_de_rango"
  | "sucursal_sin_gps"
  | "nombre_no_encontrado"
  | "dispositivo_ya_vinculado";

export interface Rechazada {
  id: string;
  org_id: string;
  empleado_id: string | null;
  sucursal_id: string | null;
  tipo: TipoMarca | null;
  lat: number | null;
  lon: number | null;
  distancia_metros: number | null;
  motivo: MotivoRechazo;
  resuelto: boolean;
  created_at: string;
  empleado_nombre: string | null;
  sucursal_nombre: string | null;
}

export function listRechazadas(): Promise<Rechazada[]> {
  return request("/api/asistencia/rechazadas");
}

export function resolverRechazada(id: string, accion: "aprobar" | "descartar"): Promise<{ ok: true }> {
  return request(`/api/asistencia/rechazadas/${id}?accion=${accion}`, { method: "POST" });
}

export interface Turno {
  empleado_id: string;
  nombre: string;
  sucursal_id: string;
  sucursal_nombre: string;
  entrada_at: string;
  salida_at: string | null;
  horas: number | null;
}

export interface ResumenEmpleado {
  nombre: string;
  totalHoras: number;
  enCurso: boolean;
}

export interface HorasResponse {
  desde: string;
  hasta: string;
  turnos: Turno[];
  resumen: ResumenEmpleado[];
}

export function getHoras(desde: string, hasta: string): Promise<HorasResponse> {
  return request(`/api/horas?desde=${desde}&hasta=${hasta}`);
}

export interface OrganizationAdmin {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
}

export function listOrganizationsAdmin(): Promise<OrganizationAdmin[]> {
  return request("/api/admin/organizations");
}

export interface CrearOrganizacionInput {
  name: string;
  slug: string;
}

export function createOrganizationAdmin(input: CrearOrganizacionInput): Promise<OrganizationAdmin> {
  return request("/api/admin/organizations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface PlaceDetails {
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  addressComponents: unknown[];
}

export function getPlaceDetails(placeId: string, sessionToken: string): Promise<PlaceDetails> {
  return request("/api/places/details", {
    method: "POST",
    body: JSON.stringify({ placeId, sessionToken }),
  });
}

export interface HorarioEmpleado {
  id: string;
  empleado_id: string;
  sucursal_id: string | null;
  sucursal_nombre: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  tolerancia_min: number | null;
}

export function getHorarios(empleadoId: string): Promise<HorarioEmpleado[]> {
  return request(`/api/horarios?empleadoId=${empleadoId}`);
}

export interface CrearHorarioInput {
  empleado_id: string;
  sucursal_id?: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  tolerancia_min?: number | null;
}

export function createHorario(input: CrearHorarioInput): Promise<{ ok: true }> {
  return request("/api/horarios", { method: "POST", body: JSON.stringify(input) });
}

export interface EditarHorarioInput {
  sucursal_id?: string | null;
  dia_semana?: number;
  hora_inicio?: string;
  hora_fin?: string;
  tolerancia_min?: number | null;
}

export function updateHorario(id: string, patch: EditarHorarioInput): Promise<{ ok: true }> {
  return request(`/api/horarios/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteHorario(id: string): Promise<{ ok: true }> {
  return request(`/api/horarios/${id}`, { method: "DELETE" });
}

export interface AsignarHorariosInput {
  empleado_ids: string[];
  dias_semana: number[];
  hora_inicio: string;
  hora_fin: string;
  tolerancia_min?: number | null;
}

export function asignarHorarios(input: AsignarHorariosInput): Promise<{ ok: true }> {
  return request("/api/horarios/bulk", { method: "POST", body: JSON.stringify(input) });
}

export interface TurnoTemplate {
  id: string;
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  dias_semana: number[];
  tolerancia_min: number | null;
}

export function getTurnoTemplates(): Promise<TurnoTemplate[]> {
  return request("/api/turno-templates");
}

export interface CrearTurnoTemplateInput {
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  dias_semana: number[];
  tolerancia_min?: number | null;
}

export function createTurnoTemplate(input: CrearTurnoTemplateInput): Promise<{ ok: true }> {
  return request("/api/turno-templates", { method: "POST", body: JSON.stringify(input) });
}

export function deleteTurnoTemplate(id: string): Promise<{ ok: true }> {
  return request(`/api/turno-templates/${id}`, { method: "DELETE" });
}

export function getTolerancia(): Promise<{ tolerancia_min: number }> {
  return request("/api/turnos/tolerancia");
}

export function setTolerancia(tolerancia_min: number): Promise<{ ok: true }> {
  return request("/api/turnos/tolerancia", { method: "PATCH", body: JSON.stringify({ tolerancia_min }) });
}

export interface CumplimientoRow {
  empleado_id: string;
  nombre: string;
  sucursal_nombre: string;
  fecha: string;
  entrada_real: string;
  entrada_esperada: string | null;
  diff_entrada_min: number | null;
  salida_real: string | null;
  salida_esperada: string | null;
  diff_salida_min: number | null;
  en_curso: boolean;
  estado: "a_horario" | "tarde" | "salida_anticipada" | "tarde_y_anticipada" | "sin_horario";
  tolerancia_aplicada: number | null;
}

export function getCumplimiento(filters: {
  desde: string;
  hasta: string;
  sucursalId?: string;
  empleadoId?: string;
}): Promise<CumplimientoRow[]> {
  const params = new URLSearchParams({ desde: filters.desde, hasta: filters.hasta });
  if (filters.sucursalId) params.set("sucursalId", filters.sucursalId);
  if (filters.empleadoId) params.set("empleadoId", filters.empleadoId);
  return request(`/api/turnos/cumplimiento?${params}`);
}
