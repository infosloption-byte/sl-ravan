import { posix } from "node:path";

export const MODEL_ID = "jacaranda_tree";
export const MAX_CANDIDATE_BYTES = 90 * 1024 * 1024;

export function safeRelativeAssetPath(name) {
  if (typeof name !== "string" || !name || name.includes("\\") ||
      name.startsWith("/") || name.includes("\0"))
    throw Error("Unsafe asset dependency path");
  const normalized = posix.normalize(name);
  if (normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/") ||
      normalized.includes(":"))
    throw Error("Invalid asset path: " + name);
  return normalized;
}

export function selectPolyHavenGltf(files) {
  const variants = files?.gltf;
  if (!variants || typeof variants !== "object")
    throw Error("Poly Haven has no glTF downloads for this model");
  const resolution = variants["1k"] ? "1k" : Object.keys(variants).sort()[0];
  const primary = variants[resolution]?.gltf;
  if (!primary || typeof primary.url !== "string")
    throw Error("Poly Haven glTF metadata incomplete");
  const dependencies = Object.entries(primary.include || {});
  const items = [
    { path: "model.gltf", ...primary },
    ...dependencies.map(([path, metadata]) => ({ path: safeRelativeAssetPath(path), ...metadata }))
  ];
  const declaredBytes = items.reduce((total, item) => total + (Number(item.size) || 0), 0);
  if (declaredBytes > MAX_CANDIDATE_BYTES)
    throw Error("Candidate download exceeds 90 MiB; optimize a smaller LOD locally first");
  for (const item of items) {
    if (!Number.isInteger(item.size) || item.size < 1)
      throw Error("Unknown download size for: " + item.path);
    if (!/^https:\/\//i.test(item.url))
      throw Error("Refusing non-HTTPS asset URL");
    const host = new URL(item.url).hostname.toLowerCase();
    if (!["polyhaven.com", "polyhaven.org"].some(base => host === base || host.endsWith("." + base)))
      throw Error("Refusing download from non-Poly-Haven host: " + host);
  }
  return { resolution, items, declaredBytes };
}

export function validateGltfDependencies(text, availablePaths) {
  const model = JSON.parse(text);
  if (model.asset?.version !== "2.0") throw Error("Expected glTF 2.0");
  const needed = [
    ...(model.buffers || []).map(item => item.uri),
    ...(model.images || []).map(item => item.uri)
  ].filter(uri => uri && !uri.startsWith("data:"));
  for (const uri of needed) {
    if (/^[a-z]+:\/\//i.test(uri)) throw Error("External URL in model is not supported");
    const name = safeRelativeAssetPath(decodeURIComponent(uri));
    if (!availablePaths.has(name))
      throw Error("Missing dependency in downloaded candidate: " + name);
  }
  return { meshes: (model.meshes || []).length, materials: (model.materials || []).length,
    textures: (model.images || []).length };
}
