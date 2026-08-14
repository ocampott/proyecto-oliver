import { describe, it, expect } from "vitest";
import { normalizeNombre, validarEmpleado, buscarEmpleadoParecido } from "../nomina";

const NOMINA = [
  "Ruiz Diaz Sol Evangelina",
  "Villareal Juan",
  "Gómez María José",
];

describe("normalizeNombre", () => {
  it("minúsculas, sin tildes, palabras ordenadas", () => {
    expect(normalizeNombre("  María José GÓMEZ ")).toEqual(["jose", "maria", "gomez"].sort());
  });
});

describe("validarEmpleado", () => {
  it("matchea exacto con palabras en otro orden", () => {
    expect(validarEmpleado(NOMINA, "Juan Villareal")).toBe("Villareal Juan");
  });

  it("ignora tildes y mayúsculas", () => {
    expect(validarEmpleado(NOMINA, "maria jose gomez")).toBe("Gómez María José");
  });

  it("matchea subset (nombre incompleto)", () => {
    expect(validarEmpleado(NOMINA, "Sol Ruiz Díaz")).toBe("Ruiz Diaz Sol Evangelina");
  });

  it("devuelve null si no hay match", () => {
    expect(validarEmpleado(NOMINA, "Pedro Pascal")).toBeNull();
  });

  it("devuelve null si es ambiguo entre varios subset", () => {
    expect(validarEmpleado(["Pérez Juan", "Pérez Ana"], "Pérez")).toBeNull();
  });

  it("devuelve null con input vacío", () => {
    expect(validarEmpleado(NOMINA, "   ")).toBeNull();
  });
});

describe("buscarEmpleadoParecido", () => {
  it("sugiere con una letra de más/menos en palabra larga", () => {
    expect(buscarEmpleadoParecido(["Villareal Juan"], "Villaruel Juan")).toBe("Villareal Juan");
  });

  it("no tolera errores en palabras cortas", () => {
    expect(buscarEmpleadoParecido(["Ana Paz"], "Ale Paz")).toBeNull();
  });

  it("devuelve null si es ambiguo", () => {
    expect(
      buscarEmpleadoParecido(["Villareal Juan", "Villareal Juana"], "Villaruel")
    ).toBeNull();
  });
});
