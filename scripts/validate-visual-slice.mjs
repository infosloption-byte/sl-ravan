import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function validateVisualSlice(data) {
  const issues=[];
  const check=(condition,message)=>{if(!condition) issues.push(message);};
  check(data?.schemaVersion===1,"schemaVersion must be 1");
  check(typeof data?.id==="string" && data.id.length>0,"scene id required");
  check(data?.units==="m" && data?.axes==="x-right-y-up-z-forward","coordinate system invalid");
  const b=data?.bounds??{};
  check([b.minX,b.maxX,b.minZ,b.maxZ].every(Number.isFinite) &&
    b.minX<b.maxX && b.minZ<b.maxZ,"scene bounds invalid");
  const shot=data?.heroShot;
  check(!!shot && shot.aspect==="16:9" &&
    Array.isArray(shot.camera) && shot.camera.length===3 &&
    shot.camera.every(Number.isFinite) &&
    Array.isArray(shot.target) && shot.target.length===3 &&
    shot.target.every(Number.isFinite),"hero camera bookmark missing/invalid");
  const zones=data?.zones;
  check(Array.isArray(zones) && zones.length>=3,"three layout zones required");
  if(Array.isArray(zones)) {
    for(let i=0;i<zones.length;i++){
      const z=zones[i].z;
      check(Array.isArray(z) && z.length===2 && z.every(Number.isFinite) && z[0]<z[1],
        "zone bounds invalid: "+zones[i].id);
      if(i>0 && Array.isArray(z) && Array.isArray(zones[i-1].z))
        check(zones[i-1].z[1]===z[0],"zones are not contiguous at "+zones[i].id);
    }
  }
  const assets=data?.requiredAssets;
  check(Array.isArray(assets) && assets.length>=8,"asset requirements must be explicit");
  if(Array.isArray(assets)){
    const seen=new Set();
    for(const a of assets){
      check(typeof a.id==="string" && a.id.length>0 && !seen.has(a.id),
        "invalid or duplicated asset id: "+a.id);
      seen.add(a.id);
      check(["P0","P1","P2"].includes(a.priority),"invalid priority: "+a.id);
      check(["not-sourced","approved","integrated"].includes(a.status),"invalid status: "+a.id);
      if(a.status!=="not-sourced")
        check(typeof a.source==="string" && a.source.length>0,
          "approved/integrated asset needs verified source: "+a.id);
    }
  }
  const p=data?.budgets??{};
  for(const key of ["fpsDesktop","fpsLow","drawCallsMedium","trianglesMedium","initialArtMiB","totalArtMiB"]){
    check(Number.isFinite(p[key]) && p[key]>0,"budget missing: "+key);
  }
  const gates=data?.gates??{};
  check(Object.keys(gates).length>=7 && Object.values(gates).every(x=>typeof x==="boolean"),
    "quality gates must be explicit booleans");
  check(!gates.readyForStory || Object.entries(gates).every(([key,ok])=>key==="readyForStory"||ok),
    "story cannot begin before all visual/engineering gates pass");
  return issues;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const filename=resolve(process.cwd(),process.argv[2]??"content/visual-slice/forest-village.json");
  try{
    const plan=JSON.parse(await readFile(filename,"utf8"));
    const issues=validateVisualSlice(plan);
    if(issues.length){
      console.error(issues.map(e=>"ERROR: "+e).join("\n"));
      process.exitCode=1;
    }else{
      const pending=plan.requiredAssets.filter(a=>a.status==="not-sourced").length;
      console.log("PASS: visual slice manifest structure is valid.");
      console.log("Assets still required: "+pending+"/"+plan.requiredAssets.length);
      console.log("This validates the PLAN only, not scene visual quality or startup.");
    }
  }catch(err){console.error(err);process.exitCode=1;}
}
