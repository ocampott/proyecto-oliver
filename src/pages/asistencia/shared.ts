import type { AsistenciaRegistro, SalidaHuerfana } from "../../lib/api";

/** Campos que necesita el modal de crear/editar — alcanza para un registro
 * completo o para una salida huérfana (que no trae tipo/lat/lon/origen). */
export type RegistroEditable = Pick<AsistenciaRegistro, "id" | "empleado_id" | "sucursal_id" | "tipo" | "created_at">;
export type RegistroBorrable = Pick<AsistenciaRegistro, "id" | "tipo" | "empleado_nombre" | "created_at">;

export function huerfanaAEditable(h: SalidaHuerfana): RegistroEditable {
  return { id: h.id, empleado_id: h.empleado_id, sucursal_id: h.sucursal_id, tipo: "salida", created_at: h.created_at };
}

export function huerfanaABorrable(h: SalidaHuerfana): RegistroBorrable {
  return { id: h.id, tipo: "salida", empleado_nombre: h.empleado_nombre, created_at: h.created_at };
}
