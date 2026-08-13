import { describe, it, expect } from "vitest";
import { createServiceClient } from "../service";

describe("createServiceClient", () => {
  it("se conecta al Supabase local y puede listar usuarios", async () => {
    const client = createServiceClient();
    const { data, error } = await client.auth.admin.listUsers();
    expect(error).toBeNull();
    expect(Array.isArray(data?.users)).toBe(true);
  });
});
