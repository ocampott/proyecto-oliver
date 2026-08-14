import { NextRequest, NextResponse } from "next/server";
import { getDeviceTokenFromRequest } from "@/lib/device-token";
import { getEmpleadoByToken } from "@/lib/empleados";
import { getSucursal } from "@/lib/sucursales";
import { registrarMarca, type TipoMarca } from "@/lib/asistencia";

/**
 * Paso 3 del marcado público: registrar entrada/salida con geocerca.
 * Requiere la cookie de dispositivo (vínculo previo con OTP).
 */
export async function POST(req: NextRequest) {
  const token = getDeviceTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "Dispositivo no vinculado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { sucursalId?: string; tipo?: string; lat?: number; lon?: number }
    | null;
  if (
    !body?.sucursalId ||
    (body.tipo !== "entrada" && body.tipo !== "salida") ||
    typeof body.lat !== "number" ||
    typeof body.lon !== "number"
  ) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const empleado = await getEmpleadoByToken(token);
  if (!empleado) {
    return NextResponse.json({ error: "Dispositivo no vinculado" }, { status: 401 });
  }

  const sucursal = await getSucursal(empleado.org_id, body.sucursalId);
  if (!sucursal || !sucursal.activa) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  const resultado = await registrarMarca(
    empleado.org_id,
    empleado.id,
    sucursal,
    body.tipo as TipoMarca,
    body.lat,
    body.lon
  );

  if (!resultado.ok) {
    if (resultado.motivo === "sucursal_sin_gps") {
      return NextResponse.json(
        { error: "Esta sucursal no tiene la ubicación configurada. Avisale a tu encargado." },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: `Estás a ${resultado.distancia} m de la sucursal (máximo ${sucursal.radio_metros} m).` },
      { status: 422 }
    );
  }

  return NextResponse.json({ ok: true, tipo: body.tipo, hora: resultado.asistencia.created_at });
}
