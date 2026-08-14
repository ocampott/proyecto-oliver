import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export const DEVICE_COOKIE = "oliver_device";
const UN_ANIO_SEGUNDOS = 60 * 60 * 24 * 365;

/** Lee el device token en un server component (next/headers). */
export async function getDeviceToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(DEVICE_COOKIE)?.value ?? null;
}

/** Lee el device token en un route handler (del request, testeable). */
export function getDeviceTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(DEVICE_COOKIE)?.value ?? null;
}

/** Genera un token opaco nuevo (32 bytes hex). */
export function nuevoDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

/** Setea la cookie de dispositivo en la respuesta (vínculo dispositivo↔empleado). */
export function setDeviceCookie(res: NextResponse, token: string): void {
  res.cookies.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: UN_ANIO_SEGUNDOS,
    path: "/",
  });
}
