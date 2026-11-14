import {
  Color3, Material, Mesh, StandardMaterial, VertexData,
  type BaseTexture, type Scene
} from "@babylonjs/core";

/**
 * Card-based foliage. Real vegetation in games is built from alpha-tested
 * leaf cards rather than solid blobs; these builders create that geometry
 * procedurally so it can be thin-instanced hundreds of times cheaply.
 */

interface MeshArrays { positions: number[]; normals: number[]; uvs: number[]; indices: number[] }

const emptyArrays = (): MeshArrays => ({ positions: [], normals: [], uvs: [], indices: [] });

function toMesh(scene: Scene, name: string, a: MeshArrays): Mesh {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = a.positions;
  data.normals = a.normals;
  data.uvs = a.uvs;
  data.indices = a.indices;
  data.applyToMesh(mesh);
  mesh.isPickable = false;
  return mesh;
}

function normalise(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

/** Alpha-tested, double-sided, matte material for a leaf-card texture. */
export function createFoliageMaterial(
  scene: Scene, name: string, texture: BaseTexture, tint = "#ffffff", cutoff = .42
): StandardMaterial {
  texture.hasAlpha = true;
  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.transparencyMode = Material.MATERIAL_ALPHATEST;
  material.alphaCutOff = cutoff;
  material.backFaceCulling = false;
  material.twoSidedLighting = true;
  material.diffuseColor = Color3.FromHexString(tint);
  material.specularColor = Color3.Black();
  return material;
}

/**
 * A clump of arching fern fronds radiating from a point. One mesh, many
 * instances: the large foreground ferns in the reference are the main
 * contributor to its lush, layered look.
 */
export function createFernClumpMesh(scene: Scene, random: () => number): Mesh {
  const a = emptyArrays();
  const fronds = 9;
  const segments = 5;
  for (let f = 0; f < fronds; f++) {
    const yaw = (f / fronds) * Math.PI * 2 + (random() - .5) * .5;
    const length = .95 + random() * .55;
    const halfWidth = length * .24;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const base = a.positions.length / 3;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const forward = length * t;
      const up = length * (.9 * t - 1.05 * t * t) + .12;
      const sideX = cosY * halfWidth;
      const sideZ = -sinY * halfWidth;
      const cx = sinY * forward;
      const cz = cosY * forward;
      a.positions.push(cx - sideX, up, cz - sideZ, cx + sideX, up, cz + sideZ);
      // Mostly-up normals give soft, even foliage lighting.
      const [nx, ny, nz] = normalise(sinY * .35 * (1 - t), 1, cosY * .35 * (1 - t));
      a.normals.push(nx, ny, nz, nx, ny, nz);
      a.uvs.push(0, t, 1, t);
    }
    for (let s = 0; s < segments; s++) {
      const i = base + s * 2;
      a.indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  return toMesh(scene, "fern-clump", a);
}

/** Three crossed cards bearing a grass-blade texture. */
export function createGrassTuftMesh(scene: Scene): Mesh {
  const a = emptyArrays();
  const width = .62;
  const height = .62;
  for (let c = 0; c < 3; c++) {
    const yaw = (c / 3) * Math.PI;
    const dx = Math.cos(yaw) * width / 2;
    const dz = Math.sin(yaw) * width / 2;
    const base = a.positions.length / 3;
    a.positions.push(-dx, 0, -dz, dx, 0, dz, -dx * .8 + .04, height, -dz * .8, dx * .8 + .04, height, dz * .8);
    for (let k = 0; k < 4; k++) a.normals.push(0, 1, 0);
    a.uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
    a.indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  return toMesh(scene, "grass-tuft", a);
}

/**
 * A rounded cluster of leaf cards. Each card's normal points away from the
 * cluster centre, so a handful of flat quads shade like a soft, volumetric
 * clump of leaves instead of a hard-edged blob.
 */
export function createLeafClusterMesh(scene: Scene, random: () => number): Mesh {
  const a = emptyArrays();
  const cards = 22;
  const half = .46;
  for (let c = 0; c < cards; c++) {
    // Bias card centres toward the shell of the sphere.
    let px = random() - .5, py = random() - .35, pz = random() - .5;
    const [dx, dy, dz] = normalise(px, py, pz);
    const radius = .3 + random() * .32;
    px = dx * radius; py = dy * radius; pz = dz * radius;
    const [nx, ny, nz] = normalise(dx + (random() - .5) * .4, dy + .15, dz + (random() - .5) * .4);
    // Build two tangent vectors perpendicular to the normal.
    const helper: [number, number, number] = Math.abs(ny) > .9 ? [1, 0, 0] : [0, 1, 0];
    let t1x = ny * helper[2] - nz * helper[1];
    let t1y = nz * helper[0] - nx * helper[2];
    let t1z = nx * helper[1] - ny * helper[0];
    [t1x, t1y, t1z] = normalise(t1x, t1y, t1z);
    const t2x = ny * t1z - nz * t1y;
    const t2y = nz * t1x - nx * t1z;
    const t2z = nx * t1y - ny * t1x;
    const spin = random() * Math.PI * 2;
    const cs = Math.cos(spin) * half;
    const sn = Math.sin(spin) * half;
    const ax = t1x * cs + t2x * sn, ay = t1y * cs + t2y * sn, az = t1z * cs + t2z * sn;
    const bx = -t1x * sn + t2x * cs, by = -t1y * sn + t2y * cs, bz = -t1z * sn + t2z * cs;
    const base = a.positions.length / 3;
    a.positions.push(
      px - ax - bx, py - ay - by, pz - az - bz,
      px + ax - bx, py + ay - by, pz + az - bz,
      px - ax + bx, py - ay + by, pz - az + bz,
      px + ax + bx, py + ay + by, pz + az + bz
    );
    // Blend outward and upward normals for smooth volumetric lighting.
    const [sx, sy, sz] = normalise(dx * .8, dy * .8 + .45, dz * .8);
    for (let k = 0; k < 4; k++) a.normals.push(sx, sy, sz);
    a.uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
    a.indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  return toMesh(scene, "leaf-cluster", a);
}

/** Three crossed cards bearing a wildflower texture. */
export function createFlowerPatchMesh(scene: Scene): Mesh {
  const a = emptyArrays();
  const size = .6;
  for (let c = 0; c < 2; c++) {
    const yaw = (c / 2) * Math.PI + .4;
    const dx = Math.cos(yaw) * size / 2;
    const dz = Math.sin(yaw) * size / 2;
    const base = a.positions.length / 3;
    a.positions.push(-dx, 0, -dz, dx, 0, dz, -dx, size, -dz, dx, size, dz);
    for (let k = 0; k < 4; k++) a.normals.push(0, 1, 0);
    a.uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
    a.indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  return toMesh(scene, "flower-patch", a);
}
