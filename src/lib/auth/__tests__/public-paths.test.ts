import { describe, it, expect } from "vitest";
import { isPublicPath } from "../public-paths";

describe("isPublicPath", () => {
  it("trata /login como pública", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it("trata el callback de auth como público, incluidas subrutas", () => {
    expect(isPublicPath("/api/auth/callback")).toBe(true);
    expect(isPublicPath("/api/auth/callback/whatever")).toBe(true);
  });

  it("trata la raíz del dashboard como protegida", () => {
    expect(isPublicPath("/")).toBe(false);
  });

  it("trata /admin como protegida", () => {
    expect(isPublicPath("/admin")).toBe(false);
  });

  it("trata /empleados como protegida", () => {
    expect(isPublicPath("/empleados")).toBe(false);
  });
});
