import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "../service";

describe("RLS de asistencia (sucursales/empleados/asistencia)", () => {
  const password = "test-password-123";
  const userAEmail = `asistencia-user-a-${Date.now()}@test.local`;
  let orgAId: string;
  let orgBId: string;
  let sucursalAId: string;
  let sucursalBId: string;
  let empleadoAId: string;
  let empleadoBId: string;

  beforeAll(async () => {
    const service = createServiceClient();
    const ts = Date.now();

    const { data: orgA, error: e1 } = await service
      .from("organizations")
      .insert({ name: "Org Asistencia A", slug: `org-asistencia-a-${ts}` })
      .select()
      .single();
    if (e1) throw e1;
    orgAId = orgA.id;

    const { data: orgB, error: e2 } = await service
      .from("organizations")
      .insert({ name: "Org Asistencia B", slug: `org-asistencia-b-${ts}` })
      .select()
      .single();
    if (e2) throw e2;
    orgBId = orgB.id;

    const { data: sucA, error: e3 } = await service
      .from("sucursales")
      .insert({ org_id: orgAId, nombre: "Sucursal A", lat: -34.6, lon: -58.4 })
      .select()
      .single();
    if (e3) throw e3;
    sucursalAId = sucA.id;

    const { data: sucB, error: e4 } = await service
      .from("sucursales")
      .insert({ org_id: orgBId, nombre: "Sucursal B" })
      .select()
      .single();
    if (e4) throw e4;
    sucursalBId = sucB.id;

    const { data: empA, error: e5 } = await service
      .from("empleados")
      .insert({ org_id: orgAId, nombre: "Empleado A" })
      .select()
      .single();
    if (e5) throw e5;
    empleadoAId = empA.id;

    const { data: empB, error: e6 } = await service
      .from("empleados")
      .insert({ org_id: orgBId, nombre: "Empleado B" })
      .select()
      .single();
    if (e6) throw e6;
    empleadoBId = empB.id;

    const { error: e7 } = await service.from("asistencia").insert([
      { org_id: orgAId, empleado_id: empleadoAId, sucursal_id: sucursalAId, tipo: "entrada", lat: -34.6, lon: -58.4 },
      { org_id: orgBId, empleado_id: empleadoBId, sucursal_id: sucursalBId, tipo: "entrada", lat: -34.6, lon: -58.4 },
    ]);
    if (e7) throw e7;

    const { data: userA, error: e8 } = await service.auth.admin.createUser({
      email: userAEmail,
      password,
      email_confirm: true,
    });
    if (e8) throw e8;

    const { error: e9 } = await service
      .from("org_members")
      .insert({ user_id: userA.user.id, org_id: orgAId, role: "owner" });
    if (e9) throw e9;
  });

  async function clienteConSesionA() {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await anon.auth.signInWithPassword({ email: userAEmail, password });
    if (error) throw error;
    return anon;
  }

  it("un usuario solo ve las sucursales de su org", async () => {
    const anon = await clienteConSesionA();
    const { data, error } = await anon.from("sucursales").select("id");
    expect(error).toBeNull();
    const ids = data?.map((s) => s.id) ?? [];
    expect(ids).toContain(sucursalAId);
    expect(ids).not.toContain(sucursalBId);
  });

  it("un usuario solo ve los empleados de su org", async () => {
    const anon = await clienteConSesionA();
    const { data, error } = await anon.from("empleados").select("id");
    expect(error).toBeNull();
    const ids = data?.map((e) => e.id) ?? [];
    expect(ids).toContain(empleadoAId);
    expect(ids).not.toContain(empleadoBId);
  });

  it("un usuario solo ve la asistencia de su org", async () => {
    const anon = await clienteConSesionA();
    const { data, error } = await anon.from("asistencia").select("org_id");
    expect(error).toBeNull();
    const orgIds = [...new Set(data?.map((a) => a.org_id))];
    expect(orgIds).toEqual([orgAId]);
  });

  it("un cliente no puede leer otp_codes (solo service role)", async () => {
    const anon = await clienteConSesionA();
    const { data, error } = await anon.from("otp_codes").select("id");
    // RLS sin policies: la query funciona pero no devuelve nada.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
