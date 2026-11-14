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
  // The API may list more texture dependencies than the glTF actually uses.
  // Apply the download limit only after reading its referenced file URIs.
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


/** Download only the files that a selected glTF actually references. */
export function selectRequiredGltfFiles(selected, gltfText, maxBytes = MAX_CANDIDATE_BYTES) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 512 * 1024 * 1024)
    throw Error("Source download cap must be between 1 byte and 512 MiB");
  const model = JSON.parse(gltfText);
  if (model.asset?.version !== "2.0") throw Error("Expected glTF 2.0");
  const refs = [
    ...(model.buffers || []).map(item => item.uri),
    ...(model.images || []).map(item => item.uri)
  ].filter(uri => typeof uri === "string" && uri && !uri.startsWith("data:"));
  const paths = new Set(["model.gltf"]);
  for (const uri of refs) {
    if (/^[a-z][\w+.-]*:/i.test(uri) || uri.startsWith("//"))
      throw Error("External URLs in glTF dependencies are not allowed");
    let name;
    try { name = safeRelativeAssetPath(decodeURIComponent(uri)); }
    catch { throw Error("Unsafe or invalid glTF dependency URI: " + uri); }
    paths.add(name);
  }
  const lookup = new Map(selected.items.map(item => [item.path, item]));
  const items = [];
  for (const path of paths) {
    const item = lookup.get(path);
    if (!item) throw Error("Poly Haven API has no referenced dependency: " + path);
    items.push(item);
  }
  const requiredBytes = items.reduce((sum, item) => sum + item.size, 0);
  if (requiredBytes > maxBytes) {
    const top = items.slice().sort((a, b) => b.size - a.size).slice(0, 3)
      .map(item => item.path + " " + (item.size / 1048576).toFixed(1) + " MiB").join(", ");
    throw Error("Required Jacaranda files total " + (requiredBytes / 1048576).toFixed(1) +
      " MiB (limit " + (maxBytes / 1048576).toFixed(0) + " MiB). Largest: " + top +
      ". For source conversion only, use --max-mib=N up to 512 if you have sufficient resources.");
  }
  return { resolution: selected.resolution, items, declaredBytes: requiredBytes,
    skipped: selected.items.length - items.length };
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
