import { describe, expect, it } from "vitest";
import { groundColorAt, paintGroundPixels, type TerrainBounds } from "./TerrainPaint";
import { pathCenter } from "./World";

const bounds: TerrainBounds = { minX: -100, maxX: 100, minZ: -120, maxZ: 120 };

describe("baked terrain paint", () => {
  it("paints warm dirt on the trail and green grass away from it", () => {
    for (const z of [-60, -10, 25, 70]) {
      const trail = groundColorAt(pathCenter(z), z, pathCenter);
      const meadow = groundColorAt(pathCenter(z) + 14, z, pathCenter);
      expect(trail[0]).toBeGreaterThan(trail[2] * 1.3); // brown: red well above blue
      expect(meadow[1]).toBeGreaterThan(meadow[0]); // green dominates
    }
  });

  it("keeps every colour channel in a displayable range", () => {
    for (let i = 0; i < 300; i++) {
      const colour = groundColorAt(-95 + i * .63, -110 + i * .73, pathCenter);
      for (const channel of colour) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it("lines the painted trail up with the world path (row 0 is maxZ)", () => {
    const size = 256;
    const pixels = paintGroundPixels(size, bounds, pathCenter);
    expect(pixels.length).toBe(size * size * 4);
    for (const z of [-80, -20, 40, 90]) {
      const py = Math.floor(((bounds.maxZ - z) / (bounds.maxZ - bounds.minZ)) * size);
      const px = Math.floor(((pathCenter(z) - bounds.minX) / (bounds.maxX - bounds.minX)) * size);
      const i = (py * size + px) * 4;
      expect(pixels[i]).toBeGreaterThan(pixels[i + 2]); // dirt at the trail
      expect(pixels[i + 3]).toBe(255);
      const grass = (py * size + Math.min(size - 1, px + 20)) * 4; // ~15 m to the side
      expect(pixels[grass + 1]).toBeGreaterThan(pixels[grass]);
    }
  });

  it("is deterministic", () => {
    const a = paintGroundPixels(32, bounds, pathCenter);
    const b = paintGroundPixels(32, bounds, pathCenter);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
