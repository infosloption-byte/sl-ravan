import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { dirname, resolve } from "node:path";
import {
  MODEL_ID, MAX_CANDIDATE_BYTES, selectPolyHavenGltf, validateGltfDependencies
} from "./polyhaven-candidate.mjs";

const api = "https://api.polyhaven.com/files/" + MODEL_ID;
const output = resolve(process.cwd(), "public/assets/visual-slice/candidates/jacaranda");
const request = await fetch(api, { headers: { "User-Agent": "SL-Ravan-ArtLab/0.1" } });
if (!request.ok) throw Error("Poly Haven API unavailable: HTTP " + request.status);
const metadata = await request.json();
const selected = selectPolyHavenGltf(metadata);
console.log("Poly Haven glTF candidate:", MODEL_ID, selected.resolution);
console.log("Declared source download:", (selected.declaredBytes/1024/1024).toFixed(1), "MiB");

await mkdir(output, { recursive: true });
let bytes = 0;
const inventory = [];
for (const item of selected.items) {
  const destination = resolve(output, item.path);
  if (!destination.startsWith(output + "/") && !destination.startsWith(output + "\\"))
    throw Error("Unsafe destination path");
  await mkdir(dirname(destination), { recursive: true });
  const downloaded = await fetch(item.url);
  if (!downloaded.ok || !downloaded.body) throw Error("Download failed: " + item.path);
  const announced = Number(downloaded.headers.get("content-length"));
  if (Number.isFinite(announced) && announced > item.size * 1.1)
    throw Error("Unexpected download size: " + item.path);
  await pipeline(Readable.fromWeb(downloaded.body), createWriteStream(destination));
  const fileSize = (await stat(destination)).size;
  bytes += fileSize;
  if (bytes > MAX_CANDIDATE_BYTES) throw Error("Candidate exceeded 90 MiB while downloading");
  const md5 = createHash("md5");
  for await (const chunk of createReadStream(destination)) md5.update(chunk);
  const hash = md5.digest("hex");
  if (item.md5 && hash.toLowerCase() !== item.md5.toLowerCase())
    throw Error("Poly Haven MD5 mismatch for: " + item.path);
  inventory.push({file: item.path, bytes: fileSize, md5: hash});
  console.log("Downloaded", item.path, (fileSize/1024/1024).toFixed(2), "MiB");
}

const gltf = await readFile(resolve(output, "model.gltf"), "utf8");
const report = validateGltfDependencies(gltf, new Set(inventory.map(x => x.file)));
await writeFile(resolve(output, "source.provenance.json"), JSON.stringify({
  source: "https://polyhaven.com/a/" + MODEL_ID,
  license: "CC0-1.0",
  sourceAPI: api,
  resolution: selected.resolution,
  author: "Rico Cilliers (Poly Haven)",
  downloadedAt: new Date().toISOString(),
  status: "candidate-preview-only-not-game-approved",
  model: report,
  files: inventory
}, null, 2) + "\n");
console.log("Candidate ready for inspection only. Open /?artlab and select Poly Haven Jacaranda.");
console.log("This source is NOT yet an optimized/approved in-game hero tree.");
