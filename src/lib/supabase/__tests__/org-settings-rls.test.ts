import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "../service";

describe("RLS de org_settings", () => {
  const password = "test-password-123";
  const userAEmail = `settings-user-a-${Date.now()}@test.local`;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const service = createServiceClient();

    const { data: orgA, error: orgAErr } = await service
      .from("organizations")
      .insert({ name: "Org Settings A", slug: `org-settings-a-${Date.now()}` })
      .select()
      .single();
    if (orgAErr) throw orgAErr;
    orgAId = orgA.id;

    const { data: orgB, error: orgBErr } = await service
      .from("organizations")
      .insert({ name: "Org Settings B", slug: `org-settings-b-${Date.now()}` })
      .select()
      .single();
    if (orgBErr) throw orgBErr;
    orgBId = orgB.id;

    const { error: settingsErr } = await service
      .from("org_settings")
      .insert([{ org_id: orgAId }, { org_id: orgBId }]);
    if (settingsErr) throw settingsErr;

    const { data: userA, error: userAErr } = await service.auth.admin.createUser(
      { email: userAEmail, password, email_confirm: true }
    );
    if (userAErr) throw userAErr;

    const { error: memberErr } = await service
      .from("org_members")
      .insert({ user_id: userA.user.id, org_id: orgAId, role: "owner" });
    if (memberErr) throw memberErr;
  });

  it("un usuario solo ve la configuración de su propia organización", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error: signInErr } = await anon.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    if (signInErr) throw signInErr;

    const { data, error } = await anon.from("org_settings").select("org_id");
    expect(error).toBeNull();
    const orgIds = data?.map((s) => s.org_id) ?? [];
    expect(orgIds).toContain(orgAId);
    expect(orgIds).not.toContain(orgBId);
  });
});
