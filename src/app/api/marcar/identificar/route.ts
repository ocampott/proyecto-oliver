import { NextRequest, NextResponse } from "next/server";
import { getOrgBySlug } from "@/lib/org";
import { getSucursal } from "@/lib/sucursales";
import { buscarEnNomina } from "@/lib/empleados";
import { generarOtp } from "@/lib/otp";
import { registrarRechazo } from "@/lib/asistencia";

/**
 * Paso 1 del marcado público: identificar al empleado por nombre.
 * - Match exacto/subset sin dispositivo vinculado → genera OTP (lo ve el admin).
 * - Match aproximado → devuelve sugerencia para confirmar ("¿Sos Fulano?").
 * - Ya vinculado / no encontrado → rechazo registrado en asistencia_rechazada.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { orgSlug?: string; sucursalId?: string; nombre?: string }
    | null;
  if (!body?.orgSlug || !body?.sucursalId || !body.nombre?.trim()) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const org = await getOrgBySlug(body.orgSlug);
  if (!org) {
    return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
  }
  const sucursal = await getSucursal(org.id, body.sucursalId);
  if (!sucursal || !sucursal.activa) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  const resultado = await buscarEnNomina(org.id, body.nombre.trim());
  if (!resultado) {
    await registrarRechazo(org.id, {
      sucursal_id: sucursal.id,
      motivo: "nombre_no_encontrado",
    });
    return NextResponse.json(
      { error: "No encontramos ese nombre en la nómina. Escribilo como figura en tu recibo o avisale a tu encargado." },
      { status: 404 }
    );
  }

  const { empleado, exacto } = resultado;

  if (empleado.device_token) {
    await registrarRechazo(org.id, {
      empleado_id: empleado.id,
      sucursal_id: sucursal.id,
      motivo: "dispositivo_ya_vinculado",
    });
    return NextResponse.json(
      { error: "Este nombre ya está vinculado a otro dispositivo. Avisale a tu encargado." },
      { status: 409 }
    );
  }

  if (!exacto) {
    return NextResponse.json({ sugerencia: empleado.nombre });
  }

  await generarOtp(org.id, empleado.id);
  return NextResponse.json({ empleadoId: empleado.id });
}
