import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { isPlatformAdmin } from "../admin";
import { createServiceClient } from "../supabase/service";

describe("isPlatformAdmin", () => {
  it("es true para un usuario en platform_admins", async () => {
    const service = createServiceClient();
    const { data: user, error } = await service.auth.admin.createUser({
      email: `admin-${Date.now()}@test.local`,
      password: "test-password-123",
      email_confirm: true,
    });
    if (error) throw error;

    await service.from("platform_admins").insert({ user_id: user.user.id });

    expect(await isPlatformAdmin(user.user.id)).toBe(true);
  });

  it("es false para un usuario cualquiera", async () => {
    expect(await isPlatformAdmin(randomUUID())).toBe(false);
  });
});
