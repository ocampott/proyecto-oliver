import { describe, it, expect, beforeAll } from "vitest";
import {
  listEmpleados,
  createEmpleado,
  updateEmpleado,
  setEmpleadoActivo,
  getEmpleadoByDeviceToken,
  vincularDispositivo,
  desvincularDispositivo,
  buscarEnNomina,
} from "../empleados";
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

describe("empleados", () => {
  let orgA: string;
  let orgB: string;

  beforeAll(async () => {
    orgA = await crearOrg("Empleados A");
    orgB = await crearOrg("Empleados B");
  });

  it("crea y lista empleados con aislamiento por org", async () => {
    const emp = await createEmpleado(orgA, { nombre: "Juan Pérez", celular: "1155551234" });
    expect(emp.nombre).toBe("Juan Pérez");

    const listaA = await listEmpleados(orgA);
    expect(listaA.map((e) => e.id)).toContain(emp.id);

    const listaB = await listEmpleados(orgB);
    expect(listaB.map((e) => e.id)).not.toContain(emp.id);
  });

  it("actualiza nombre y celular", async () => {
    const emp = await createEmpleado(orgA, { nombre: "Ana Gómez" });
    const updated = await updateEmpleado(orgA, emp.id, { celular: "1199990000" });
    expect(updated.celular).toBe("1199990000");
  });

  it("ciclo de vínculo de dispositivo", async () => {
    const emp = await createEmpleado(orgA, { nombre: "Vínculo Demo" });
    const token = `token-${Date.now()}`;

    expect(await getEmpleadoByDeviceToken(orgA, token)).toBeNull();

    await vincularDispositivo(orgA, emp.id, token);
    const encontrado = await getEmpleadoByDeviceToken(orgA, token);
    expect(encontrado?.id).toBe(emp.id);

    // Un empleado inactivo no se reconoce por token
    await setEmpleadoActivo(orgA, emp.id, false);
    expect(await getEmpleadoByDeviceToken(orgA, token)).toBeNull();

    await setEmpleadoActivo(orgA, emp.id, true);
    await desvincularDispositivo(orgA, emp.id);
    expect(await getEmpleadoByDeviceToken(orgA, token)).toBeNull();
  });

  it("buscarEnNomina: exacto, aproximado y sin match", async () => {
    await createEmpleado(orgA, { nombre: "Villareal Juan" });

    const exacto = await buscarEnNomina(orgA, "juan villareal");
    expect(exacto?.empleado.nombre).toBe("Villareal Juan");
    expect(exacto?.exacto).toBe(true);

    const parecido = await buscarEnNomina(orgA, "Villaruel Juan");
    expect(parecido?.empleado.nombre).toBe("Villareal Juan");
    expect(parecido?.exacto).toBe(false);

    expect(await buscarEnNomina(orgA, "Nombre Que No Existe")).toBeNull();
  });

  it("buscarEnNomina no encuentra empleados inactivos", async () => {
    const emp = await createEmpleado(orgA, { nombre: "Inactivo Demo" });
    await setEmpleadoActivo(orgA, emp.id, false);
    expect(await buscarEnNomina(orgA, "Inactivo Demo")).toBeNull();
  });
});
