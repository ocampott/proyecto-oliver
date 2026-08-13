import { describe, it, expect } from "vitest";
import { createOrganization } from "../organizations";
import { createServiceClient } from "../supabase/service";

describe("createOrganization", () => {
  it("crea la organización y su fila de settings por defecto", async () => {
    const org = await createOrganization({
      name: "Test Co",
      slug: `test-co-${Date.now()}`,
    });
    expect(org.id).toBeTruthy();
    expect(org.name).toBe("Test Co");

    const service = createServiceClient();
    const { data: settings, error } = await service
      .from("org_settings")
      .select("org_id, bot_name")
      .eq("org_id", org.id)
      .single();
    if (error) throw error;
    expect(settings.bot_name).toBe("Asistente");
  });
});
