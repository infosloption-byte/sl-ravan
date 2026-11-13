import { describe, expect, it } from "vitest";
import { surfaceHash } from "./ForestSurface";

describe("deterministic forest terrain microtexture", () => {
  it("is deterministic for fixed seed coordinates", () => {
    expect(surfaceHash(22, 31)).toBe(surfaceHash(22, 31));
  });

  it("stays between 0 and 1 with varied sampling", () => {
    const samples = Array.from({ length: 100 }, (_, i) => surfaceHash(i * 37, i * 11));
    expect(samples.every(n => Number.isFinite(n) && n >= 0 && n < 1)).toBe(true);
    expect(new Set(samples).size).toBeGreaterThan(90);
  });
});
