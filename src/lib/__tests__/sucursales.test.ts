import { describe, it, expect, beforeAll } from "vitest";
import { listSucursales, createSucursal, updateSucursal, getSucursal } from "../sucursales";
import { createServiceClient } from "../supabase/service";

async function crearOrg(nombre: string): Promise<string> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("organizations")
    .insert({ name: nombre, slug: `${nombre.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}` })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

describe("sucursales", () => {
  let orgA: string;
  let orgB: string;

  beforeAll(async () => {
    orgA = await crearOrg("Sucursales A");
    orgB = await crearOrg("Sucursales B");
  });

  it("crea con defaults y lista con aislamiento por org", async () => {
    const suc = await createSucursal(orgA, { nombre: "Casa Central" });
    expect(suc.radio_metros).toBe(100);
    expect(suc.lat).toBeNull();

    const listaA = await listSucursales(orgA);
    expect(listaA.map((s) => s.id)).toContain(suc.id);

    const listaB = await listSucursales(orgB);
    expect(listaB.map((s) => s.id)).not.toContain(suc.id);
  });

  it("crea con geocerca y actualiza", async () => {
    const suc = await createSucursal(orgA, {
      nombre: "Sucursal GPS",
      lat: -34.6037,
      lon: -58.3816,
      radio_metros: 200,
    });
    expect(suc.lat).toBeCloseTo(-34.6037);

    const updated = await updateSucursal(orgA, suc.id, { radio_metros: 300 });
    expect(updated.radio_metros).toBe(300);

    const fetched = await getSucursal(orgA, suc.id);
    expect(fetched?.nombre).toBe("Sucursal GPS");

    // Una sucursal de otra org no se puede leer con el orgId equivocado
    expect(await getSucursal(orgB, suc.id)).toBeNull();
  });
});
