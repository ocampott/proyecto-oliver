import { NextRequest, NextResponse } from "next/server";
import { verificarOtp } from "@/lib/otp";
import { getEmpleadoById, vincularDispositivo } from "@/lib/empleados";
import { nuevoDeviceToken, setDeviceCookie } from "@/lib/device-token";

/**
 * Paso 2 del marcado público: verificar el código OTP y vincular el
 * dispositivo (cookie httpOnly oliver_device).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { empleadoId?: string; code?: string }
    | null;
  if (!body?.empleadoId || !body.code?.trim()) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const empleado = await getEmpleadoById(body.empleadoId);
  if (!empleado || !empleado.activo) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }

  const resultado = await verificarOtp(empleado.id, body.code);
  if (!resultado.ok) {
    if (resultado.motivo === "incorrecto") {
      return NextResponse.json({ error: "Código incorrecto. Revisalo y probá de nuevo." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "El código venció o quedó bloqueado. Pedile uno nuevo a tu encargado." },
      { status: 400 }
    );
  }

  const token = nuevoDeviceToken();
  await vincularDispositivo(empleado.org_id, empleado.id, token);

  const res = NextResponse.json({ ok: true, nombre: empleado.nombre });
  setDeviceCookie(res, token);
  return res;
}
