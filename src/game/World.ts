import {
  Color3, GlowLayer, Matrix, Mesh, MeshBuilder, Quaternion, Scene, ShadowGenerator,
  StandardMaterial, TransformNode, Vector3, VertexBuffer, VertexData
} from "@babylonjs/core";
import { createLankaTheme } from "./LankaTheme";
import { packInstanceMatrices } from "./InstanceMatrices";
import { fbm, mulberry32, smoothstep } from "./Noise";
import type { TerrainBounds } from "./TerrainPaint";
import {
  createBarkTexture, createClothTexture, createFlowerTexture, createFrondTexture, createGrassTexture,
  createGroundAlbedo, createGroundDetailTexture, createGroundNormalMap, createLeafTexture, createPlankTexture, createRockTexture,
  createThatchTexture
} from "./ProceduralTextures";
import {
  createFernClumpMesh, createFlowerPatchMesh, createFoliageMaterial, createGrassTuftMesh, createLeafClusterMesh
} from "./Foliage";

/**
 * Forest village world. Terrain paint, foliage cards, timber houses and the
 * outer horizon are all generated locally, so the game has no external art
 * dependencies. Authored GLB modules can replace pieces later.
 */

export interface Interaction {
  id: string;
  label: string;
  message: string;
  position: Vector3;
}
export interface ForestVillage {
  isBlocked: (x: number, z: number) => boolean;
  nearestInteraction: (position: Vector3, maxDistance: number) => Interaction | null;
  setNight: (night: boolean) => void;
  addBlocker: (x: number, z: number, rx: number, rz: number) => void;
}

interface Blocker { x: number; z: number; rx: number; rz: number }

/** World-space extent of the detailed, playable terrain mesh. */
export const TERRAIN: TerrainBounds = { minX: -100, maxX: 100, minZ: -120, maxZ: 120 };

export function pathCenter(z: number) { return Math.sin(z * .033) * 2.4 + Math.sin(z * .083) * .65; }
export function groundHeight(x: number, z: number) {
  const hills = .30 * Math.sin(x * .035 + z * .021)
    + .20 * Math.cos(z * .045 - x * .02)
    + .12 * Math.sin(x * .073) * Math.cos(z * .06);
  const distance = Math.abs(x - pathCenter(z));
  const slope = Math.min(1, Math.max(0, (distance - 3.5) / 13));
  // The trail is slightly sunken, with softly raised banks either side.
  const groove = 1 - smoothstep(1.2, 5.4, distance);
  return hills * (.26 + slope * .74) + Math.min(5, Math.max(0, (Math.abs(x) - 35) * .075)) - groove * .3;
}

const HOUSES: Array<[number, number, number, boolean]> = [
  [-13.5, 12, 1.08, false], [13.2, 21, .98, true], [-14.5, 40, 1.15, true],
  [14.7, 55, 1.05, true], [-13.3, 74, .92, false], [14.2, 87, 1.09, false],
];

function color(hex: string) { return Color3.FromHexString(hex); }
function material(scene: Scene, name: string, hex: string, options: { emissive?: Color3; alpha?: number } = {}) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color(hex);
  m.specularColor = Color3.Black();
  if (options.emissive) m.emissiveColor = options.emissive;
  if (options.alpha !== undefined) m.alpha = options.alpha;
  return m;
}

interface BoxOptions { shadows?: ShadowGenerator; parts?: Mesh[]; parent?: TransformNode }
function box(
  scene: Scene, name: string, w: number, h: number, d: number, x: number, y: number, z: number,
  mat: StandardMaterial, options: BoxOptions = {}
) {
  const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  mesh.position.set(x, y, z);
  mesh.material = mat;
  mesh.receiveShadows = true;
  if (options.parent) mesh.parent = options.parent;
  if (options.shadows) options.shadows.addShadowCaster(mesh);
  options.parts?.push(mesh);
  return mesh;
}

/**
 * Triangular gable end: prism with its apex at +Y. Every face is wound so the
 * triangle's right-handed cross product matches the declared outward normal
 * (Babylon's front-face convention), so nothing is culled from outside.
 */
function gablePrism(scene: Scene, name: string, halfWidth: number, height: number, depth: number) {
  const hz = depth / 2;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const face = (verts: number[][], n: number[], faceUvs: number[][]) => {
    const base = positions.length / 3;
    verts.forEach((v, i) => { positions.push(...v); normals.push(...n); uvs.push(...faceUvs[i]); });
    const [p0, p1, p2] = verts;
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const outward = cx * n[0] + cy * n[1] + cz * n[2] > 0;
    const order = verts.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
    (outward ? order : order.slice().reverse()).forEach((i) => indices.push(base + i));
  };
  const A = [-halfWidth, 0], B = [halfWidth, 0], C = [0, height];
  face([[A[0], A[1], hz], [B[0], B[1], hz], [C[0], C[1], hz]], [0, 0, 1], [[0, 0], [1, 0], [.5, 1]]);
  face([[B[0], B[1], -hz], [A[0], A[1], -hz], [C[0], C[1], -hz]], [0, 0, -1], [[0, 0], [1, 0], [.5, 1]]);
  const len = Math.hypot(height, halfWidth);
  face([[A[0], A[1], -hz], [A[0], A[1], hz], [C[0], C[1], hz], [C[0], C[1], -hz]], [-height / len, halfWidth / len, 0],
    [[0, 0], [1, 0], [1, 1], [0, 1]]);
  face([[B[0], B[1], hz], [B[0], B[1], -hz], [C[0], C[1], -hz], [C[0], C[1], hz]], [height / len, halfWidth / len, 0],
    [[0, 0], [1, 0], [1, 1], [0, 1]]);
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = positions; data.normals = normals; data.uvs = uvs; data.indices = indices;
  data.applyToMesh(mesh);
  return mesh;
}

function instanceBatch(mesh: Mesh, matrices: Matrix[], colors?: number[]) {
  if (!matrices.length) { mesh.dispose(); return; }
  mesh.thinInstanceSetBuffer("matrix", packInstanceMatrices(matrices), 16, true);
  if (colors && colors.length === matrices.length * 4) {
    mesh.thinInstanceSetBuffer("color", new Float32Array(colors), 4, true);
  }
  mesh.thinInstanceRefreshBoundingInfo();
}

/**
 * Splits a big thin-instance batch into spatial chunks (one cloned mesh each)
 * so the GPU only draws chunks that are in view. One giant batch has a bounding
 * box covering the whole map, so it could never be frustum-culled.
 */
function chunkedBatch(
  source: Mesh, matrices: Matrix[], colors?: number[],
  options: { cell?: number; onChunk?: (mesh: Mesh) => void } = {}
) {
  const cell = options.cell ?? 48;
  const groups = new Map<string, number[]>();
  matrices.forEach((matrix, index) => {
    const t = matrix.getTranslation();
    const key = Math.floor(t.x / cell) + ":" + Math.floor(t.z / cell);
    const list = groups.get(key);
    if (list) list.push(index); else groups.set(key, [index]);
  });
  let n = 0;
  groups.forEach((indices) => {
    const mesh = source.clone(source.name + "-chunk-" + n++);
    mesh.isPickable = false;
    mesh.thinInstanceSetBuffer("matrix", packInstanceMatrices(indices.map((i) => matrices[i])), 16, true);
    if (colors && colors.length === matrices.length * 4) {
      const packed = new Float32Array(indices.length * 4);
      indices.forEach((src, k) => { for (let c = 0; c < 4; c++) packed[k * 4 + c] = colors[src * 4 + c]; });
      mesh.thinInstanceSetBuffer("color", packed, 4, true);
    }
    mesh.thinInstanceRefreshBoundingInfo();
    options.onChunk?.(mesh);
  });
  source.setEnabled(false);
}

/**
 * Coarse low-poly ground that extends the world to the horizon. It sits on
 * the same height field and hides underneath the detailed terrain, so the
 * playable area never ends in a visible edge.
 */
function createOuterGround(scene: Scene) {
  const size = 1200;
  const subdivisions = 60; // 20 m cells: the detailed terrain edge falls on grid lines.
  const mesh = MeshBuilder.CreateGround("outer-forest-ground", {
    width: size, height: size, subdivisions, updatable: true
  }, scene);
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const indices = mesh.getIndices();
  if (!positions || !indices) return mesh;
  const colors: number[] = [];
  const eps = .001;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    const inside = x > TERRAIN.minX - eps && x < TERRAIN.maxX + eps && z > TERRAIN.minZ - eps && z < TERRAIN.maxZ + eps;
    const onEdge = inside && (Math.abs(Math.abs(x) - TERRAIN.maxX) < eps || Math.abs(Math.abs(z) - TERRAIN.maxZ) < eps);
    const height = groundHeight(x, z);
    positions[i + 1] = inside && !onEdge ? height - 5 : height - .04;
    const t = fbm(x * .006, z * .006, 3, 21);
    colors.push(.12 + t * .1, .27 + t * .16, .15 + t * .08, 1);
  }
  mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
  const normals = new Float32Array(positions.length);
  VertexData.ComputeNormals(positions, indices, normals);
  mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  const outer = material(scene, "outer-forest", "#ffffff");
  mesh.material = outer;
  mesh.receiveShadows = false;
  mesh.isPickable = false;
  return mesh;
}

export function createForestVillage(scene: Scene, shadows: ShadowGenerator): ForestVillage {
  // Per-world RNG: the layout is identical on every launch and React remount.
  const random = mulberry32(20261113);
  const randomBetween = (min: number, max: number) => min + random() * (max - min);

  const blockers: Blocker[] = [];
  const interactions: Interaction[] = [];
  const glow = new GlowLayer("lantern-and-shrine-glow", scene, { mainTextureFixedSize: 256, blurKernelSize: 24 });
  glow.intensity = .5;

  // ---- Textures and materials ------------------------------------------
  const barkTexture = createBarkTexture(scene);
  barkTexture.uScale = 2; barkTexture.vScale = 3;
  const thatchTexture = createThatchTexture(scene);
  thatchTexture.uScale = 3; thatchTexture.vScale = 2;
  const plankTexture = createPlankTexture(scene);
  plankTexture.uScale = 1.6; plankTexture.vScale = 1.2;
  const rockTexture = createRockTexture(scene);

  const textured = (name: string, texture: Parameters<typeof createFoliageMaterial>[2], tint: string) => {
    const m = material(scene, name, tint);
    m.diffuseTexture = texture;
    return m;
  };
  const trunk = textured("ancient-bark", barkTexture, "#e2d2bd");
  const barkDark = textured("dark-bark", barkTexture, "#a8957f");
  const wood = textured("wood-planks", plankTexture, "#ffffff");
  const woodUpper = textured("wood-planks-upper", plankTexture, "#d7c3a6");
  const beams = material(scene, "timber-beams", "#40301f");
  const roof = textured("thatch-roof", thatchTexture, "#ffffff");
  const stone = textured("mossy-rock-light", rockTexture, "#ffffff");
  const stoneDark = textured("mossy-rock-dark", rockTexture, "#8aa090");
  const clothBlue = textured("blue-market-cloth", createClothTexture(scene, "cloth-blue", "#3f6f8c", "#e8e2cf"), "#ffffff");
  const clothCream = textured("cream-market-cloth", createClothTexture(scene, "cloth-cream", "#ddd2b4", "#8a4a38"), "#ffffff");
  clothBlue.backFaceCulling = false;
  clothCream.backFaceCulling = false;
  const gold = material(scene, "old-gold", "#ceb87e");
  const coreMaterial = material(scene, "canopy-core", "#4b7c37");
  const lantern = material(scene, "warm-lantern", "#fff2b6", { emissive: new Color3(1.5, 1.05, .5) });
  const shrineLight = material(scene, "ancient-arcane", "#72d6d3", { emissive: new Color3(.2, .7, .66) });
  const frondMaterial = createFoliageMaterial(scene, "fern-frond-mat", createFrondTexture(scene), "#ffffff", .38);
  const leafMaterial = createFoliageMaterial(scene, "leaf-cluster-mat", createLeafTexture(scene), "#ffffff", .4);
  const grassMaterial = createFoliageMaterial(scene, "grass-tuft-mat", createGrassTexture(scene), "#ffffff", .35);
  const flowerMaterial = createFoliageMaterial(scene, "flower-mat", createFlowerTexture(scene), "#ffffff", .4);

  // ---- Terrain ----------------------------------------------------------
  const width = TERRAIN.maxX - TERRAIN.minX;
  const depth = TERRAIN.maxZ - TERRAIN.minZ;
  const land = MeshBuilder.CreateGround("forest-terrain", { width, height: depth, subdivisions: 160, updatable: true }, scene);
  const positions = land.getVerticesData(VertexBuffer.PositionKind);
  const indices = land.getIndices();
  if (positions && indices) {
    const uvs: number[] = [];
    for (let index = 0; index < positions.length; index += 3) {
      const x = positions[index];
      const z = positions[index + 2];
      positions[index + 1] = groundHeight(x, z);
      uvs.push((x - TERRAIN.minX) / width, (z - TERRAIN.minZ) / depth);
    }
    land.updateVerticesData(VertexBuffer.PositionKind, positions);
    const normals = new Float32Array(positions.length);
    VertexData.ComputeNormals(positions, indices, normals);
    land.updateVerticesData(VertexBuffer.NormalKind, normals);
    land.setVerticesData(VertexBuffer.UVKind, uvs);
  }
  const groundMaterial = new StandardMaterial("forest-ground", scene);
  groundMaterial.diffuseTexture = createGroundAlbedo(scene, TERRAIN, pathCenter);
  const groundNormal = createGroundNormalMap(scene);
  groundNormal.uScale = 70; groundNormal.vScale = 84;
  groundNormal.level = .6;
  groundMaterial.bumpTexture = groundNormal;
  const groundDetail = createGroundDetailTexture(scene);
  groundDetail.uScale = 160; groundDetail.vScale = 190;
  if (groundMaterial.detailMap) {
    groundMaterial.detailMap.texture = groundDetail;
    groundMaterial.detailMap.isEnabled = true;
    groundMaterial.detailMap.diffuseBlendLevel = .55;
    groundMaterial.detailMap.bumpLevel = .8;
  }
  groundMaterial.specularColor = Color3.Black();
  land.material = groundMaterial;
  land.receiveShadows = true;
  land.isPickable = false;
  createOuterGround(scene);

  // ---- Rocks ------------------------------------------------------------
  const rockTransforms: Matrix[][] = [[], []];
  function stoneAt(x: number, z: number, size: number) {
    const y = groundHeight(x, z);
    const kind = random() > .45 ? 0 : 1;
    rockTransforms[kind].push(Matrix.Compose(
      new Vector3(size * 1.3, size * .65, size * 1.1),
      Quaternion.FromEulerAngles(random() * .32, random() * Math.PI, random() * .24),
      new Vector3(x, y + size * .24, z)
    ));
  }

  // ---- Trees: instanced trunks + shadow-casting cores + leaf-card crowns --
  const trunkTransforms: Matrix[][] = [[], []];
  const coreTransforms: Matrix[] = [];
  const wallCoreTransforms: Matrix[] = [];
  const clusterTransforms: Matrix[] = [];
  const clusterColors: number[] = [];
  const pushCluster = (scale: Vector3, position: Vector3, shade = 1) => {
    clusterTransforms.push(Matrix.Compose(scale, Quaternion.FromEulerAngles(random() * .5, random() * Math.PI * 2, random() * .5), position));
    clusterColors.push(
      (.98 + random() * .3) * shade, (1.02 + random() * .2) * shade, (.86 + random() * .24) * shade, 1
    );
  };

  function treeAt(x: number, z: number, scaleFactor = 1, ancient = false, detail = 1) {
    const y = groundHeight(x, z);
    const height = (ancient ? randomBetween(11, 16) : randomBetween(6.5, 10.5)) * scaleFactor;
    const trunkWidth = (ancient ? 1.9 : .9) * scaleFactor;
    trunkTransforms[ancient ? 1 : 0].push(Matrix.Compose(
      new Vector3(trunkWidth, height, trunkWidth),
      Quaternion.FromEulerAngles(0, 0, randomBetween(-.09, .09)),
      new Vector3(x, y + height * .46, z)
    ));
    const crowns = ancient ? 7 : 4;
    for (let i = 0; i < crowns; i++) {
      const offsetX = randomBetween(-2.2, 2.2) * scaleFactor;
      const offsetZ = randomBetween(-1.9, 1.9) * scaleFactor;
      const radius = randomBetween(2.2, 3.45) * scaleFactor * (ancient ? 1.22 : 1);
      const cx = x + offsetX;
      const cy = y + height * randomBetween(.70, 1.00);
      const cz = z + offsetZ;
      (detail > 0 ? coreTransforms : wallCoreTransforms).push(Matrix.Compose(
        new Vector3(radius * .7, radius * .55, radius * .7),
        Quaternion.FromEulerAngles(0, random() * Math.PI * 2, 0),
        new Vector3(cx, cy, cz)
      ));
      const clusters = detail > 0 ? 3 : 1;
      for (let k = 0; k < clusters; k++) {
        const spread = radius * .5;
        pushCluster(
          new Vector3(radius * randomBetween(1.5, 2.1), radius * randomBetween(1.25, 1.7), radius * randomBetween(1.5, 2.1)),
          new Vector3(cx + randomBetween(-spread, spread), cy + randomBetween(-spread * .6, spread * .5), cz + randomBetween(-spread, spread)),
          1 - k * .04
        );
      }
    }
    if (ancient) {
      for (let j = 0; j < 4; j++) {
        const angle = j * Math.PI / 2 + random();
        const root = MeshBuilder.CreateCylinder("tree-root", { height: 3.4 * scaleFactor, diameterTop: .10, diameterBottom: .6 * scaleFactor, tessellation: 6 }, scene);
        root.position.set(x + Math.sin(angle) * 1.3 * scaleFactor, y + .6 * scaleFactor, z + Math.cos(angle) * 1.3 * scaleFactor);
        root.rotation.z = Math.cos(angle) * .93;
        root.rotation.x = Math.sin(angle) * .93;
        root.material = barkDark;
        root.isPickable = false;
      }
    }
  }

  for (let i = 0; i < 116; i++) {
    let x = randomBetween(-93, 93);
    let z = randomBetween(-104, 105);
    if (Math.abs(x - pathCenter(z)) < 9 || (Math.abs(x) < 20 && z > 6 && z < 96)) {
      x = (random() > .5 ? 1 : -1) * randomBetween(23, 91);
    }
    treeAt(x, z, randomBetween(.7, 1.32), random() < .10);
  }
  [
    [-24, -17, 1.45], [24, 5, 1.5], [-26, 45, 1.6], [26, 65, 1.65],
    [-21, 98, 1.7], [22, -55, 1.4], [-20, -77, 1.75]
  ].forEach(([x, z, s]) => treeAt(x, z, s, true));
  // A dense tree wall beyond the playable bounds hides the world's edge.
  for (let i = 0; i < 150; i++) {
    const alongX = random() < .5;
    const outward = randomBetween(2, 46);
    const x = alongX ? (random() < .5 ? -1 : 1) * (TERRAIN.maxX - 4 + outward) : randomBetween(-150, 150);
    const z = alongX ? randomBetween(-165, 165) : (random() < .5 ? -1 : 1) * (TERRAIN.maxZ - 6 + outward);
    treeAt(x, z, randomBetween(1, 1.7), random() < .12, 0);
  }

  trunkTransforms.forEach((transforms, i) => {
    const source = MeshBuilder.CreateCylinder("trunk-batch-" + i, {
      height: 1, diameterTop: .58, diameterBottom: 1.5, tessellation: 8
    }, scene);
    source.material = i === 1 ? barkDark : trunk;
    source.receiveShadows = true;
    shadows.addShadowCaster(source);
    instanceBatch(source, transforms);
  });
  const coreSource = MeshBuilder.CreateIcoSphere("canopy-core-batch", { radius: 1, subdivisions: 1 }, scene);
  coreSource.material = coreMaterial;
  coreSource.receiveShadows = true;
  const wallCoreSource = coreSource.clone("canopy-core-wall");
  chunkedBatch(coreSource, coreTransforms, undefined, { onChunk: (mesh) => shadows.addShadowCaster(mesh) });
  chunkedBatch(wallCoreSource, wallCoreTransforms);

  // ---- Understory: ferns, bushes, grass and wildflowers -----------------
  const nearHouse = (x: number, z: number) =>
    HOUSES.some(([hx, hz, hs]) => Math.abs(x - hx) < 5.6 * hs && Math.abs(z - hz) < 5.4 * hs);

  const fernSource = createFernClumpMesh(scene, random);
  fernSource.material = frondMaterial;
  fernSource.receiveShadows = true;
  const fernTransforms: Matrix[] = [];
  const fernColors: number[] = [];
  for (let i = 0; i < 560; i++) {
    const z = randomBetween(-100, 106);
    const nearTrail = random() < .65;
    const side = random() > .5 ? 1 : -1;
    const x = nearTrail ? pathCenter(z) + side * randomBetween(3.3, 15) : randomBetween(-92, 92);
    if (Math.abs(x - pathCenter(z)) < 3 || nearHouse(x, z)) continue;
    const size = nearTrail ? randomBetween(.9, 1.9) : randomBetween(.7, 1.5);
    fernTransforms.push(Matrix.Compose(
      new Vector3(size, size * randomBetween(.85, 1.2), size),
      Quaternion.FromEulerAngles(0, random() * Math.PI * 2, 0),
      new Vector3(x, groundHeight(x, z) - .02, z)
    ));
    fernColors.push(.95 + random() * .3, 1.02 + random() * .2, .86 + random() * .24, 1);
  }
  chunkedBatch(fernSource, fernTransforms, fernColors);

  for (let i = 0; i < 170; i++) {
    const x = randomBetween(-88, 88);
    const z = randomBetween(-100, 103);
    if (Math.abs(x - pathCenter(z)) < 4.6 || nearHouse(x, z)) continue;
    const radius = randomBetween(.55, 1.2);
    pushCluster(
      new Vector3(radius * 1.5, radius * 1.05, radius * 1.4),
      new Vector3(x, groundHeight(x, z) + radius * .45, z),
      .95
    );
  }

  const clusterSource = createLeafClusterMesh(scene, random);
  clusterSource.material = leafMaterial;
  clusterSource.receiveShadows = true;
  // House vines are appended to the same batch later, so the batch is finalised after the houses.

  const tuftSource = createGrassTuftMesh(scene);
  tuftSource.material = grassMaterial;
  tuftSource.receiveShadows = true;
  const tuftTransforms: Matrix[] = [];
  const tuftColors: number[] = [];
  for (let i = 0; i < 7000 && tuftTransforms.length < 3800; i++) {
    const z = randomBetween(-102, 106);
    const nearTrail = random() < .7;
    const x = nearTrail ? pathCenter(z) + (random() > .5 ? 1 : -1) * randomBetween(2.4, 30) : randomBetween(-92, 92);
    if (Math.abs(x - pathCenter(z)) < 2.4 || nearHouse(x, z)) continue;
    const size = randomBetween(.9, 2.0);
    tuftTransforms.push(Matrix.Compose(
      new Vector3(size, size * randomBetween(.8, 1.5), size),
      Quaternion.FromEulerAngles(0, random() * Math.PI * 2, 0),
      new Vector3(x, groundHeight(x, z) - .02, z)
    ));
    tuftColors.push(.98 + random() * .3, 1.05 + random() * .2, .86 + random() * .24, 1);
  }
  chunkedBatch(tuftSource, tuftTransforms, tuftColors);

  const flowerSource = createFlowerPatchMesh(scene);
  flowerSource.material = flowerMaterial;
  const flowerTransforms: Matrix[] = [];
  for (let i = 0; i < 380; i++) {
    const z = randomBetween(-92, 102);
    const x = pathCenter(z) + (random() > .5 ? 1 : -1) * randomBetween(3.2, 16);
    if (nearHouse(x, z)) continue;
    const size = randomBetween(.7, 1.5);
    flowerTransforms.push(Matrix.Compose(
      new Vector3(size, size, size),
      Quaternion.FromEulerAngles(0, random() * Math.PI * 2, 0),
      new Vector3(x, groundHeight(x, z), z)
    ));
  }
  chunkedBatch(flowerSource, flowerTransforms);

  // ---- Houses -----------------------------------------------------------
  const accentVines: Array<{ at: Vector3; scale: number }> = [];

  function createHouse(x: number, z: number, s: number, awning: boolean) {
    const y = groundHeight(x, z);
    const root = new TransformNode("house-root", scene);
    root.position.set(x, y, z);
    // Local +Z is the front: turn the house to face the trail.
    root.lookAt(new Vector3(pathCenter(z), y, z));
    root.computeWorldMatrix(true);
    const parts: Mesh[] = [];
    const b = (name: string, w: number, h: number, d: number, px: number, py: number, pz: number, mat: StandardMaterial) =>
      box(scene, name, w * s, h * s, d * s, px * s, py * s, pz * s, mat, { parent: root, parts });

    b("stone-foundation", 7.0, .7, 6.5, 0, .35, 0, stoneDark);
    b("lower-wall", 6.4, 2.5, 5.9, 0, 1.95, 0, wood);
    for (const dx of [-3.2, 3.2]) for (const dz of [-2.95, 2.95]) b("corner-pillar", .3, 2.7, .3, dx, 2.05, dz, beams);
    b("floor-beam", 7.3, .26, 6.7, 0, 3.35, 0, beams);
    b("upper-wall", 7.0, 2.3, 6.4, 0, 4.62, 0, woodUpper);
    for (const dx of [-3.5, 3.5]) for (const dz of [-3.2, 3.2]) b("upper-pillar", .28, 2.4, .28, dx, 4.6, dz, beams);
    b("eave-beam", 7.4, .22, 6.8, 0, 5.85, 0, beams);

    // Front door and windows (+Z).
    b("door-frame", 1.9, .2, .24, 0, 3.05, 3.0, beams);
    b("arched-door", 1.5, 2.3, .16, 0, 1.85, 2.98, beams);
    for (const dx of [-2.0, 2.0]) {
      b("window-opening", 1.1, 1.0, .12, dx, 2.2, 2.99, beams);
      b("window-glow", .78, .7, .13, dx, 2.2, 3.04, lantern);
      b("window-bar", .07, .96, .16, dx, 2.2, 3.1, beams);
    }
    for (const dx of [-2.1, 0, 2.1]) {
      b("window-opening", 1.0, 1.0, .12, dx, 4.75, 3.2, beams);
      b("window-glow", .72, .7, .13, dx, 4.75, 3.25, lantern);
      b("window-bar", .07, .96, .16, dx, 4.75, 3.31, beams);
    }

    // Raised balcony on stilts across the front of the upper floor.
    b("balcony-floor", 4.6, .16, 1.5, 0, 3.55, 3.95, beams);
    for (const dx of [-2.2, 2.2]) {
      b("balcony-stilt", .22, 3.5, .22, dx, 1.75, 4.6, beams);
      b("balcony-rail-post", .12, .95, .12, dx, 4.1, 4.62, beams);
    }
    b("balcony-rail", 4.6, .1, .1, 0, 4.55, 4.62, beams);
    for (let i = 0; i < 3; i++) b("porch-step", 2.2, .14, .45, 0, .2 + i * .1, 3.35 + i * .45, stoneDark);

    // Roof: two thatched slabs with deep eaves, ridge cap and gable ends.
    const tilt = .52;
    const roofL = b("thatch-roof-left", 4.73, .3, 7.6, -2.05, 6.88, 0, roof);
    const roofR = b("thatch-roof-right", 4.73, .3, 7.6, 2.05, 6.88, 0, roof);
    roofL.rotation.z = tilt;
    roofR.rotation.z = -tilt;
    b("ridge-cap", .4, .3, 7.8, 0, 8.05, 0, beams);
    for (const dz of [-3.2, 3.2]) {
      const gable = gablePrism(scene, "gable-end", 3.55 * s, 2.03 * s, .3 * s);
      gable.material = wood;
      gable.receiveShadows = true;
      gable.parent = root;
      gable.position.set(0, 5.96 * s, dz * s);
      parts.push(gable);
    }

    // Cloth banners, door awning and hanging lanterns.
    for (const dx of [-3.0, 3.0]) b("hanging-banner", .95, 2.2, .05, dx, 2.3, 3.45, dx < 0 ? clothBlue : clothCream);
    if (awning) {
      const awn = b("door-awning", 2.8, .1, 1.5, 0, 3.15, 3.7, clothBlue);
      awn.rotation.x = .28;
    }
    for (const dx of [-1.3, 1.3]) {
      b("lantern-cord", .04, .4, .04, dx, 3.0, 3.25, beams);
      b("hanging-lantern", .3, .42, .3, dx, 2.7, 3.25, lantern);
    }

    // Houses face the trail, so their depth (incl. balcony stilts) runs along world X.
    blockers.push({ x, z, rx: 5.1 * s, rz: 3.9 * s });

    const world = root.getWorldMatrix();
    for (const [lx, ly, lz, sc] of [
      [-3.9, 5.7, 2.4, .8], [3.9, 5.7, -1.2, .8], [-3.9, 5.6, -2.6, .7], [3.9, 5.6, 2.8, .75],
      [-2.4, 3.1, 3.45, .5], [2.4, 3.1, 3.45, .5], [0, 7.9, 3.3, .6], [0, 7.9, -3.3, .6]
    ]) {
      accentVines.push({ at: Vector3.TransformCoordinates(new Vector3(lx * s, ly * s, lz * s), world), scale: sc * s });
    }

    const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
    if (merged) {
      merged.name = "timber-house";
      merged.receiveShadows = true;
      merged.isPickable = false;
      shadows.addShadowCaster(merged);
    }
    root.dispose();
  }
  HOUSES.forEach(([x, z, s, awning]) => createHouse(x, z, s, awning));

  for (const vine of accentVines) {
    pushCluster(new Vector3(vine.scale * 1.7, vine.scale * 1.4, vine.scale * 1.7), vine.at, .9);
  }
  chunkedBatch(clusterSource, clusterTransforms, clusterColors);

  // ---- Market props -----------------------------------------------------
  function barrel(x: number, z: number) {
    const y = groundHeight(x, z);
    const b = MeshBuilder.CreateCylinder("market-barrel", { height: 1.13, diameter: .8, tessellation: 12 }, scene);
    b.position.set(x, y + .58, z);
    b.material = wood;
    b.receiveShadows = true;
    shadows.addShadowCaster(b);
    box(scene, "barrel-band", .86, .10, .86, x, y + .25, z, beams);
  }
  for (const [x, z] of [[-7, 13], [-6, 15], [6, 22], [9, 51], [-9, 42], [7, 88], [-7, 74]]) {
    barrel(x, z);
    stoneAt(x + 1.7, z + 1.4, randomBetween(.3, .9));
  }
  for (let i = 0; i < 145; i++) {
    const z = randomBetween(-96, 104);
    const x = pathCenter(z) + (random() > .5 ? 1 : -1) * randomBetween(4.1, 7.8);
    stoneAt(x, z, randomBetween(.14, .65));
  }
  rockTransforms.forEach((transforms, i) => {
    const rock = MeshBuilder.CreateIcoSphere("forest-rocks-instanced-" + i, { radius: 1, subdivisions: 1 }, scene);
    rock.material = i === 0 ? stone : stoneDark;
    rock.receiveShadows = true;
    shadows.addShadowCaster(rock);
    instanceBatch(rock, transforms);
  });

  function lightPost(x: number, z: number) {
    const y = groundHeight(x, z);
    box(scene, "lantern-post", .15, 3.7, .15, x, y + 1.85, z, beams, { shadows });
    box(scene, "lantern-arm", 1.12, .13, .14, x + .48, y + 3.48, z, beams);
    box(scene, "lantern-frame", .50, .64, .50, x + .94, y + 3.02, z, gold);
    const bulb = box(scene, "lantern-core", .34, .47, .35, x + .94, y + 3.02, z, lantern);
    glow.addIncludedOnlyMesh(bulb);
  }
  for (const z of [-35, -12, 12, 35, 62, 83]) lightPost(pathCenter(z) + 5.6, z);

  // ---- Shrine landmark --------------------------------------------------
  const altarZ = 101;
  const altarX = pathCenter(altarZ);
  const altarY = groundHeight(altarX, altarZ);
  for (let i = 0; i < 4; i++) {
    const step = MeshBuilder.CreateCylinder("shrine-stair", { height: .32, diameter: (8 - i * 1.15), tessellation: 10 }, scene);
    step.position.set(altarX, altarY + i * .31, altarZ);
    step.material = i % 2 ? stone : stoneDark;
    step.receiveShadows = true;
  }
  const shrine = MeshBuilder.CreateCylinder("shrine-monolith", { height: 4.1, diameterTop: 1.06, diameterBottom: 1.7, tessellation: 7 }, scene);
  shrine.position.set(altarX, altarY + 3, altarZ);
  shrine.material = stone;
  shadows.addShadowCaster(shrine);
  const crystal = MeshBuilder.CreatePolyhedron("shrine-crystal", { type: 1, size: 1.0 }, scene);
  crystal.position.set(altarX, altarY + 5.5, altarZ);
  crystal.material = shrineLight;
  glow.addIncludedOnlyMesh(crystal);
  const ring = MeshBuilder.CreateTorus("shrine-energy-ring", { diameter: 4.5, thickness: .11, tessellation: 64 }, scene);
  ring.position.set(altarX, altarY + 4.1, altarZ);
  ring.rotation.x = Math.PI / 2;
  ring.material = shrineLight;
  glow.addIncludedOnlyMesh(ring);
  interactions.push({
    id: "shrine", label: "Ancient shrine",
    message: "The ancient shrine has awakened",
    position: new Vector3(altarX, altarY + .5, altarZ)
  });

  function noticeBoard(x: number, z: number) {
    const y = groundHeight(x, z);
    for (const dx of [-.9, .9]) box(scene, "signpost", .15, 2.9, .16, x + dx, y + 1.47, z, beams, { shadows });
    box(scene, "village-sign", 2.4, 1.08, .18, x, y + 2.35, z, wood, { shadows });
    box(scene, "village-sign-top", 2.7, .13, .24, x, y + 2.92, z, roof);
  }
  noticeBoard(5.7, -23);
  interactions.push({
    id: "notice", label: "Village notice board",
    message: "The village welcomes all wanderers",
    position: new Vector3(5.7, groundHeight(5.7, -23), -23)
  });
  noticeBoard(-5.6, 49);
  interactions.push({
    id: "trail", label: "Trail marker",
    message: "The old trail leads to the Elder Grove",
    position: new Vector3(-5.6, groundHeight(-5.6, 49), 49)
  });

  // The separately authored theme is completely modular: scenery, location
  // interactions and broad-phase blockers are added without changing the player.
  const lankaTheme = createLankaTheme(scene, shadows, groundHeight);
  blockers.push(...lankaTheme.blockers);
  interactions.push(...lankaTheme.interactions);

  let isNight = false;
  return {
    addBlocker(x, z, rx, rz) { blockers.push({ x, z, rx, rz }); },
    isBlocked(x, z) {
      return blockers.some((b) => Math.abs(x - b.x) < b.rx + .35 && Math.abs(z - b.z) < b.rz + .35);
    },
    nearestInteraction(position, maxDistance) {
      let nearest: Interaction | null = null;
      let best = maxDistance * maxDistance;
      for (const item of interactions) {
        const dx = position.x - item.position.x;
        const dz = position.z - item.position.z;
        const distance = dx * dx + dz * dz;
        if (distance < best) { best = distance; nearest = item; }
      }
      return nearest;
    },
    setNight(night) {
      if (isNight === night) return;
      isNight = night;
      // HDR emissive values: warm windows and lanterns bloom after dusk.
      lantern.emissiveColor = night ? new Color3(2.6, 1.8, .85) : new Color3(1.5, 1.05, .5);
      shrineLight.emissiveColor = night ? new Color3(.35, 1.2, .95) : new Color3(.2, .7, .66);
      glow.intensity = night ? .9 : .5;
      lankaTheme.setNight(night);
    },
  };
}
