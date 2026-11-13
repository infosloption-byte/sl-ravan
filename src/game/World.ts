import {
  Color3, DynamicTexture, GlowLayer, Matrix, MeshBuilder, Quaternion,
  Scene, ShadowGenerator, StandardMaterial, Vector3,
  VertexBuffer, VertexData
} from "@babylonjs/core";
import { createLankaTheme } from "./LankaTheme";
import { packInstanceMatrices } from "./InstanceMatrices";
import { createForestSurfaceMaterial } from "./ForestSurface";

/**
 * First environment concept: a dense, sunlit forest village.
 * All geometry and textures are locally generated so the sample has no
 * external art dependencies. Replacements can use glTF/GLB assets later.
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
}

type RGB = [number, number, number];
interface Blocker { x: number; z: number; rx: number; rz: number }

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(20261113);
function randomBetween(min: number, max: number) { return min + random() * (max - min); }
function pathCenter(z: number) { return Math.sin(z * .033) * 2.4 + Math.sin(z * .083) * .65; }
export function groundHeight(x: number, z: number) {
  const hills = .30 * Math.sin(x * .035 + z * .021)
    + .20 * Math.cos(z * .045 - x * .02)
    + .12 * Math.sin(x * .073) * Math.cos(z * .06);
  const distance = Math.abs(x - pathCenter(z));
  const slope = Math.min(1, Math.max(0, (distance - 3.5) / 13));
  return hills * (.26 + slope * .74) + Math.min(5, Math.max(0, (Math.abs(x) - 35) * .075));
}

function color(hex: string) { return Color3.FromHexString(hex); }
function material(scene: Scene, name: string, hex: string, options: { emissive?: string; alpha?: number; rough?: boolean } = {}) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color(hex);
  m.specularColor = options.rough === false ? new Color3(.18, .17, .15) : Color3.Black();
  if (options.emissive) m.emissiveColor = color(options.emissive);
  if (options.alpha !== undefined) m.alpha = options.alpha;
  return m;
}
function box(scene: Scene, name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: StandardMaterial, shadows?: ShadowGenerator) {
  const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  mesh.position.set(x, y, z);
  mesh.material = mat;
  if (shadows) shadows.addShadowCaster(mesh);
  mesh.receiveShadows = true;
  return mesh;
}

export function createForestVillage(scene: Scene, shadows: ShadowGenerator): ForestVillage {
  const blockers: Blocker[] = [];
  const interactions: Interaction[] = [];
  const glow = new GlowLayer("lantern-and-shrine-glow", scene);
  glow.intensity = .58;

  const earth = material(scene, "earth", "#a8a774");
  const trunk = material(scene, "ancient-bark", "#614b35");
  const barkDark = material(scene, "dark-bark", "#453e30");
  const wood = material(scene, "wood", "#85664a");
  const beams = material(scene, "timber-beams", "#4a372b");
  const roof = material(scene, "mossy-thatch", "#6c7250");
  const roofLight = material(scene, "roof-thatch-highlights", "#a18a5c");
  const stone = material(scene, "stone", "#777d75");
  const stoneDark = material(scene, "mossy-stone", "#54645b");
  const flag = material(scene, "blue-market-cloth", "#4b768d");
  const gold = material(scene, "old-gold", "#ceb87e");
  const leafMaterials = ["#4c7c43", "#65954d", "#2b653f", "#81a556", "#437b58", "#9cb76f"]
    .map((hex, i) => material(scene, "leaf-" + i, hex));
  const bushMats = ["#306c44", "#43854a", "#608b43", "#759b53"]
    .map((hex, i) => material(scene, "understory-" + i, hex));
  const canopyTransforms: Matrix[][] = leafMaterials.map(() => []);
  const trunkTransforms: Matrix[][] = [[], []];
  const rockTransforms: Matrix[][] = [[], []];
  const lantern = material(scene, "warm-lantern", "#fff2b6", { emissive: "#eebc69" });
  const shrineLight = material(scene, "ancient-arcane", "#72d6d3", { emissive: "#2fb6ae" });
  const cloth = material(scene, "ribbon-fabric", "#a6c7b2", { alpha: .9 });

  // Terrain with a naturally winding earthen path painted directly in the mesh.
  const land = MeshBuilder.CreateGround("forest-terrain", {
    width: 200, height: 230, subdivisions: 136, updatable: true
  }, scene);
  const positions = land.getVerticesData(VertexBuffer.PositionKind);
  const indices = land.getIndices();
  if (positions && indices) {
    const colors: number[] = [];
    for (let index = 0; index < positions.length; index += 3) {
      const x = positions[index];
      const z = positions[index + 2];
      positions[index + 1] = groundHeight(x, z);
      const d = Math.abs(x - pathCenter(z) + Math.sin(z * .51) * .38);
      const jagged = Math.sin(x * 1.8 + z * .4) * .27 + Math.sin(z * 2.3) * .16;
      let rgb: RGB;
      const variation = Math.sin(x * .33 + z * .26) * .055 + Math.cos(x * .71 - z * .28) * .035;
      if (d < 2.8 + jagged) rgb = [.45, .34, .24];
      else if (d < 4.7 + jagged) rgb = [.37, .44, .26];
      else if (Math.abs(x) > 50) rgb = [.26, .38, .27];
      else rgb = [.31, .49, .29];
      colors.push(Math.max(.06, rgb[0] + variation), Math.max(.06, rgb[1] + variation), Math.max(.06, rgb[2] + variation), 1);
    }
    land.updateVerticesData(VertexBuffer.PositionKind, positions);
    const normals = new Float32Array(positions.length);
    VertexData.ComputeNormals(positions, indices, normals);
    land.updateVerticesData(VertexBuffer.NormalKind, normals);
    land.setVerticesData(VertexBuffer.ColorKind, colors);
  }
  const groundMat = createForestSurfaceMaterial(scene);
  land.material = groundMat;
  land.receiveShadows = true;

  function stoneAt(x: number, z: number, size: number) {
    const y = groundHeight(x, z);
    const kind = random() > .45 ? 0 : 1;
    rockTransforms[kind].push(Matrix.Compose(
      new Vector3(size * 1.3, size * .65, size * 1.1),
      Quaternion.FromEulerAngles(random() * .32, random() * Math.PI, random() * .24),
      new Vector3(x, y + size * .24, z)
    ));
  }

  // The large tree silhouettes are deliberate: the reference is all about
  // canopy depth, foliage silhouettes and diffuse sunlit green layers.
  function treeAt(x: number, z: number, scale = 1, ancient = false) {
    const y = groundHeight(x, z);
    const height = (ancient ? randomBetween(11, 16) : randomBetween(6.5, 10.5)) * scale;
    const width = (ancient ? 1.9 : .9) * scale;
    trunkTransforms[ancient ? 1 : 0].push(Matrix.Compose(
      new Vector3(width, height, width),
      Quaternion.FromEulerAngles(0, 0, randomBetween(-.09, .09)),
      new Vector3(x, y + height * .46, z)
    ));

    const crowns = ancient ? 7 : 4;
    for (let i = 0; i < crowns; i++) {
      const offsetX = randomBetween(-2.2, 2.2) * scale;
      const offsetZ = randomBetween(-1.9, 1.9) * scale;
      const radius = randomBetween(2.2, 3.45) * scale * (ancient ? 1.22 : 1);
      const leafType = Math.floor(random() * leafMaterials.length);
      canopyTransforms[leafType].push(Matrix.Compose(
        new Vector3(radius, radius * randomBetween(.62, .92), radius * randomBetween(.80, 1.15)),
        Quaternion.FromEulerAngles(0, random() * Math.PI * 2, 0),
        new Vector3(x + offsetX, y + height * randomBetween(.70, 1.00), z + offsetZ)
      ));
    }

    if (ancient) {
      for (let j = 0; j < 4; j++) {
        const angle = j * Math.PI / 2 + random();
        const root = MeshBuilder.CreateCylinder("tree-root", { height: 3.4 * scale, diameterTop: .10, diameterBottom: .6 * scale, tessellation: 6 }, scene);
        root.position.set(x + Math.sin(angle) * 1.3 * scale, y + .6 * scale, z + Math.cos(angle) * 1.3 * scale);
        root.rotation.z = Math.cos(angle) * .93;
        root.rotation.x = Math.sin(angle) * .93;
        root.material = barkDark;
      }
    }
  }

  // Distant layered foliage also acts as a natural boundary for the demo.
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
  ].forEach(([x, z, scale]) => treeAt(x, z, scale, true));

  // Group hundreds of trunks into just two thin-instanced draw groups.
  trunkTransforms.forEach((transforms, i) => {
    const source = MeshBuilder.CreateCylinder("trunk-batch-" + i, {
      height: 1, diameterTop: .58, diameterBottom: 1.5, tessellation: 8
    }, scene);
    source.material = i === 1 ? barkDark : trunk;
    source.receiveShadows = true;
    source.thinInstanceSetBuffer("matrix", packInstanceMatrices(transforms), 16, true);
    source.thinInstanceRefreshBoundingInfo();
  });

  // Batch the canopy as six groups rather than hundreds of individual meshes.
  // Thin instances preserve varied silhouettes at substantially lower draw-call cost.
  canopyTransforms.forEach((transforms, i) => {
    const source = MeshBuilder.CreateIcoSphere("canopy-batch-" + i, { radius: 1, subdivisions: 2 }, scene);
    source.material = leafMaterials[i];
    source.receiveShadows = true;
    source.thinInstanceSetBuffer("matrix", packInstanceMatrices(transforms), 16, true);
    source.thinInstanceRefreshBoundingInfo();
  });

  // Understory bushes: cheaper than detailed photo assets, but lots of depth.
  const bushTransforms: Matrix[][] = bushMats.map(() => []);
  for (let i = 0; i < 260; i++) {
    const x = randomBetween(-88, 88);
    const z = randomBetween(-100, 103);
    if (Math.abs(x - pathCenter(z)) < 4.6) continue;
    const radius = randomBetween(.38, 1.15);
    const type = Math.floor(random() * bushMats.length);
    bushTransforms[type].push(Matrix.Compose(
      new Vector3(radius * 1.5, radius * .75, radius),
      Quaternion.FromEulerAngles(0, random() * Math.PI * 2, 0),
      new Vector3(x, groundHeight(x, z) + radius * .28, z)
    ));
  }
  bushTransforms.forEach((transforms, i) => {
    const source = MeshBuilder.CreateIcoSphere("bush-batch-" + i, { radius: 1, subdivisions: 1 }, scene);
    source.material = bushMats[i];
    source.thinInstanceSetBuffer("matrix", packInstanceMatrices(transforms), 16, true);
    source.thinInstanceRefreshBoundingInfo();
  });

  // Thousands of foliage blades, rendered in only two thin-instance batches.
  function grassLayer(name: string, hex: string, count: number, height: number) {
    const blade = MeshBuilder.CreateCylinder(name, { height, diameterTop: .012, diameterBottom: .18, tessellation: 3 }, scene);
    const bladeMat = material(scene, name + "-mat", hex);
    bladeMat.backFaceCulling = false;
    blade.material = bladeMat;
    const transforms = new Float32Array(count * 16);
    let filled = 0;
    let attempts = 0;
    while (filled < count && attempts < count * 8) {
      attempts++;
      const x = randomBetween(-91, 91);
      const z = randomBetween(-100, 106);
      if (Math.abs(x - pathCenter(z)) < 3.2) continue;
      const size = randomBetween(.7, 1.75);
      const matrix = Matrix.Compose(
        new Vector3(size, size, size),
        Quaternion.FromEulerAngles(randomBetween(-.23, .23), randomBetween(0, 6.28), randomBetween(-.18, .18)),
        new Vector3(x, groundHeight(x, z) + height * size * .34, z)
      );
      matrix.copyToArray(transforms, filled * 16);
      filled++;
    }
    blade.thinInstanceSetBuffer("matrix", transforms.subarray(0, filled * 16), 16, true);
    blade.thinInstanceRefreshBoundingInfo();
  }
  grassLayer("sunlit-grass", "#679a4c", 2900, .56);
  grassLayer("shadow-grass", "#3e7b45", 2400, .72);

  // Warm textured wood grain is produced by a tiny procedural canvas.
  const woodTexture = new DynamicTexture("procedural-timber-grain", { width: 256, height: 256 }, scene, false);
  const context = woodTexture.getContext();
  context.fillStyle = "#a38a66";
  context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 55; i++) {
    const y = random() * 256;
    context.fillStyle = i % 3 === 0 ? "#73573b" : "#c1a17c";
    context.fillRect(0, y, 256, randomBetween(1, 3));
  }
  for (let i = 0; i < 9; i++) {
    const y = i * 32;
    context.fillStyle = "#654b38";
    context.fillRect(0, y, 256, 3);
  }
  woodTexture.update();
  wood.diffuseTexture = woodTexture;

  // Wooden houses are intentionally modular. These primitives will be
  // swapped for authored glTF village modules during art production.
  function createHouse(x: number, z: number, side: 1 | -1, size = 1) {
    const y = groundHeight(x, z);
    const s = size;
    const roofY = y + 4.65 * s;
    const main = box(scene, "timber-cottage", 6.6 * s, 3.8 * s, 6.1 * s, x, y + 2.0 * s, z, wood, shadows);
    main.receiveShadows = true;
    blockers.push({ x, z, rx: 3.25 * s, rz: 3.05 * s });

    // Exposed beams and balcony railings.
    for (const dx of [-3.2, 3.2]) {
      for (const dz of [-2.9, 2.9]) {
        box(scene, "corner-pillar", .25 * s, 4.25 * s, .29 * s, x + dx * s, y + 2.12 * s, z + dz * s, beams);
      }
    }
    for (const yy of [1, 3.55]) {
      box(scene, "horizontal-beam", 6.8 * s, .19 * s, .28 * s, x, y + yy * s, z - 3.12 * s, beams);
    }

    const roofL = box(scene, "left-thatched-roof", 4.4 * s, .33 * s, 7.4 * s, x - 1.70 * s, roofY, z, roof, shadows);
    const roofR = box(scene, "right-thatched-roof", 4.4 * s, .33 * s, 7.4 * s, x + 1.70 * s, roofY, z, roof, shadows);
    roofL.rotation.z = .43; roofR.rotation.z = -.43;
    for (const dx of [-2.5, -1, 1, 2.5]) {
      const ridge = box(scene, "roof-thatch-detail", .11 * s, .08 * s, 7.6 * s, x + dx * s, roofY + (.7 - Math.abs(dx) * .18) * s, z, roofLight);
      ridge.rotation.z = dx < 0 ? .43 : -.43;
    }
    const front = z - 3.13 * s;
    box(scene, "arched-door", 1.48 * s, 2.34 * s, .14 * s, x, y + 1.2 * s, front, beams);
    for (const dx of [-2.18, 2.18]) {
      box(scene, "window-opening", 1.15 * s, 1.10 * s, .12 * s, x + dx * s, y + 2.35 * s, front - .06 * s, barkDark);
      box(scene, "window-glow", .79 * s, .77 * s, .13 * s, x + dx * s, y + 2.35 * s, front - .17 * s, lantern);
      box(scene, "window-cross", .09 * s, .98 * s, .18 * s, x + dx * s, y + 2.35 * s, front - .26 * s, beams);
      box(scene, "window-cross", 1.05 * s, .09 * s, .18 * s, x + dx * s, y + 2.35 * s, front - .26 * s, beams);
    }
    // Raised entry boards and foliage-bound supports.
    for (let i = 0; i < 3; i++) box(scene, "porch-step", 2.2 * s, .14 * s, .45 * s, x, y + .17 * s + i * .055, front - .45 * s - i * .45 * s, roofLight);
    for (let i = 0; i < 5; i++) {
      const hanging = MeshBuilder.CreateSphere("hanging-vines", { diameter: .44 * s, segments: 6 }, scene);
      hanging.position.set(x + (-2.7 + i * 1.35) * s, roofY - .64 * s - random() * .45, front + .22 * s);
      hanging.scaling.y = randomBetween(1.4, 2.8);
      hanging.material = bushMats[i % bushMats.length];
    }
    // Low market awning attached to the front of the house.
    if (side === 1) {
      const awning = box(scene, "market-awning", 5.0 * s, .12 * s, 2.45 * s, x, y + 2.65 * s, front - 1.4 * s, flag);
      awning.rotation.x = -.08;
      for (const dx of [-2.35, 2.35]) {
        box(scene, "awning-post", .13 * s, 2.63 * s, .13 * s, x + dx * s, y + 1.30 * s, front - 2.40 * s, beams);
      }
    }
  }

  createHouse(-13.5, 12, -1, 1.08);
  createHouse(13.2, 21, 1, .98);
  createHouse(-14.5, 40, 1, 1.15);
  createHouse(14.7, 55, 1, 1.05);
  createHouse(-13.3, 74, -1, .92);
  createHouse(14.2, 87, -1, 1.09);

  // Market crates, planters and travel supplies bring scale and interest.
  function barrel(x: number, z: number) {
    const y = groundHeight(x, z);
    const b = MeshBuilder.CreateCylinder("market-barrel", { height: 1.13, diameter: .8, tessellation: 12 }, scene);
    b.position.set(x, y + .58, z);
    b.material = wood;
    box(scene, "barrel-band", .86, .10, .86, x, y + .25, z, beams);
  }
  for (const [x, z] of [[-7, 13],[-6, 15],[6, 22],[9, 51],[-9, 42],[7, 88],[-7, 74]]) {
    barrel(x, z);
    stoneAt(x + 1.7, z + 1.4, randomBetween(.3, .9));
  }
  for (let i = 0; i < 145; i++) {
    const z = randomBetween(-96, 104);
    const x = pathCenter(z) + (random() > .5 ? 1 : -1) * randomBetween(4.1, 7.8);
    stoneAt(x, z, randomBetween(.14, .65));
  }

  // Draw scattered rocks in two material groups instead of issuing a draw
  // for every boulder. The old geometry and placement remain unchanged.
  rockTransforms.forEach((transforms, i) => {
    const rock = MeshBuilder.CreateIcoSphere("forest-rocks-instanced-" + i, {
      radius: 1, subdivisions: 1
    }, scene);
    rock.material = i === 0 ? stone : stoneDark;
    rock.receiveShadows = true;
    rock.thinInstanceSetBuffer("matrix", packInstanceMatrices(transforms), 16, true);
    rock.thinInstanceRefreshBoundingInfo();
  });

  // A soft warm lantern rhythm makes the forest path readable at dusk.
  function lightPost(x: number, z: number) {
    const y = groundHeight(x, z);
    box(scene, "lantern-post", .15, 3.7, .15, x, y + 1.85, z, beams);
    box(scene, "lantern-arm", 1.12, .13, .14, x + .48, y + 3.48, z, beams);
    box(scene, "lantern-frame", .50, .64, .50, x + .94, y + 3.02, z, gold);
    const bulb = box(scene, "lantern-core", .34, .47, .35, x + .94, y + 3.02, z, lantern);
    glow.addIncludedOnlyMesh(bulb);
  }
  for (const z of [-35, -12, 12, 35, 62, 83]) lightPost(pathCenter(z) + 5.6, z);

  // Handcrafted test landmark, independent from the future story.
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
    for (const dx of [-.9, .9]) box(scene, "signpost", .15, 2.9, .16, x + dx, y + 1.47, z, beams);
    box(scene, "village-sign", 2.4, 1.08, .18, x, y + 2.35, z, wood);
    box(scene, "village-sign-top", 2.7, .13, .24, x, y + 2.92, z, roofLight);
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

  // River-colored decorative flower clusters at village edges.
  const blossomColors = ["#ffe5d5", "#f7f0d1", "#e3c9ef"].map((hex, i) => material(scene, "blossom-" + i, hex));
  for (let i = 0; i < 120; i++) {
    const z = randomBetween(-85, 102);
    const x = pathCenter(z) + (random() > .5 ? 1 : -1) * randomBetween(4.6, 18);
    const flower = MeshBuilder.CreateSphere("tiny-wildflower", { diameter: randomBetween(.09, .21), segments: 5 }, scene);
    flower.position.set(x, groundHeight(x, z) + randomBetween(.34, .65), z);
    flower.material = blossomColors[Math.floor(random() * blossomColors.length)];
  }

  // The separately authored theme is completely modular: scenery, location
  // interactions and broad-phase blockers are added without changing the player.
  const lankaTheme = createLankaTheme(scene, shadows, groundHeight);
  blockers.push(...lankaTheme.blockers);
  interactions.push(...lankaTheme.interactions);

  // Lanterns remain visible during daytime, then gain contrast at night.
  let isNight = false;
  return {
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
      lantern.emissiveColor = night ? color("#ffe49b") : color("#ae7b3b");
      shrineLight.emissiveColor = night ? color("#5bf1d7") : color("#259b95");
      glow.intensity = night ? 1.0 : .58;
      cloth.alpha = night ? .82 : .9;
      earth.alpha = 1;
      lankaTheme.setNight(night);
    },
  };
}
