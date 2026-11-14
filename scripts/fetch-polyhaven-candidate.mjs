import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { dirname, resolve, sep } from "node:path";
import {
  MODEL_ID, MAX_CANDIDATE_BYTES, selectPolyHavenGltf,
  selectRequiredGltfFiles, validateGltfDependencies
} from "./polyhaven-candidate.mjs";

const api = "https://api.polyhaven.com/files/" + MODEL_ID;
const output = resolve(process.cwd(), "public/assets/visual-slice/candidates/jacaranda");
const mb = n => (n / 1048576).toFixed(1) + " MiB";

function budgetFromArgs(args) {
  const opt = args.find(v => v.startsWith("--max-mib="));
  if (!opt) return MAX_CANDIDATE_BYTES;
  const n = Number(opt.substring("--max-mib=".length));
  if (!Number.isSafeInteger(n) || n < 1 || n > 512)
    throw Error("--max-mib must be an integer between 1 and 512");
  return n * 1048576;
}

async function download(item, destination, remaining) {
  if (item.size > remaining) throw Error("Download would exceed source budget: " + item.path);
  const temp = destination + ".partial";
  await rm(temp, {force: true});
  try {
    const response = await fetch(item.url);
    if (!response.ok || !response.body)
      throw Error("Could not download " + item.path + ": HTTP " + response.status);
    let size = 0;
    const md5 = createHash("md5");
    const guard = new Transform({
      transform(chunk, _encoding, done) {
        size += chunk.length;
        if (size > remaining || size > item.size * 1.1) {
          done(Error("Actual download exceeded source budget for " + item.path));
          return;
        }
        md5.update(chunk);
        done(null, chunk);
      }
    });
    await pipeline(Readable.fromWeb(response.body), guard, createWriteStream(temp));
    if (size !== item.size)
      throw Error("Unexpected file size for " + item.path + ": expected " + item.size + ", got " + size);
    if (item.md5 && md5.digest("hex").toLowerCase() !== item.md5.toLowerCase())
      throw Error("Poly Haven checksum mismatch: " + item.path);
    await rm(destination,{force:true});
    await rename(temp, destination);
    console.log("Downloaded", item.path, mb(size));
    return size;
  } finally {
    await rm(temp,{force:true});
  }
}
async function record(path, name) {
  const md5 = createHash("md5");
  for await (const chunk of createReadStream(path)) md5.update(chunk);
  return {file:name, bytes:(await stat(path)).size, md5:md5.digest("hex")};
}

async function main() {
  const args = process.argv.slice(2);
  const maxBytes = budgetFromArgs(args);
  const metadataOnly = args.includes("--inspect");
  const response = await fetch(api, { headers: { "User-Agent": "SL-Ravan-ArtLab/0.2" } });
  if (!response.ok) throw Error("Poly Haven API unavailable: HTTP " + response.status);
  const selected = selectPolyHavenGltf(await response.json());
  console.log("Poly Haven", MODEL_ID, "glTF", selected.resolution);
  console.log("All API-listed files:", mb(selected.declaredBytes));
  console.log("Largest listed files:");
  for (const item of selected.items.slice().sort((a,b)=>b.size-a.size).slice(0,8))
    console.log("  " + mb(item.size) + "  " + item.path);
  console.log("Source download limit:", mb(maxBytes));

  if (metadataOnly) {
    console.log("INSPECT ONLY: nothing downloaded. The glTF may reference fewer files than listed.");
    return;
  }
  const primary = selected.items[0];
  if (primary.size > maxBytes)
    throw Error("The primary glTF alone exceeds " + mb(maxBytes) +
      ". Consider a lighter asset or explicitly increase --max-mib after inspecting sizes.");
  await mkdir(output,{recursive:true});
  // A previous completed receipt must never represent an incomplete new attempt.
  await rm(resolve(output,"source.provenance.json"),{force:true});
  const sourcePath = resolve(output, "model.gltf");
  await download(primary,sourcePath,maxBytes);
  const gltf=await readFile(sourcePath,"utf8");
  const required=selectRequiredGltfFiles(selected,gltf,maxBytes);
  console.log("Actual referenced source files:",required.items.length,
    "| unreferenced API entries skipped:",required.skipped);
  console.log("Estimated download for required files:",mb(required.declaredBytes));
  let transferred = (await stat(sourcePath)).size;
  const inventory = [await record(sourcePath, "model.gltf")];
  for (const item of required.items.slice(1)) {
    const dest=resolve(output,item.path);
    if (!dest.startsWith(output+sep)) throw Error("Unsafe target path: "+item.path);
    await mkdir(dirname(dest),{recursive:true});
    transferred+=await download(item,dest,maxBytes-transferred);
    inventory.push(await record(dest,item.path));
  }
  const report=validateGltfDependencies(gltf,new Set(inventory.map(item=>item.file)));
  await writeFile(resolve(output,"source.provenance.json"),JSON.stringify({
    source:"https://polyhaven.com/a/"+MODEL_ID,
    license:"CC0-1.0",sourceAPI:api,
    resolution:selected.resolution,author:"Rico Cilliers (Poly Haven)",
    downloadedAt:new Date().toISOString(),
    status:"candidate-preview-only-not-game-approved",
    model:report,files:inventory
  },null,2)+"\n");
  console.log("PASS: verified",inventory.length,"files ("+mb(transferred)+").");
  console.log("Open /?artlab to inspect; raw source is NOT approved for the game.");
}

main().catch(error => {
  // Handle a normal size rejection without an unhandled top-level exception.
  console.error("SL Ravan Poly Haven candidate was not downloaded:");
  console.error(error instanceof Error ? error.message : String(error));
  console.error("Use npm run art:candidate-size to inspect API metadata.");
  process.exitCode = 1;
});
