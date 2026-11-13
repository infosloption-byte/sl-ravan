import {
  Color3, DynamicTexture, GlowLayer, Matrix, MeshBuilder, PointLight,
  Quaternion, Scene, ShadowGenerator, StandardMaterial, Vector3
} from "@babylonjs/core";
import type { Interaction } from "./World";

/**
 * An ORIGINAL, fantasy interpretation of an ancient Lankan stone sanctuary.
 * This is art direction only, deliberately separated from Ravana story canon.
 * All art is built procedurally so this demo needs no third-party game assets.
 */
export interface ThemeBlocker { x: number; z: number; rx: number; rz: number }
export interface LankaThemeResult {
  interactions: Interaction[];
  blockers: ThemeBlocker[];
  setNight(night: boolean): void;
}
type HeightFn = (x: number, z: number) => number;
const hex = (value: string) => Color3.FromHexString(value);

function mat(scene: Scene, name: string, diffuse: string, emissive?: string) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = hex(diffuse);
  result.specularColor = new Color3(.07, .07, .06);
  if (emissive) result.emissiveColor = hex(emissive);
  return result;
}

export function createLankaTheme(scene: Scene, shadows: ShadowGenerator, heightAt: HeightFn): LankaThemeResult {
  const interactions: Interaction[] = [];
  const blockers: ThemeBlocker[] = [];
  const moonstone = mat(scene, "ancient-lanka-pale-stone", "#b3a38c");
  const weathered = mat(scene, "ancient-lanka-dark-stone", "#625f56");
  const carved = mat(scene, "ancient-lanka-carved-stone", "#868276");
  const moss = mat(scene, "ancient-lanka-moss", "#526f4a");
  const bronze = mat(scene, "ancient-lanka-bronze", "#ad864c", "#241509");
  const rune = mat(scene, "ancient-lanka-aqua-rune", "#47c1ac", "#239887");
  const silk = mat(scene, "ancient-lanka-banner", "#8f4635");
  const water = mat(scene, "ancient-lanka-water", "#4d9f98", "#0e3332");
  water.alpha = .78;
  const fernMaterials = ["#316b45", "#5b944c", "#89a955"].map((value,i) => mat(scene, "lanka-fern-"+i, value));
  const flower = mat(scene, "lanka-lotus-petal", "#f2b6ad");
  const flowerCenter = mat(scene, "lanka-lotus-center", "#f2cc77");
  const firefly = mat(scene, "lanka-sun-dust", "#f8e7b0", "#d5c48b");
  const glow = new GlowLayer("lanka-spirit-light", scene);
  glow.intensity = .5;

  // A drawn stone-block diffuse texture creates subtle material variation,
  // reducing the flat plastic look of plain box materials.
  const stoneTex = new DynamicTexture("lanka-carved-stone-texture", { width: 512, height: 512 }, scene, false);
  const ctx = stoneTex.getContext();
  ctx.fillStyle = "#c3b7a4";
  ctx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const jitter = (row * 19 + col * 23) % 17;
      ctx.fillStyle = ["#b5ab99", "#c9bdab", "#a99f8e", "#bdb4a2"][(row + col) % 4];
      ctx.fillRect(col * 86 + jitter / 3, row * 64 + 2, 83, 60);
      ctx.strokeStyle = "#7f7a6e";
      ctx.lineWidth = 2;
      ctx.strokeRect(col * 86 + jitter / 3, row * 64 + 2, 83, 60);
      ctx.strokeStyle = "#d5ccb7";
      ctx.beginPath();
      ctx.moveTo(col * 86 + 10, row * 64 + 13);
      ctx.lineTo(col * 86 + 25 + jitter, row * 64 + 13);
      ctx.stroke();
    }
  }
  stoneTex.update();
  moonstone.diffuseTexture = stoneTex;

  const add = (name: string, x: number, y: number, z: number, w: number, h: number, d: number,
    material: StandardMaterial, castShadow = false) => {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z);
    mesh.material = material;
    mesh.receiveShadows = true;
    if (castShadow) shadows.addShadowCaster(mesh);
    return mesh;
  };

  // Open-air ruined archway at the entrance to the sacred forest clearing.
  // Its columns stand on either side of the original player trail.
  const gateZ = 82;
  const gateY = heightAt(0, gateZ);
  for (const side of [-1, 1]) {
    const x = side * 5.4;
    const footY = heightAt(x, gateZ);
    const foundation = add("guardian-gate-footing", x, footY + .27, gateZ, 2.3, .55, 2.5, weathered, true);
    foundation.rotation.y = side * .045;
    const pillar = add("carved-gateway-column", x, footY + 3.45, gateZ, 1.42, 6.2, 1.35, moonstone, true);
    pillar.rotation.y = side * -.025;
    blockers.push({ x, z: gateZ, rx: 1.1, rz: 1.1 });
    for (const level of [.8, 1.65, 4.45, 5.35]) {
      add("sculpted-column-band", x, footY + level, gateZ, 1.65, .22, 1.56, bronze);
    }
    for (let i = 0; i < 4; i++) {
      const yy = footY + 2.0 + i * .68;
      // Repeated recessed relief bands suggest hand-carved ancient masonry.
      add("stone-column-relief", x, yy, gateZ - .705, 1.0, .11, .09, carved);
    }
    add("guardian-capital", x, footY + 6.85, gateZ, 2.3, .65, 2.05, weathered, true);
    const torch = MeshBuilder.CreateSphere("guardian-torch", { diameter: .29, segments: 10 }, scene);
    torch.position.set(x - side * 1.4, footY + 3.8, gateZ - .75);
    torch.material = rune;
    glow.addIncludedOnlyMesh(torch);

    // Banner fabric strips hung beneath the arch.
    const banner = add("royal-red-banner", x - side * .45, footY + 5.35, gateZ -.9, .65, 1.9, .065, silk);
    banner.rotation.z = side * .08;
  }
  add("arch-lintel", 0, gateY + 7.00, gateZ, 12.7, 1.30, 1.85, moonstone, true);
  add("arch-top-tier", 0, gateY + 7.9, gateZ, 10.2, .55, 1.50, weathered, true);
  add("arch-crown", 0, gateY + 8.35, gateZ, 5.3, .42, 1.45, bronze);
  for (let i = -5; i <= 5; i++) {
    const relief = add("gate-geometric-relief", i * .82, gateY + 6.9, gateZ - 1.01, .53, .52, .09, i % 3 === 0 ? bronze : carved);
    relief.rotation.z = Math.PI * .25;
  }
  const gateSigil = MeshBuilder.CreateTorus("royal-gateway-emblem", { diameter: 1.15, thickness: .12, tessellation: 36 }, scene);
  gateSigil.position.set(0, gateY + 7.2, gateZ - 1.18);
  gateSigil.material = rune;
  glow.addIncludedOnlyMesh(gateSigil);

  // Stone courts placed either side of the terminal shrine trail.
  // Each has raised column bases, carved capitals and a timber-like roof.
  function pavilion(cx: number, cz: number, scale: number) {
    const y = heightAt(cx, cz);
    const s = scale;
    const floor = add("sanctuary-court-floor", cx, y + .045 * s, cz, 7.5 * s, .09 * s, 8.1 * s, weathered);
    floor.receiveShadows = true;
    for (const dx of [-2.7, 2.7]) {
      for (const dz of [-2.9, 2.9]) {
        const px = cx + dx * s, pz = cz + dz * s;
        const py = heightAt(px, pz);
        add("pavilion-foot", px, py + .20, pz, 1.35 * s, .42 * s, 1.4 * s, carved);
        add("pavilion-column", px, py + 2.4 * s, pz, .55 * s, 4.1 * s, .56 * s, moonstone, true);
        add("pavilion-carved-capital", px, py + 4.51 * s, pz, 1.10 * s, .43 * s, 1.13 * s, bronze);
        blockers.push({ x: px, z: pz, rx: .45 * s, rz: .45 * s });
      }
    }
    add("pavilion-roof-foundation", cx, y + 5.05 * s, cz, 7.9 * s, .4 * s, 8.3 * s, weathered, true);
    const leftRoof = add("pavilion-left-roof", cx - 1.75 * s, y + 5.75 * s, cz, 4.3 * s, .34 * s, 8.7 * s, moss, true);
    const rightRoof = add("pavilion-right-roof", cx + 1.75 * s, y + 5.75 * s, cz, 4.3 * s, .34 * s, 8.7 * s, moss, true);
    leftRoof.rotation.z = .35;
    rightRoof.rotation.z = -.35;
    add("pavilion-gilded-ridge", cx, y + 6.55 * s, cz, .34 * s, .29 * s, 9.0 * s, bronze);
    for (const dz of [-3, -1.5, 0, 1.5, 3]) {
      add("terrace-edge-ornament", cx - 3.9 * s, y + 5.2 * s, cz + dz * s, .42 * s, .6 * s, .65 * s, bronze);
      add("terrace-edge-ornament", cx + 3.9 * s, y + 5.2 * s, cz + dz * s, .42 * s, .6 * s, .65 * s, bronze);
    }
  }
  pavilion(-14.9, 97.5, .85);
  pavilion(14.7, 98, .9);

  // An inlaid ceremonial track leading toward the shrine.
  // Keep top surfaces very close to terrain height to avoid clipping
  // until a physical character controller is added.
  for (let z = 83; z < 101; z += 2.25) {
    const x = Math.sin(z * .033) * 2.4 + Math.sin(z * .083) * .65;
    const y = heightAt(x, z);
    const stoneTile = add("ceremonial-path-inlay", x, y + .008, z, 2.2, .018, 1.23, z % 2 > 1 ? carved : moonstone);
    stoneTile.rotation.y = Math.sin(z * .05) * .12;
  }

  // Small mineral pools with lotus blossoms and ferns provide a break
  // from box-shaped architecture and support the humid Sri Lankan theme.
  function lotusPond(x: number, z: number, radius: number) {
    const y = heightAt(x, z);
    const pond = MeshBuilder.CreateCylinder("lotus-pool-water", { height: .055, diameter: radius * 2.0, tessellation: 34 }, scene);
    pond.position.set(x, y + .037, z);
    pond.material = water;
    for (let i = 0; i < 14; i++) {
      const angle = i / 14 * Math.PI * 2;
      const bx = x + Math.cos(angle) * radius;
      const bz = z + Math.sin(angle) * radius;
      const pebble = MeshBuilder.CreateIcoSphere("pool-edge-stone", { radius: .42, subdivisions: 1 }, scene);
      pebble.position.set(bx, heightAt(bx, bz) + .21, bz);
      pebble.scaling.set(1.35, .67, 1.05);
      pebble.rotation.y = angle;
      pebble.material = i % 3 === 0 ? moss : carved;
    }
    for (let i = 0; i < 4; i++) {
      const a = i * 2.4;
      const px = x + Math.sin(a) * radius * .49;
      const pz = z + Math.cos(a) * radius * .43;
      for (let p = 0; p < 6; p++) {
        const ang = p * Math.PI / 3;
        const petal = MeshBuilder.CreateSphere("lotus-petal", { diameter: .26, segments: 6 }, scene);
        petal.position.set(px + Math.cos(ang) * .14, y + .17, pz + Math.sin(ang) * .14);
        petal.scaling.set(.9, .42, 1.35);
        petal.rotation.y = ang;
        petal.material = flower;
      }
      const center = MeshBuilder.CreateSphere("lotus-heart", { diameter: .14, segments: 7 }, scene);
      center.position.set(px, y + .23, pz);
      center.material = flowerCenter;
    }
  }
  lotusPond(10.4, 43, 2.5);
  lotusPond(-9.6, -16, 2.15);

  // Procedural fern patches using three thin-instance batches.
  // These aren't photorealistic foliage, but add tropical silhouette
  // while making only a handful of draw calls.
  const matrices: Matrix[][] = fernMaterials.map(() => []);
  for (let patch = 0; patch < 100; patch++) {
    const z = -74 + (patch * 37 % 170);
    const sign = patch % 2 ? -1 : 1;
    const x = (Math.sin(z * .033) * 2.4 + Math.sin(z * .083) * .65) + sign * (6 + (patch * 13 % 24));
    const y = heightAt(x, z);
    const leafType = patch % fernMaterials.length;
    const size = .65 + (patch % 9) * .09;
    for (let f = 0; f < 7; f++) {
      const angle = f * 2 * Math.PI / 7;
      matrices[leafType].push(Matrix.Compose(
        new Vector3(size, size, size),
        Quaternion.FromEulerAngles(.44 * Math.cos(angle), angle, .55 * Math.sin(angle)),
        new Vector3(x + Math.sin(angle) * .30, y + .42 * size, z + Math.cos(angle) * .30)
      ));
    }
  }
  fernMaterials.forEach((material, i) => {
    const leaf = MeshBuilder.CreateCylinder("tropical-fern-fronds", {
      height: 1.2, diameterTop: .015, diameterBottom: .30, tessellation: 3
    }, scene);
    leaf.material = material;
    leaf.thinInstanceSetBuffer("matrix", new Float32Array(matrices[i].flatMap(m => m.asArray())), 16, true);
    leaf.thinInstanceRefreshBoundingInfo();
  });

  // Gold pollen-like fireflies hanging over the forest path.
  const pollen = MeshBuilder.CreateSphere("sunlit-pollen", { diameter: .08, segments: 4 }, scene);
  pollen.material = firefly;
  const pollenTransforms: number[] = [];
  for (let i = 0; i < 125; i++) {
    const z = -40 + ((i * 37) % 142);
    const x = Math.sin(z * .033) * 2.4 + Math.sin(z * .083) * .65 + ((i * 31) % 130 - 65) / 10;
    const y = heightAt(x, z) + 1.3 + ((i * 11) % 60) / 10;
    const size = .5 + (i % 5) * .2;
    pollenTransforms.push(...Matrix.Compose(new Vector3(size, size, size), Quaternion.Identity(), new Vector3(x, y, z)).asArray());
  }
  pollen.thinInstanceSetBuffer("matrix", new Float32Array(pollenTransforms), 16, true);
  pollen.thinInstanceRefreshBoundingInfo();

  const gateLamp = new PointLight("gateway-stone-light", new Vector3(0, gateY + 6.3, gateZ - 1.4), scene);
  gateLamp.diffuse = hex("#7ce1ca");
  gateLamp.range = 14;
  gateLamp.intensity = .42;

  interactions.push({
    id: "royal-gate",
    label: "Ancient stone gateway",
    message: "The gateway leads into the old sanctuary",
    position: new Vector3(0, gateY, gateZ)
  });

  return {
    interactions, blockers,
    setNight(night: boolean) {
      glow.intensity = night ? .92 : .50;
      gateLamp.intensity = night ? 1.65 : .42;
      rune.emissiveColor = night ? hex("#5aebd2") : hex("#239887");
      firefly.emissiveColor = night ? hex("#fce8ad") : hex("#9c8e5c");
    }
  };
}
