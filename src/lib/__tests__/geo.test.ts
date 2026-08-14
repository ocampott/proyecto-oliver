import { describe, it, expect } from "vitest";
import { haversineMetros, dentroDeGeocerca } from "../geo";

// Obelisco de Buenos Aires como referencia
const OBELISCO = { lat: -34.6037, lon: -58.3816 };

describe("haversineMetros", () => {
  it("mismo punto → ~0 metros", () => {
    expect(haversineMetros(OBELISCO.lat, OBELISCO.lon, OBELISCO.lat, OBELISCO.lon)).toBe(0);
  });

  it("distancia conocida: obelisco → plaza de mayo (~1km)", () => {
    const d = haversineMetros(OBELISCO.lat, OBELISCO.lon, -34.6083, -58.3712);
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1200);
  });
});

describe("dentroDeGeocerca", () => {
  it("dentro del radio → ok", () => {
    const { ok, distancia } = dentroDeGeocerca(
      { ...OBELISCO, radio_metros: 100 },
      OBELISCO.lat + 0.0005, // ~50m al norte
      OBELISCO.lon
    );
    expect(ok).toBe(true);
    expect(distancia).toBeLessThan(100);
  });

  it("fuera del radio → no ok con distancia", () => {
    const { ok, distancia } = dentroDeGeocerca(
      { ...OBELISCO, radio_metros: 100 },
      -34.6083,
      -58.3712
    );
    expect(ok).toBe(false);
    expect(distancia).toBeGreaterThan(100);
  });
});
