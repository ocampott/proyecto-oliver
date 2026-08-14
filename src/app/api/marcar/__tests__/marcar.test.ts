import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { POST as identificar } from "../identificar/route";
import { POST as verificar } from "../verificar/route";
import { POST as registrar } from "../registrar/route";
import { createServiceClient } from "@/lib/supabase/service";
import { DEVICE_COOKIE } from "@/lib/device-token";

function reqPost(url: string, body: unknown, cookie?: string): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(url, { method: "POST", headers, body: JSON.stringify(body) });
}

describe("APIs públicas de marcado", () => {
  let orgSlug: string;
  let orgId: string;
  let sucursalId: string;
  let sucursalSinGpsId: string;
  let empleadoLibreId: string;
  let empleadoVinculadoId: string;
  const tokenVinculado = "token-test-vinculado-123";

  beforeAll(async () => {
    const service = createServiceClient();
    const ts = Date.now();

    const { data: org, error: e1 } = await service
      .from("organizations")
      .insert({ name: "Org Marcar", slug: `org-marcar-${ts}` })
      .select()
      .single();
    if (e1) throw e1;
    orgId = org.id;
    orgSlug = org.slug;

    const { data: suc, error: e2 } = await service
      .from("sucursales")
      .insert({ org_id: orgId, nombre: "Central", lat: -34.6, lon: -58.4, radio_metros: 100 })
      .select()
      .single();
    if (e2) throw e2;
    sucursalId = suc.id;

    const { data: sucSin, error: e3 } = await service
      .from("sucursales")
      .insert({ org_id: orgId, nombre: "Sin GPS" })
      .select()
      .single();
    if (e3) throw e3;
    sucursalSinGpsId = sucSin.id;

    const { data: empLibre, error: e4 } = await service
      .from("empleados")
      .insert({ org_id: orgId, nombre: "Juan Pérez" })
      .select()
      .single();
    if (e4) throw e4;
    empleadoLibreId = empLibre.id;

    const { data: empVin, error: e5 } = await service
      .from("empleados")
      .insert({ org_id: orgId, nombre: "María Gómez", device_token: tokenVinculado })
      .select()
      .single();
    if (e5) throw e5;
    empleadoVinculadoId = empVin.id;
  });

  it("identificar con nombre exacto genera OTP y devuelve empleadoId", async () => {
    const res = await identificar(
      reqPost("http://localhost/api/marcar/identificar", {
        orgSlug,
        sucursalId,
        nombre: "juan perez",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.empleadoId).toBe(empleadoLibreId);

    const service = createServiceClient();
    const { data } = await service
      .from("otp_codes")
      .select("code")
      .eq("empleado_id", empleadoLibreId)
      .is("used_at", null);
    expect(data?.length).toBe(1);
  });

  it("identificar con nombre parecido devuelve sugerencia", async () => {
    const res = await identificar(
      reqPost("http://localhost/api/marcar/identificar", {
        orgSlug,
        sucursalId,
        nombre: "Juan Peréz",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sugerencia).toBe("Juan Pérez");
  });

  it("identificar con nombre inexistente rechaza y registra en asistencia_rechazada", async () => {
    const res = await identificar(
      reqPost("http://localhost/api/marcar/identificar", {
        orgSlug,
        sucursalId,
        nombre: "Persona Inexistente",
      })
    );
    expect(res.status).toBe(404);

    const service = createServiceClient();
    const { data } = await service
      .from("asistencia_rechazada")
      .select("motivo, sucursal_id")
      .eq("org_id", orgId)
      .eq("motivo", "nombre_no_encontrado");
    expect(data?.some((r) => r.sucursal_id === sucursalId)).toBe(true);
  });

  it("identificar un empleado ya vinculado rechaza con 409 y registra el rechazo", async () => {
    const res = await identificar(
      reqPost("http://localhost/api/marcar/identificar", {
        orgSlug,
        sucursalId,
        nombre: "María Gómez",
      })
    );
    expect(res.status).toBe(409);

    const service = createServiceClient();
    const { data } = await service
      .from("asistencia_rechazada")
      .select("motivo")
      .eq("org_id", orgId)
      .eq("empleado_id", empleadoVinculadoId)
      .eq("motivo", "dispositivo_ya_vinculado");
    expect(data?.length).toBeGreaterThan(0);
  });

  it("verificar con código bueno vincula y setea la cookie; con código malo da 400", async () => {
    // Generar OTP fresco para Juan (el anterior quedó de los tests de identificar)
    const service = createServiceClient();
    // Simular que el admin genera el código desde el dashboard
    const { generarOtp } = await import("@/lib/otp");
    const code = await generarOtp(orgId, empleadoLibreId);

    const malo = await verificar(
      reqPost("http://localhost/api/marcar/verificar", {
        empleadoId: empleadoLibreId,
        code: code === "000000" ? "000001" : "000000",
      })
    );
    expect(malo.status).toBe(400);

    const bueno = await verificar(
      reqPost("http://localhost/api/marcar/verificar", {
        empleadoId: empleadoLibreId,
        code,
      })
    );
    expect(bueno.status).toBe(200);
    const setCookie = bueno.headers.get("set-cookie");
    expect(setCookie).toContain(DEVICE_COOKIE);

    const { data: emp } = await service
      .from("empleados")
      .select("device_token")
      .eq("id", empleadoLibreId)
      .single();
    expect(emp?.device_token).toBeTruthy();
  });

  it("registrar dentro de la geocerca inserta en asistencia", async () => {
    const res = await registrar(
      reqPost(
        "http://localhost/api/marcar/registrar",
        { sucursalId, tipo: "entrada", lat: -34.6, lon: -58.4 },
        `${DEVICE_COOKIE}=${tokenVinculado}`
      )
    );
    expect(res.status).toBe(200);

    const service = createServiceClient();
    const { data } = await service
      .from("asistencia")
      .select("tipo")
      .eq("org_id", orgId)
      .eq("empleado_id", empleadoVinculadoId);
    expect(data?.some((a) => a.tipo === "entrada")).toBe(true);
  });

  it("registrar fuera de rango rechaza con distancia y registra el rechazo", async () => {
    const res = await registrar(
      reqPost(
        "http://localhost/api/marcar/registrar",
        { sucursalId, tipo: "entrada", lat: -34.61, lon: -58.41 },
        `${DEVICE_COOKIE}=${tokenVinculado}`
      )
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("máximo 100 m");

    const service = createServiceClient();
    const { data } = await service
      .from("asistencia_rechazada")
      .select("distancia_metros")
      .eq("org_id", orgId)
      .eq("motivo", "fuera_de_rango");
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.[0].distancia_metros).toBeGreaterThan(100);
  });

  it("registrar en sucursal sin GPS rechaza con motivo sucursal_sin_gps", async () => {
    const res = await registrar(
      reqPost(
        "http://localhost/api/marcar/registrar",
        { sucursalId: sucursalSinGpsId, tipo: "salida", lat: -34.6, lon: -58.4 },
        `${DEVICE_COOKIE}=${tokenVinculado}`
      )
    );
    expect(res.status).toBe(422);

    const service = createServiceClient();
    const { data } = await service
      .from("asistencia_rechazada")
      .select("motivo")
      .eq("org_id", orgId)
      .eq("motivo", "sucursal_sin_gps");
    expect(data?.length).toBeGreaterThan(0);
  });

  it("registrar sin cookie de dispositivo da 401", async () => {
    const res = await registrar(
      reqPost("http://localhost/api/marcar/registrar", {
        sucursalId,
        tipo: "entrada",
        lat: -34.6,
        lon: -58.4,
      })
    );
    expect(res.status).toBe(401);
  });
});
