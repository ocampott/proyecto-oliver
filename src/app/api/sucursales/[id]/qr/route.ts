import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireOrg } from "@/lib/require-org";
import { getSucursal } from "@/lib/sucursales";

interface Ctx {
  params: Promise<{ id: string }>;
}

function qrUrl(orgSlug: string, sucursalId: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:5173";
  return `${base}/marcar/${orgSlug}/${sucursalId}`;
}

// PNG del QR que apunta a la página pública de marcado de esta sucursal.
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const sucursal = await getSucursal(ctx.org.id, id);
  if (!sucursal) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  const png = await QRCode.toBuffer(qrUrl(ctx.org.slug, sucursal.id), {
    width: 600,
    margin: 2,
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="qr-${sucursal.nombre}.png"`,
    },
  });
}
