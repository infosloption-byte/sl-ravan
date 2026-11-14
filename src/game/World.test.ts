import { describe, it, expect } from "vitest";
import { groundHeight, pathCenter } from "./World";

describe("forest terrain height query", () => {
  it("returns consistent finite heights for the playable area", () => {
    const points = [[0, -45], [0, 0], [5, 20], [-12, 55], [1, 100]];
    for (const [x, z] of points) {
      const y = groundHeight(x, z);
      expect(Number.isFinite(y)).toBe(true);
      expect(y).toBe(groundHeight(x, z));
    }
  });
  it("gently elevates distant wilderness away from the main path", () => {
    expect(groundHeight(90, 0)).toBeGreaterThan(groundHeight(0, 0));
  });
  it("sinks the trail slightly below its banks", () => {
    for (const z of [-60, -10, 30, 80]) {
      expect(groundHeight(pathCenter(z), z)).toBeLessThan(groundHeight(pathCenter(z) + 6, z));
    }
  });
});
