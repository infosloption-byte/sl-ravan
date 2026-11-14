/**
 * Minimal GLB 2.0 structural validation and asset budget guard.
 * Does not replace a complete glTF validator or visual review.
 */
export function inspectGlb(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 28)
    throw Error("GLB file is too small or unreadable");
  if (buffer.toString("ascii", 0, 4) !== "glTF" || buffer.readUInt32LE(4) !== 2)
    throw Error("Expected a binary glTF 2.0 (.glb) file");
  if (buffer.readUInt32LE(8) !== buffer.length)
    throw Error("GLB length in header does not match file length");
  const jsonLength = buffer.readUInt32LE(12);
  if (buffer.toString("ascii", 16, 20) !== "JSON" || jsonLength > buffer.length - 20)
    throw Error("Invalid GLB JSON chunk");
  const data = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
  if (data.asset?.version !== "2.0") throw Error("Unsupported glTF asset version");
  const meshes = data.meshes || [];
  const accessors = data.accessors || [];
  let triangles = 0;
  let primitives = 0;
  for (const mesh of meshes) {
    for (const primitive of mesh.primitives || []) {
      if (primitive.mode !== undefined && primitive.mode !== 4)
        throw Error("Only triangle-list GLB primitives supported in this first asset pass");
      const index = primitive.indices !== undefined ?
        accessors[primitive.indices] : accessors[primitive.attributes?.POSITION];
      if (!index || !Number.isInteger(index.count) || index.count < 3)
        throw Error("A mesh primitive has invalid indices/position data");
      triangles += Math.floor(index.count / 3);
      primitives++;
    }
  }
  if (!primitives) throw Error("GLB has no mesh primitives");
  return {
    sizeBytes: buffer.length,
    triangles,
    primitives,
    meshes: meshes.length,
    materials: (data.materials || []).length,
    images: (data.images || []).length,
    requiredExtensions: data.extensionsRequired || []
  };
}

export function requireHeroQuality(result) {
  if (result.sizeBytes > 80 * 1024 * 1024)
    throw Error("Hero tree exceeds 80 MiB. Optimize it first.");
  if (result.triangles > 600_000)
    throw Error("Hero tree exceeds the 600K triangle preview safety cap. Decimate/LOD first.");
  if (result.materials === 0 || result.images === 0)
    throw Error("No embedded PBR-compatible material textures. This is still proxy-quality art.");
  return true;
}
