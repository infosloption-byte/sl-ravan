import { readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { inspectGlb, requireHeroQuality } from "./glb-quality.mjs";

const flags = Object.fromEntries(process.argv.slice(2).map(value => {
  const eq = value.indexOf("=");
  return [value.slice(0, eq), value.slice(eq + 1)];
}));
function required(name) {
  const value = flags[name];
  if (!value || value === "undefined") throw Error("Missing required --" + name + "=...");
  return value;
}
try {
  const input = resolve(required("--file"));
  const source = required("--source");
  const author = required("--author");
  const license = required("--license");
  if (!/^https:\/\//i.test(source)) throw Error("Source must be a verifiable HTTPS URL");
  if (!["CC0-1.0", "original", "licensed"].includes(license))
    throw Error("License must be CC0-1.0, original or licensed; retain evidence");
  const buffer = await readFile(input);
  const stats = inspectGlb(buffer);
  requireHeroQuality(stats);
  const output = resolve(process.cwd(), "public/assets/visual-slice/vegetation/hero-tree.glb");
  await mkdir(dirname(output), { recursive: true });
  await copyFile(input, output);
  const receipt = {
    assetId: "tree-hero",
    source, author, license,
    importedAt: new Date().toISOString(),
    file: "hero-tree.glb",
    sha256: createHash("sha256").update(buffer).digest("hex"),
    inspection: stats,
    status: "needs-human-art-and-performance-approval"
  };
  await writeFile(output.replace(/\.glb$/i, ".provenance.json"),
    JSON.stringify(receipt, null, 2) + "\n");
  console.log("PASS: hero-tree GLB copied to public/assets/visual-slice/vegetation.");
  console.log("Triangles:",stats.triangles,"Materials:",stats.materials,"Images:",stats.images);
  console.log("Source/provenance receipt written. Visual approval is still required.");
} catch(error) {
  console.error("Hero-tree import rejected:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
