import { describe, expect, it } from "vitest";
import { buildTileableNormalMap, fbm, hash2, mulberry32, periodicNoise, valueNoise } from "./Noise";

describe("procedural noise toolkit", () => {
  it("produces a repeatable random stream for a seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it("keeps hash, value noise and fbm inside [0, 1]", () => {
    for (let i = 0; i < 400; i++) {
      const x = i * .37 - 50;
      const y = i * .21 + 3;
      for (const v of [hash2(i, -i, 5), valueNoise(x, y, 2), fbm(x, y, 4, 1)]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is continuous: tiny input steps give tiny output steps", () => {
    for (let i = 0; i < 100; i++) {
      const x = i * .53;
      expect(Math.abs(valueNoise(x, 1.3) - valueNoise(x + .001, 1.3))).toBeLessThan(.02);
    }
  });

  it("tiles seamlessly at its period", () => {
    for (let i = 0; i < 50; i++) {
      const x = i * .41;
      const y = i * .17;
      expect(periodicNoise(x, y, 8, 3)).toBeCloseTo(periodicNoise(x + 8, y, 8, 3), 9);
      expect(periodicNoise(x, y, 8, 3)).toBeCloseTo(periodicNoise(x, y + 8, 8, 3), 9);
    }
  });

  it("builds an opaque normal map whose normals face outward", () => {
    const size = 32;
    const map = buildTileableNormalMap(size);
    expect(map.length).toBe(size * size * 4);
    for (let i = 0; i < map.length; i += 4) {
      expect(map[i + 3]).toBe(255);
      expect(map[i + 2]).toBeGreaterThanOrEqual(128); // z component is never negative
    }
  });
});
