import { supabase } from "./supabase";
import { descargarArchivo } from "./descargarArchivo";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
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
    const base = body?.error ?? "Algo salió mal. Probá de nuevo.";
    const detalles = Array.isArray(body?.detalles) ? body.detalles : null;
    const mensaje = detalles?.length
      ? `${base}: ${detalles.map((d: { mensaje: string }) => d.mensaje).join(". ")}`
      : base;
    throw new ApiError(mensaje, res.status, body);
  }
  return body as T;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

export type PlanSlug = "gratis" | "basico" | "pro";

/**
 * Módulos que existen HOY en el producto (tienen rutas/UI reales). Tiene
 * que estar en sincro con el mismo tipo en proyecto-oliver-api/src/lib/planes.ts —
 * no agregar acá un módulo aspiracional/futuro todavía sin implementar.
 */
export type Modulo = "asistencia" | "horas" | "turnos" | "rrhh" | "reportes";

export interface PlanDef {
  slug: PlanSlug;
  nombre: string;
  maxSucursales: number | null;
  maxEmpleados: number | null;
  modulos: Modulo[];
  precioMensual: number | null;
}

export interface Suscripcion {
  venceAt: string;
  periodoMeses: number;
}

export interface Entitlements {
  plan: PlanDef;
  suscripcion: Suscripcion | null;
  maxSucursales: number | null;
  maxEmpleados: number | null;
  modulos: Modulo[];
  /**
   * true solo para platform_admins (superadmin). No tiene plan ni
   * vencimiento — puede hacer todo, sin límites. Cualquier chequeo de
   * `modulos`/límites en el frontend tiene que mirar esto primero (ver
   * tieneModulo en ./hooks).
   */
  ilimitado: boolean;
}

export type OrgRole = "owner" | "admin" | "agent";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  entitlements: Entitlements;
  /**
   * Rol del usuario autenticado dentro de esta organización. Un
   * platform_admin (superadmin) bypasea los chequeos de rol igual que
   * bypasea los de plan (ver ilimitado) — ver tieneRol en ./hooks.
   */
  role?: OrgRole;
}

export function getOrgActual(): Promise<Organization> {
  return request("/api/org/current");
}

export function updateOrgActual(name: string): Promise<Organization> {
  return request("/api/org/current", { method: "PATCH", body: JSON.stringify({ name }) });
}

export interface Miembro {
  userId: string;
  email: string;
  role: OrgRole;
  createdAt: string;
  activo: boolean;
}

export function listMiembros(): Promise<Miembro[]> {
  return request("/api/org/miembros");
}

export function invitarMiembro(email: string): Promise<Miembro> {
  return request("/api/org/miembros", { method: "POST", body: JSON.stringify({ email }) });
}

export function eliminarMiembro(userId: string): Promise<{ ok: true }> {
  return request(`/api/org/miembros/${userId}`, { method: "DELETE" });
}

export interface PlanesResponse {
  planes: (PlanDef & {
    precios: { meses: number; descuento: number; precioTotal: number }[];
  })[];
}

export function getPlanes(): Promise<PlanesResponse> {
  return request("/api/planes");
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
  tiene_asistencia: boolean;
}

export interface ListSucursalesParams {
  page: number;
  pageSize: number;
  q?: string;
  estado?: "activos" | "inactivos";
}

export function listSucursales(params: ListSucursalesParams): Promise<Paginated<Sucursal>> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize));
  if (params.q) qs.set("q", params.q);
  if (params.estado) qs.set("estado", params.estado);
  return request(`/api/sucursales?${qs}`);
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

export type EstadoEmpleado = "activo" | "de_licencia" | "suspendido" | "baja";
export type TipoPago = "mensual" | "hora" | "dia";

export interface Empleado {
  id: string;
  org_id: string;
  nombre: string;
  apellido: string | null;
  celular: string | null;
  cuil: string | null;
  fecha_ingreso: string | null;
  sucursal_id: string | null;
  device_token: string | null;
  estado: EstadoEmpleado;
  created_at: string;
  otp: EmpleadoOtp | null;
  tiene_asistencia: boolean;
  tipo_pago: TipoPago | null;
  sueldo_mensual: number | null;
  valor_hora: number | null;
  valor_dia: number | null;
}

export function listEmpleados(): Promise<Empleado[]> {
  return request("/api/empleados");
}

export interface ListEmpleadosParams {
  page: number;
  pageSize: number;
  q?: string;
  estado?: EstadoEmpleado;
  sucursalId?: string;
  cuil?: "con" | "sin";
  dispositivo?: "vinculado" | "no_vinculado";
}

export function listEmpleadosPaginado(params: ListEmpleadosParams): Promise<Paginated<Empleado>> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize));
  if (params.q) qs.set("q", params.q);
  if (params.estado) qs.set("estado", params.estado);
  if (params.sucursalId) qs.set("sucursalId", params.sucursalId);
  if (params.cuil) qs.set("cuil", params.cuil);
  if (params.dispositivo) qs.set("dispositivo", params.dispositivo);
  return request(`/api/empleados?${qs}`);
}

export interface CrearEmpleadoInput {
  nombre: string;
  apellido: string;
  celular?: string;
  cuil?: string;
  fecha_ingreso?: string;
  sucursal_id?: string;
}

export function createEmpleado(input: CrearEmpleadoInput): Promise<Empleado> {
  return request("/api/empleados", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface EditarEmpleadoInput {
  nombre?: string;
  apellido?: string;
  celular?: string | null;
  cuil?: string | null;
  fecha_ingreso?: string | null;
  sucursal_id?: string | null;
  estado?: EstadoEmpleado;
  tipo_pago?: TipoPago | null;
  sueldo_mensual?: number | null;
  valor_hora?: number | null;
  valor_dia?: number | null;
}

export function updateEmpleado(id: string, patch: EditarEmpleadoInput): Promise<Empleado | { ok: true }> {
  return request(`/api/empleados/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function eliminarEmpleado(id: string): Promise<{ ok: true }> {
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

export interface ListAsistenciaParams {
  page: number;
  pageSize: number;
  sucursalId?: string;
  empleadoId?: string;
  tipo?: TipoMarca;
}

export function listAsistenciaPaginada(
  desde: string,
  hasta: string,
  params: ListAsistenciaParams
): Promise<Paginated<AsistenciaRegistro>> {
  const qs = new URLSearchParams({ desde, hasta, page: String(params.page), pageSize: String(params.pageSize) });
  if (params.sucursalId) qs.set("sucursalId", params.sucursalId);
  if (params.empleadoId) qs.set("empleadoId", params.empleadoId);
  if (params.tipo) qs.set("tipo", params.tipo);
  return request(`/api/asistencia?${qs}`);
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

export function listRechazadas(params: { page: number; pageSize: number }): Promise<Paginated<Rechazada>> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  return request(`/api/asistencia/rechazadas?${qs}`);
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

export function listOrganizationsAdmin(params: { page: number; pageSize: number; q?: string }): Promise<Paginated<OrganizationAdmin>> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.q) qs.set("q", params.q);
  return request(`/api/admin/organizations?${qs}`);
}

export function getOrganizationAdmin(orgId: string): Promise<OrganizationAdmin> {
  return request(`/api/admin/organizations/${orgId}`);
}

export function updateOrganizationAdmin(id: string, name: string): Promise<OrganizationAdmin> {
  return request(`/api/admin/organizations/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
}

export interface OrgResumen {
  empleadosActivos: number;
  sucursalesActivas: number;
  miembros: number;
}

export function getOrgResumenAdmin(id: string): Promise<OrgResumen> {
  return request(`/api/admin/organizations/${id}/resumen`);
}

export function getOrgResumenActual(): Promise<OrgResumen> {
  return request("/api/org/resumen");
}

export function listMiembrosAdmin(orgId: string, params: { page: number; pageSize: number }): Promise<Paginated<Miembro>> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  return request(`/api/admin/organizations/${orgId}/miembros?${qs}`);
}

export function listEmpleadosAdmin(orgId: string, params: { page: number; pageSize: number }): Promise<Paginated<Empleado>> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  return request(`/api/admin/organizations/${orgId}/empleados?${qs}`);
}

export function listSucursalesAdmin(orgId: string, params: { page: number; pageSize: number }): Promise<Paginated<Sucursal>> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  return request(`/api/admin/organizations/${orgId}/sucursales?${qs}`);
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

export interface EditarTurnoTemplateInput {
  nombre?: string;
  hora_inicio?: string;
  hora_fin?: string;
  dias_semana?: number[];
  tolerancia_min?: number | null;
}

export function updateTurnoTemplate(id: string, patch: EditarTurnoTemplateInput): Promise<{ ok: true }> {
  return request(`/api/turno-templates/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
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

export interface Ausencia {
  id: string;
  empleado_id: string;
  empleado_nombre: string;
  sucursal_id: string | null;
  sucursal_nombre: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  motivo: string;
  detalle: string | null;
  contacto: string | null;
  certificado_pendiente: boolean;
  origen: "admin" | "empleado";
  created_at: string;
}

export interface ResumenAusencias {
  total: number;
  certificadosPendientes: number;
  porSucursal: Record<string, number>;
  porMotivo: Record<string, number>;
}

export interface AusenciasResponse {
  ausencias: Ausencia[];
  pagination?: PaginationMeta;
  resumen: ResumenAusencias;
}

export function getAusencias(filters: {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  motivo?: string;
  empleadoId?: string;
  page?: number;
  pageSize?: number;
}): Promise<AusenciasResponse> {
  const params = new URLSearchParams();
  if (filters.desde) params.set("desde", filters.desde);
  if (filters.hasta) params.set("hasta", filters.hasta);
  if (filters.sucursalId) params.set("sucursalId", filters.sucursalId);
  if (filters.motivo) params.set("motivo", filters.motivo);
  if (filters.empleadoId) params.set("empleadoId", filters.empleadoId);
  if (filters.page !== undefined) params.set("page", String(filters.page));
  if (filters.pageSize !== undefined) params.set("pageSize", String(filters.pageSize));
  return request(`/api/ausencias?${params}`);
}

export interface CrearAusenciaInput {
  empleado_id: string;
  sucursal_id?: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  motivo: string;
  detalle?: string | null;
  contacto?: string | null;
  certificado_pendiente?: boolean;
}

export function createAusencia(input: CrearAusenciaInput): Promise<{ ok: true }> {
  return request("/api/ausencias", { method: "POST", body: JSON.stringify(input) });
}

export interface EditarAusenciaInput {
  sucursal_id?: string | null;
  fecha_desde?: string;
  fecha_hasta?: string;
  motivo?: string;
  detalle?: string | null;
  contacto?: string | null;
  certificado_pendiente?: boolean;
}

export function updateAusencia(id: string, patch: EditarAusenciaInput): Promise<{ ok: true }> {
  return request(`/api/ausencias/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteAusencia(id: string): Promise<{ ok: true }> {
  return request(`/api/ausencias/${id}`, { method: "DELETE" });
}

export function getRrhhCategorias(): Promise<{ categorias: string[] }> {
  return request("/api/settings/rrhh-categorias");
}

export function setRrhhCategorias(categorias: string[]): Promise<{ ok: true }> {
  return request("/api/settings/rrhh-categorias", { method: "PATCH", body: JSON.stringify({ categorias }) });
}

export interface SuscripcionAdmin {
  id: string;
  org_id: string;
  plan: "basico" | "pro";
  periodo_meses: number;
  precio_total: number | null;
  inicia_at: string;
  vence_at: string;
  estado: "activa" | "vencida" | "cancelada";
  notas: string | null;
  created_at: string;
}

export interface CrearSuscripcionAdminInput {
  plan: "basico" | "pro";
  periodoMeses: number;
  precioTotal?: number;
  notas?: string;
}

export function getSuscripcionesAdmin(orgId: string): Promise<{ suscripciones: SuscripcionAdmin[] }> {
  return request(`/api/admin/organizations/${orgId}/suscripciones`);
}

export function createSuscripcionAdmin(
  orgId: string,
  input: CrearSuscripcionAdminInput
): Promise<SuscripcionAdmin> {
  return request(`/api/admin/organizations/${orgId}/suscripciones`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function cancelSuscripcionAdmin(id: string): Promise<{ ok: true }> {
  return request(`/api/admin/suscripciones/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ estado: "cancelada" }),
  });
}

export function exportarAsistencia(desde: string, hasta: string): Promise<void> {
  const params = new URLSearchParams({ desde, hasta });
  return descargarArchivo(`/api/asistencia/export?${params}`, `asistencia_${desde}_${hasta}.xlsx`);
}

export function exportarHoras(desde: string, hasta: string): Promise<void> {
  const params = new URLSearchParams({ desde, hasta });
  return descargarArchivo(`/api/horas/export?${params}`, `horas_${desde}_${hasta}.xlsx`);
}

export interface ExportarAusenciasFilters {
  desde: string;
  hasta: string;
  sucursalId?: string;
  motivo?: string;
}

export function exportarAusencias(filters: ExportarAusenciasFilters): Promise<void> {
  const params = new URLSearchParams({ desde: filters.desde, hasta: filters.hasta });
  if (filters.sucursalId) params.set("sucursalId", filters.sucursalId);
  if (filters.motivo) params.set("motivo", filters.motivo);
  return descargarArchivo(`/api/ausencias/export?${params}`, `rrhh_${filters.desde}_${filters.hasta}.xlsx`);
}

// ── Liquidación de sueldos ────────────────────────────────────────────────

export interface LiquidacionEmpleado {
  empleado_id: string;
  nombre: string;
  tipo_pago: TipoPago | null;
  sueldo_mensual: number | null;
  valor_hora: number | null;
  valor_dia: number | null;
  horas_trabajadas: number | null;
  horas_en_curso: boolean;
  horas_pactadas: number | null;
  valor_hora_equivalente: number | null;
  minutos_perdidos: number;
  descuento_tardanza: number;
  dias_ausencia: number;
  horas_ausencia: number;
  descuento_ausencia: number;
  dias_ausencia_justificada: number;
  horas_ausencia_justificada: number;
  dias_trabajados: number | null;
  horas_extra: number | null;
  total_por_horas: number | null;
  total: number;
  advertencias: string[];
}

export interface LiquidacionResponse {
  desde: string;
  hasta: string;
  filas: LiquidacionEmpleado[];
}

export interface LiquidacionFiltros {
  desde?: string;
  hasta?: string;
  empleadoIds?: string[];
}

function paramsLiquidacion(filters: LiquidacionFiltros): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.desde) params.set("desde", filters.desde);
  if (filters.hasta) params.set("hasta", filters.hasta);
  if (filters.empleadoIds && filters.empleadoIds.length > 0) params.set("empleadoIds", filters.empleadoIds.join(","));
  return params;
}

export function getLiquidacion(filters: LiquidacionFiltros): Promise<LiquidacionResponse> {
  return request(`/api/liquidacion?${paramsLiquidacion(filters)}`);
}

export function exportarLiquidacion(filters: LiquidacionFiltros): Promise<void> {
  const desde = filters.desde ?? "periodo";
  const hasta = filters.hasta ?? "actual";
  return descargarArchivo(`/api/liquidacion/export?${paramsLiquidacion(filters)}`, `liquidacion_${desde}_a_${hasta}.xlsx`);
}

// ── Vacaciones ──────────────────────────────────────────────────────────

export interface SaldoVacaciones {
  empleado_id: string;
  nombre: string;
  fecha_ingreso: string | null;
  antiguedad_anios: number | null;
  dias_asignados: number | null;
  dias_usados: number;
  saldo: number | null;
  advertencia: string | null;
}

export function getVacaciones(anio?: number): Promise<SaldoVacaciones[]> {
  return request(`/api/vacaciones${anio ? `?anio=${anio}` : ""}`);
}

// ── Legajos ─────────────────────────────────────────────────────────────

export interface LegajoResumen {
  empleado_id: string;
  nombre: string;
  estado: EstadoEmpleado;
  cantidad_archivos: number;
  ultimo_archivo_at: string | null;
}

export function getLegajos(params: { page: number; pageSize: number; q?: string }): Promise<Paginated<LegajoResumen>> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.q) qs.set("q", params.q);
  return request(`/api/legajos?${qs}`);
}

export interface LegajoArchivo {
  id: string;
  empleado_id: string;
  ausencia_id: string | null;
  nombre_original: string;
  storage_path: string;
  mimetype: string;
  tamanio_bytes: number;
  origen: "manual" | "chat_empleado";
  subido_por: string | null;
  created_at: string;
}

export interface LegajoDetalle {
  empleado: Empleado;
  archivos: LegajoArchivo[];
}

export function getLegajo(empleadoId: string): Promise<LegajoDetalle> {
  return request(`/api/legajos/${empleadoId}`);
}

export async function subirLegajoArchivo(empleadoId: string, file: File): Promise<LegajoArchivo> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/api/legajos/${empleadoId}`, {
    method: "POST",
    credentials: "include",
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    body: formData,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error ?? "No se pudo subir el archivo.", res.status, body);
  return body as LegajoArchivo;
}

export function eliminarLegajoArchivo(empleadoId: string, archivoId: string): Promise<{ ok: true }> {
  return request(`/api/legajos/${empleadoId}/${archivoId}`, { method: "DELETE" });
}

export async function abrirLegajoArchivo(empleadoId: string, archivoId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("No se pudo abrir el archivo.");

  const res = await fetch(`${API_URL}/api/legajos/${empleadoId}/${archivoId}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error("No se pudo abrir el archivo.");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ── Chat de empleados (RRHH web, público, sin login) ──────────────────────

export interface ChatEstado {
  vinculado: boolean;
  empleadoNombre?: string;
}

export function getChatEstado(orgSlug: string): Promise<ChatEstado> {
  return request(`/api/chat/estado?org=${encodeURIComponent(orgSlug)}`);
}

export type ChatPaso =
  | "menu"
  | "ausencia_motivo"
  | "enfermedad_cert"
  | "fecha_inicio"
  | "fecha_fin"
  | "datos"
  | "certificado_elegir"
  | "certificado_esperando_archivo"
  | "cierre";

export type ChatEntrada = "menu" | "fecha" | "texto" | "archivo";

export interface ChatOpcion {
  value: string;
  label: string;
}

export interface ChatMensaje {
  remitente: "empleado" | "sistema";
  texto: string;
  created_at: string;
}

export interface ChatHistorial {
  mensajes: ChatMensaje[];
  paso: ChatPaso;
  entrada: ChatEntrada;
  opciones?: ChatOpcion[];
}

export interface ChatRespuesta {
  mensajes: string[];
  paso: ChatPaso;
  entrada: ChatEntrada;
  opciones?: ChatOpcion[];
}

// Sin sesión de Supabase — la identidad del empleado en el chat viene de la
// cookie de dispositivo (oliver_device, httpOnly), no de un Bearer token.
function chatRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return fetch(`${API_URL}${path}`, { ...init, credentials: "include" }).then(async (res) => {
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(body?.error ?? "Algo salió mal. Probá de nuevo.", res.status, body);
    return body as T;
  });
}

export function getChatHistorial(): Promise<ChatHistorial> {
  return chatRequest("/api/chat/historial");
}

export function enviarChatMensaje(texto: string): Promise<ChatRespuesta> {
  return chatRequest("/api/chat/mensaje", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto }),
  });
}

export async function subirChatCertificado(file: File): Promise<ChatRespuesta> {
  const formData = new FormData();
  formData.append("file", file);
  return chatRequest("/api/chat/certificado", { method: "POST", body: formData });
}

// ── Avisos urgentes (chat de empleados, vistos desde RRHH) ────────────────

export interface AvisoUrgente {
  empleado_id: string;
  empleado_nombre: string;
  texto: string;
  created_at: string;
}

export function getAvisosUrgentes(): Promise<AvisoUrgente[]> {
  return request("/api/rrhh/avisos-urgentes");
}
