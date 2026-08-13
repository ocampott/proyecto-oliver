import { describe, it, expect } from "vitest";
import { getCurrentOrg } from "../org";
import { createServiceClient } from "../supabase/service";

describe("getCurrentOrg", () => {
  it("devuelve la organización del usuario", async () => {
    const service = createServiceClient();
    const { data: org, error: orgErr } = await service
      .from("organizations")
      .insert({ name: "Org Helper", slug: `org-helper-${Date.now()}` })
      .select()
      .single();
    if (orgErr) throw orgErr;

    const { data: user, error: userErr } = await service.auth.admin.createUser({
      email: `org-helper-${Date.now()}@test.local`,
      password: "test-password-123",
      email_confirm: true,
    });
    if (userErr) throw userErr;

    await service
      .from("org_members")
      .insert({ user_id: user.user.id, org_id: org.id, role: "owner" });

    const result = await getCurrentOrg(user.user.id);
    expect(result?.id).toBe(org.id);
    expect(result?.name).toBe("Org Helper");
  });

  it("devuelve null si el usuario no tiene organización", async () => {
    const service = createServiceClient();
    const { data: user, error: userErr } = await service.auth.admin.createUser({
      email: `org-helper-none-${Date.now()}@test.local`,
      password: "test-password-123",
      email_confirm: true,
    });
    if (userErr) throw userErr;

    const result = await getCurrentOrg(user.user.id);
    expect(result).toBeNull();
  });
});
