import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectGlb, requireHeroQuality } from "./glb-quality.mjs";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE = resolve(PROJECT_ROOT, "public/assets/visual-slice/candidates/jacaranda/model.gltf");
const RECEIPT_PATH = resolve(PROJECT_ROOT, "public/assets/visual-slice/candidates/jacaranda/source.provenance.json");
const DESTINATION = resolve(PROJECT_ROOT, "public/assets/visual-slice/vegetation/hero-tree.glb");

export function createBlenderArgs(source, destination, script = resolve(PROJECT_ROOT, "scripts/blender-export-tree.py")) {
  return [
    "--background", "--factory-startup", "--python-exit-code", "1",
    "--python", script, "--", source, destination
  ];
}

export function validateCandidateReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") throw Error("Source provenance receipt missing");
  if (receipt.source !== "https://polyhaven.com/a/jacaranda_tree")
    throw Error("Expected the approved Jacaranda source URL");
  if (receipt.license !== "CC0-1.0") throw Error("Model license must be CC0-1.0");
  if (receipt.status !== "candidate-preview-only-not-game-approved")
    throw Error("Unexpected candidate status");
  if (!Array.isArray(receipt.files) || !receipt.files.some(x => x.file === "model.gltf"))
    throw Error("Candidate glTF file inventory missing");
  if (!receipt.model || receipt.model.meshes < 1)
    throw Error("Candidate source has no glTF meshes");
  return true;
}

function runBlender(executable, args) {
  return new Promise((success, failure) => {
    const child = spawn(executable, args, { cwd: PROJECT_ROOT, stdio: "inherit", shell: false });
    child.once("error", failure);
    child.once("close", code => {
      if (code === 0) success();
      else failure(Error("Blender conversion exited with status " + code));
    });
  });
}

async function sha256(filename) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(filename)) hash.update(bytes);
  return hash.digest("hex");
}

export async function prepareHeroTree(options = {}) {
  const source = resolve(options.source || DEFAULT_SOURCE);
  const output = resolve(options.output || DESTINATION);
  const sourceReceipt = JSON.parse(await readFile(options.receipt || RECEIPT_PATH, "utf8"));
  validateCandidateReceipt(sourceReceipt);
  await stat(source);
  await mkdir(dirname(output), {recursive:true});
  const temporary = output + ".converting.glb";
  try {
    const executable = options.blender || process.env.BLENDER_BIN || "blender";
    console.log("SL Ravan: exporting candidate tree in Blender (not yet approved)");
    await runBlender(executable, createBlenderArgs(source, temporary));
    const bytes = await readFile(temporary);
    const report = inspectGlb(bytes);
    requireHeroQuality(report);
    // Atomic rename after all checks so a failed export never overwrites a working asset.
    await rename(temporary, output);
    const receipt = {
      assetId: "tree-hero", source: sourceReceipt.source,
      license: sourceReceipt.license, author: sourceReceipt.author,
      createdAt: new Date().toISOString(),
      file: "hero-tree.glb", sha256: await sha256(output),
      report, status: "installed-pending-human-visual-and-performance-approval",
      note: "Conversion does not signify visual approval or production readiness"
    };
    await writeFile(output.replace(/\.glb$/i, ".provenance.json"),
      JSON.stringify(receipt,null,2) + "\n");
    console.log("PASS: converted original CC0 tree to", output);
    console.log("Triangles:", report.triangles, "Embedded images:", report.images);
    console.log("Open http://127.0.0.1:5186/?artlab for visual review; test FPS in-game.");
    return report;
  } finally {
    await rm(temporary, {force:true});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareHeroTree().catch(error => {
    console.error("Tree preparation failed:", error instanceof Error ? error.message : String(error));
    console.error("Check source candidate, Blender installation, export materials and triangle budget.");
    process.exitCode = 1;
  });
}
