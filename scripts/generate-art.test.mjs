import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { createHeritageTree, createStonePavilion } from "./generate-art.mjs";

function validateGlb(bytes) {
  assert.equal(bytes.toString("ascii",0,4), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength=bytes.readUInt32LE(12);
  assert.equal(bytes.toString("ascii",16,20),"JSON");
  const json=JSON.parse(bytes.subarray(20,20+jsonLength).toString("utf8"));
  assert.equal(json.asset.version,"2.0");
  const binaryAt=20+jsonLength;
  assert.equal(bytes.toString("ascii",binaryAt+4,binaryAt+8),"BIN\0");
  assert.equal(bytes.readUInt32LE(binaryAt)+binaryAt+8,bytes.length);
  assert.ok(json.meshes[0].primitives.length>=4);
  assert.ok(json.materials.length>=4);
  for(const a of json.accessors) {
    assert.ok(a.count>0);
    assert.ok(json.bufferViews[a.bufferView]);
    if(a.min){assert.ok(a.min.every(Number.isFinite));assert.ok(a.max.every(Number.isFinite));}
  }
  return json;
}

describe("Original SL Ravan GLB assets",()=>{
  it("generates a layered leafy rain tree",()=>{
    const bytes=createHeritageTree().toGlb(),data=validateGlb(bytes);
    assert.ok(data.accessors.some(a=>a.max?.[1]>12));
    assert.ok(data.materials.some(m=>/foliage|canopy/.test(m.name)));
    assert.ok(bytes.length>20_000 && bytes.length<1_000_000);
  });
  it("generates an ancient carved pavilion",()=>{
    const bytes=createStonePavilion().toGlb(),data=validateGlb(bytes);
    assert.ok(data.accessors.some(a=>a.max?.[1]>8));
    assert.ok(data.materials.some(m=>m.name.includes("bronze")));
    assert.ok(bytes.length>10_000 && bytes.length<500_000);
  });
});
