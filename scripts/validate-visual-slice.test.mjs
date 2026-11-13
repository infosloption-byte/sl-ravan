import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { validateVisualSlice } from "./validate-visual-slice.mjs";

const plan=JSON.parse(await readFile(new URL("../content/visual-slice/forest-village.json",import.meta.url),"utf8"));

describe("Forest village slice manifest",()=>{
  it("has valid scene layout and explicit quality gates",()=>{
    assert.deepEqual(validateVisualSlice(plan),[]);
  });
  it("rejects repeated or missing asset IDs",()=>{
    const broken=structuredClone(plan);
    broken.requiredAssets[1].id=broken.requiredAssets[0].id;
    assert.ok(validateVisualSlice(broken).some(x=>x.includes("duplicated")));
  });
  it("does not accept imported assets with no verified source",()=>{
    const broken=structuredClone(plan);
    broken.requiredAssets[0].status="integrated";
    assert.ok(validateVisualSlice(broken).some(x=>x.includes("verified source")));
  });
  it("blocks story readiness if production checks are incomplete",()=>{
    const broken=structuredClone(plan);
    broken.gates.readyForStory=true;
    assert.ok(validateVisualSlice(broken).some(x=>x.includes("story cannot begin")));
  });
});
