import { randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env.js";

export const DEVICE_COOKIE = "oliver_device";
const UN_ANIO_SEGUNDOS = 60 * 60 * 24 * 365;

export function getDeviceToken(request: FastifyRequest): string | null {
  return request.cookies[DEVICE_COOKIE] ?? null;
}

export function nuevoDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

export function setDeviceCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: UN_ANIO_SEGUNDOS,
    path: "/",
  });
}
