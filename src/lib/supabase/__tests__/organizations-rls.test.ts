import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "../service";

describe("RLS de organizations", () => {
  const password = "test-password-123";
  const userAEmail = `user-a-${Date.now()}@test.local`;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const service = createServiceClient();

    const { data: orgA, error: orgAErr } = await service
      .from("organizations")
      .insert({ name: "Org A", slug: `org-a-${Date.now()}` })
      .select()
      .single();
    if (orgAErr) throw orgAErr;
    orgAId = orgA.id;

    const { data: orgB, error: orgBErr } = await service
      .from("organizations")
      .insert({ name: "Org B", slug: `org-b-${Date.now()}` })
      .select()
      .single();
    if (orgBErr) throw orgBErr;
    orgBId = orgB.id;

    const { data: userA, error: userAErr } = await service.auth.admin.createUser(
      { email: userAEmail, password, email_confirm: true }
    );
    if (userAErr) throw userAErr;

    const { error: memberErr } = await service
      .from("org_members")
      .insert({ user_id: userA.user.id, org_id: orgAId, role: "owner" });
    if (memberErr) throw memberErr;
  });

  it("un usuario solo ve su propia organización", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error: signInErr } = await anon.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    if (signInErr) throw signInErr;

    const { data, error } = await anon.from("organizations").select("id");
    expect(error).toBeNull();
    const ids = data?.map((o) => o.id) ?? [];
    expect(ids).toContain(orgAId);
    expect(ids).not.toContain(orgBId);
  });
});
