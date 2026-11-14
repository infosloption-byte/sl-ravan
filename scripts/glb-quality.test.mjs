import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { createHeritageTree } from "./generate-art.mjs";
import { inspectGlb, requireHeroQuality } from "./glb-quality.mjs";

describe("GLB hero-asset quality gate", () => {
  it("reads valid existing GLB and estimates its geometry", () => {
    const stats = inspectGlb(createHeritageTree().toGlb());
    assert.ok(stats.triangles > 100);
    assert.ok(stats.meshes >= 1);
    assert.ok(stats.materials >= 1);
  });
  it("rejects corrupt GLB and mismatched lengths", () => {
    const bad = Buffer.from(createHeritageTree().toGlb());
    bad.writeUInt32LE(1, 8);
    assert.throws(() => inspectGlb(bad), /length/);
    assert.throws(() => inspectGlb(Buffer.from("hello")), /small/);
  });
  it("does not approve the existing untextured procedural tree as realistic", () => {
    const proxy = inspectGlb(createHeritageTree().toGlb());
    assert.equal(proxy.images, 0);
    assert.throws(() => requireHeroQuality(proxy), /texture/);
  });
  it("guards the first real tree budget", () => {
    assert.throws(() => requireHeroQuality({
      sizeBytes: 100*1024*1024,triangles:200_000,materials:2,images:2
    }), /80 MiB/);
    assert.throws(() => requireHeroQuality({
      sizeBytes: 10*1024*1024,triangles:700_000,materials:2,images:2
    }), /600K/);
  });
});
