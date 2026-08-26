import type {
  AsistenciaRegistro,
  AusenciasResponse,
  Empleado,
  Entitlements,
  Organization,
  Paginated,
  Sucursal,
} from "./api";

const hoy = new Date();
const iso = (horas: number) => new Date(hoy.getTime() - horas * 3_600_000).toISOString();

const entitlements: Entitlements = {
  plan: {
    slug: "pro",
    nombre: "Pro",
    maxSucursales: null,
    maxEmpleados: null,
    modulos: ["asistencia", "horas", "turnos", "rrhh", "reportes"],
    precioMensual: null,
  },
  suscripcion: null,
  maxSucursales: null,
  maxEmpleados: null,
  modulos: ["asistencia", "horas", "turnos", "rrhh", "reportes"],
  ilimitado: true,
};

export const demoOrganization: Organization = {
  id: "demo-org-oliver",
  name: "Oliver Demo",
  slug: "oliver-demo",
  plan: "pro",
  role: "owner",
  entitlements,
};

export const demoSucursales: Sucursal[] = [
  { id: "suc-centro", org_id: demoOrganization.id, nombre: "Casa Central", lat: -34.6037, lon: -58.3816, radio_metros: 150, direccion: "Av. Corrientes 1234, CABA", activa: true, created_at: iso(720), tiene_asistencia: true },
  { id: "suc-norte", org_id: demoOrganization.id, nombre: "Sucursal Norte", lat: -34.5262, lon: -58.4867, radio_metros: 150, direccion: "Av. Maipú 2450, Vicente López", activa: true, created_at: iso(480), tiene_asistencia: true },
];

export const demoEmpleados: Empleado[] = [
  { id: "emp-1", org_id: demoOrganization.id, nombre: "Sofía", apellido: "Martínez", celular: "11 5555-0101", cuil: "27-32123456-7", fecha_ingreso: "2023-03-06", sucursal_id: "suc-centro", device_token: "demo-device", estado: "activo", created_at: iso(900), otp: null, tiene_asistencia: true },
  { id: "emp-2", org_id: demoOrganization.id, nombre: "Mateo", apellido: "Gómez", celular: "11 5555-0102", cuil: "20-30111222-3", fecha_ingreso: "2023-07-18", sucursal_id: "suc-centro", device_token: null, estado: "activo", created_at: iso(800), otp: null, tiene_asistencia: true },
  { id: "emp-3", org_id: demoOrganization.id, nombre: "Valentina", apellido: "Rossi", celular: "11 5555-0103", cuil: "27-33444555-8", fecha_ingreso: "2024-01-15", sucursal_id: "suc-norte", device_token: "demo-device-2", estado: "activo", created_at: iso(700), otp: null, tiene_asistencia: true },
  { id: "emp-4", org_id: demoOrganization.id, nombre: "Lucas", apellido: "Fernández", celular: "11 5555-0104", cuil: null, fecha_ingreso: "2024-05-20", sucursal_id: "suc-norte", device_token: null, estado: "de_licencia", created_at: iso(600), otp: null, tiene_asistencia: false },
];

export const demoAsistencia: AsistenciaRegistro[] = [
  { id: "mar-1", org_id: demoOrganization.id, empleado_id: "emp-1", sucursal_id: "suc-centro", tipo: "entrada", lat: -34.6037, lon: -58.3816, created_at: iso(1), empleado_nombre: "Sofía Martínez", sucursal_nombre: "Casa Central" },
  { id: "mar-2", org_id: demoOrganization.id, empleado_id: "emp-2", sucursal_id: "suc-centro", tipo: "entrada", lat: -34.6037, lon: -58.3816, created_at: iso(2), empleado_nombre: "Mateo Gómez", sucursal_nombre: "Casa Central" },
  { id: "mar-3", org_id: demoOrganization.id, empleado_id: "emp-3", sucursal_id: "suc-norte", tipo: "entrada", lat: -34.5262, lon: -58.4867, created_at: iso(3), empleado_nombre: "Valentina Rossi", sucursal_nombre: "Sucursal Norte" },
  { id: "mar-4", org_id: demoOrganization.id, empleado_id: "emp-2", sucursal_id: "suc-centro", tipo: "salida", lat: -34.6037, lon: -58.3816, created_at: iso(26), empleado_nombre: "Mateo Gómez", sucursal_nombre: "Casa Central" },
];

const page = <T>(data: T[], pageSize = 25): Paginated<T> => ({ data, pagination: { page: 1, pageSize, total: data.length, totalPages: 1 } });

export function getDemoResponse(path: string): unknown {
  if (path.startsWith("/api/org/current")) return demoOrganization;
  if (path.startsWith("/api/org/resumen")) return { empleadosActivos: 3, sucursalesActivas: 2, miembros: 4 };
  if (path.startsWith("/api/sucursales")) return page(demoSucursales);
  if (path.startsWith("/api/empleados")) return path.includes("?") ? page(demoEmpleados) : demoEmpleados;
  if (path.startsWith("/api/asistencia")) {
    if (path.includes("rechazadas")) return page([]);
    const query = new URLSearchParams(path.split("?")[1] ?? "");
    return query.has("page") || query.has("pageSize") ? page(demoAsistencia) : demoAsistencia;
  }
  if (path.startsWith("/api/ausencias")) {
    const response: AusenciasResponse = { ausencias: [], resumen: { total: 0, certificadosPendientes: 0, porSucursal: {}, porMotivo: {} } };
    return response;
  }
  if (path.startsWith("/api/horas")) return { desde: "", hasta: "", turnos: [], resumen: [] };
  if (path.startsWith("/api/horarios")) return [];
  if (path.startsWith("/api/turno-templates")) return [];
  if (path.startsWith("/api/turnos/tolerancia")) return { tolerancia_min: 10 };
  if (path.startsWith("/api/turnos/cumplimiento")) return [];
  if (path.startsWith("/api/settings/rrhh-categorias")) return { categorias: ["Administración", "Ventas", "Operaciones"] };
  if (path.startsWith("/api/planes")) return { planes: [] };
  return undefined;
}

export function isDemoDataEnabled() {
  return import.meta.env.VITE_USE_DEMO_DATA !== "false";
}

export function isDemoResponse<T>(value: unknown): value is T {
  return value !== undefined;
}

