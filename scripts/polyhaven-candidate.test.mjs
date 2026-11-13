import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  safeRelativeAssetPath, selectPolyHavenGltf, selectRequiredGltfFiles, validateGltfDependencies
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
  it("does not mistake unused heavyweight API textures for required files",()=>{
    const metadata=structuredClone(source);
    metadata.gltf["1k"].gltf.include["textures/unused.exr"]={
      url:"https://dl.polyhaven.org/tree/unused.exr",size:120*1024*1024
    };
    const selected=selectPolyHavenGltf(metadata);
    assert.ok(selected.declaredBytes>90*1024*1024);
    const model=JSON.stringify({
      asset:{version:"2.0"},
      buffers:[{uri:"tree.bin"}],images:[{uri:"textures/leaves.jpg"}]
    });
    const actual=selectRequiredGltfFiles(selected,model);
    assert.equal(actual.items.length,3);
    assert.equal(actual.declaredBytes,6000);
    assert.equal(actual.skipped,1);
  });
  it("rejects only genuinely oversized dependencies and explains the source budget",()=>{
    const selected=selectPolyHavenGltf(source);
    const model=JSON.stringify({asset:{version:"2.0"},buffers:[{uri:"tree.bin"}]});
    assert.throws(()=>selectRequiredGltfFiles(selected,model,2000),/Required Jacaranda files total/);
    assert.equal(selectRequiredGltfFiles(selected,model,10000).items.length,2);
  });
  it("rejects external glTF texture URLs and mismatched API metadata",()=>{
    const selected=selectPolyHavenGltf(source);
    assert.throws(()=>selectRequiredGltfFiles(selected,JSON.stringify({
      asset:{version:"2.0"},images:[{uri:"https://evil.invalid/a.jpg"}]
    })),/External URLs/);
    assert.throws(()=>selectRequiredGltfFiles(selected,JSON.stringify({
      asset:{version:"2.0"},images:[{uri:"missing.jpg"}]
    })),/no referenced dependency/);
  });
  it("requires an explicit bounded source allowance",()=>{
    const selected=selectPolyHavenGltf(source);
    const model=JSON.stringify({asset:{version:"2.0"}});
    assert.throws(()=>selectRequiredGltfFiles(selected,model,1024*1024*1024),/512 MiB/);
    assert.equal(selectRequiredGltfFiles(selected,model).items.length,1);
  });
  it("validates referenced glTF texture and binary dependencies",()=>{
    const file=JSON.stringify({asset:{version:"2.0"},meshes:[{}],images:[{uri:"textures/leaves.jpg"}],buffers:[{uri:"tree.bin"}]});
    assert.equal(validateGltfDependencies(file,new Set(["textures/leaves.jpg","tree.bin"])).textures,1);
    assert.throws(()=>validateGltfDependencies(file,new Set(["tree.bin"])),/Missing dependency/);
  });
});
