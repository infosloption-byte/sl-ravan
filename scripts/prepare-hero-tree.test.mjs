import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { createBlenderArgs, validateCandidateReceipt } from "./prepare-hero-tree.mjs";

const candidate = {
  source:"https://polyhaven.com/a/jacaranda_tree",
  license:"CC0-1.0",status:"candidate-preview-only-not-game-approved",
  model:{meshes:3,materials:4,textures:8},
  files:[{file:"model.gltf",bytes:1234}]
};
describe("Blender tree conversion planning",()=>{
  it("passes paths with spaces as separate safe process arguments",()=>{
    const args=createBlenderArgs("C:\\User Files\\model.gltf","C:\\Output Path\\tree.glb","C:\\Scripts\\convert.py");
    assert.equal(args[args.length-3],"--");
    assert.equal(args[args.length-2],"C:\\User Files\\model.gltf");
    assert.equal(args[args.length-1],"C:\\Output Path\\tree.glb");
    assert.equal(args[4],"--python");
  });
  it("accepts the explicitly registered CC0 candidate only",()=>{
    assert.equal(validateCandidateReceipt(candidate),true);
    assert.throws(()=>validateCandidateReceipt({...candidate,license:"unknown"}),/CC0/);
    assert.throws(()=>validateCandidateReceipt({...candidate,source:"https://unknown.invalid"}),/Jacaranda/);
  });
  it("requires model/source file inventory",()=>{
    assert.throws(()=>validateCandidateReceipt({...candidate,files:[]}),/inventory/);
    assert.throws(()=>validateCandidateReceipt({...candidate,model:{meshes:0}}),/meshes/);
  });
});
