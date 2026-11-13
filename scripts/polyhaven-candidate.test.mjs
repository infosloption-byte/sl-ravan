import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  safeRelativeAssetPath, selectPolyHavenGltf, validateGltfDependencies
} from "./polyhaven-candidate.mjs";

const source = {gltf: {"1k": {gltf: {
  url: "https://dl.polyhaven.org/tree/model.gltf", size: 1000, md5: "aabb",
  include: {
    "textures/leaves.jpg": {url:"https://dl.polyhaven.org/tree/leaves.jpg",size:2000,md5:"aacc"},
    "tree.bin":{url:"https://dl.polyhaven.org/tree/tree.bin",size:3000,md5:"aadd"}
  }
}}}};
describe("Poly Haven candidate planner",()=>{
  it("selects the smallest labeled 1K download with dependencies",()=>{
    const selected=selectPolyHavenGltf(source);
    assert.equal(selected.resolution,"1k");
    assert.equal(selected.items.length,3);
    assert.equal(selected.declaredBytes,6000);
  });
  it("rejects dependency path traversal",()=>{
    assert.throws(()=>safeRelativeAssetPath("../steal"),/Invalid/);
    assert.throws(()=>selectPolyHavenGltf({gltf:{"1k":{gltf:{
      ...source.gltf["1k"].gltf,
      include:{"../../outside.bin":{url:"https://dl.polyhaven.org/bad",size:2}}
    }}}}),/Invalid/);
  });
  it("rejects download hosts outside Poly Haven",()=>{
    const fake=structuredClone(source);
    fake.gltf["1k"].gltf.url="https://untrusted.invalid/malware";
    assert.throws(()=>selectPolyHavenGltf(fake),/non-Poly-Haven/);
  });
  it("validates referenced glTF texture and binary dependencies",()=>{
    const file=JSON.stringify({asset:{version:"2.0"},meshes:[{}],images:[{uri:"textures/leaves.jpg"}],buffers:[{uri:"tree.bin"}]});
    assert.equal(validateGltfDependencies(file,new Set(["textures/leaves.jpg","tree.bin"])).textures,1);
    assert.throws(()=>validateGltfDependencies(file,new Set(["tree.bin"])),/Missing dependency/);
  });
});
