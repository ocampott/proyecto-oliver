import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/require-org";
import { generarOtp } from "@/lib/otp";

interface Ctx {
  params: Promise<{ id: string }>;
}

// Genera un código de vinculación nuevo y lo devuelve para que el admin se lo
// pase al empleado (canal provisional del OTP hasta que se envíe por WhatsApp).
export async function POST(_req: Request, { params }: Ctx) {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  try {
    const code = await generarOtp(ctx.org.id, id);
    return NextResponse.json({ code });
  } catch {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }
}
