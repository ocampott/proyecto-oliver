import { describe, it, expect, beforeAll } from "vitest";
import { generarOtp, verificarOtp, getOtpVigente } from "../otp";
import { createEmpleado } from "../empleados";
import { createServiceClient } from "../supabase/service";

describe("otp", () => {
  let orgId: string;
  let empleadoId: string;

  beforeAll(async () => {
    const service = createServiceClient();
    const { data: org, error } = await service
      .from("organizations")
      .insert({ name: "Otp Org", slug: `otp-org-${Date.now()}` })
      .select()
      .single();
    if (error) throw error;
    orgId = org.id;

    const emp = await createEmpleado(orgId, { nombre: "Otp Empleado" });
    empleadoId = emp.id;
  });

  it("ciclo completo: generar → vigente → verificar ok → no reutilizable", async () => {
    const code = await generarOtp(orgId, empleadoId);
    expect(code).toMatch(/^\d{6}$/);

    const vigente = await getOtpVigente(empleadoId);
    expect(vigente?.code).toBe(code);

    expect(await verificarOtp(empleadoId, code)).toEqual({ ok: true });

    // Ya usado: no se puede verificar de nuevo
    const segundo = await verificarOtp(empleadoId, code);
    expect(segundo.ok).toBe(false);
    expect(await getOtpVigente(empleadoId)).toBeNull();
  });

  it("código incorrecto suma intentos y bloquea al llegar a 5", async () => {
    const emp = await createEmpleado(orgId, { nombre: "Intentos Demo" });
    await generarOtp(orgId, emp.id);

    for (let i = 0; i < 5; i++) {
      const r = await verificarOtp(emp.id, "000000");
      expect(r).toEqual({ ok: false, motivo: "incorrecto" });
    }
    const bloqueado = await verificarOtp(emp.id, "000000");
    expect(bloqueado).toEqual({ ok: false, motivo: "bloqueado" });
  });

  it("generar de nuevo invalida el código anterior", async () => {
    const emp = await createEmpleado(orgId, { nombre: "Regenerar Demo" });
    const primero = await generarOtp(orgId, emp.id);
    const segundo = await generarOtp(orgId, emp.id);
    expect(segundo).not.toBe(primero);

    expect(await getOtpVigente(emp.id)).toMatchObject({ code: segundo });
    const r = await verificarOtp(emp.id, primero);
    expect(r.ok).toBe(false);
  });

  it("código expirado → motivo expirado", async () => {
    const emp = await createEmpleado(orgId, { nombre: "Expirado Demo" });
    await generarOtp(orgId, emp.id);

    // Forzar expiración a mano
    const service = createServiceClient();
    const { error } = await service
      .from("otp_codes")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("empleado_id", emp.id);
    if (error) throw error;

    expect(await verificarOtp(emp.id, "123456")).toEqual({ ok: false, motivo: "expirado" });
  });

  it("generarOtp rechaza un empleado de otra org", async () => {
    const service = createServiceClient();
    const { data: otraOrg, error } = await service
      .from("organizations")
      .insert({ name: "Otp Org B", slug: `otp-org-b-${Date.now()}` })
      .select()
      .single();
    if (error) throw error;

    await expect(generarOtp(otraOrg.id, empleadoId)).rejects.toThrow();
  });
});
