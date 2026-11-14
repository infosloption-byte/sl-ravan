import { Mesh, SceneLoader, type AbstractMesh, type Scene, type ShadowGenerator } from "@babylonjs/core";
import type { ForestVillage } from "./World";
import { groundHeight } from "./World";

const GENERATED = import.meta.env.BASE_URL + "assets/generated/";
const HERO = import.meta.env.BASE_URL + "assets/visual-slice/vegetation/hero-tree.glb";

async function importModel(scene: Scene, filename: string, root = GENERATED) {
  const result = await SceneLoader.ImportMeshAsync(null, root, filename, scene, undefined, ".glb");
  const node = result.meshes[0];
  if (!node) throw new Error(filename + ": no root node imported");
  return { root: node, meshes: result.meshes };
}

async function heroFileInstalled(): Promise<boolean> {
  try {
    const reply = await fetch(HERO, { method: "HEAD", cache: "no-store" });
    const contentType = reply.headers.get("content-type") || "";
    // Vite returns index.html for missing paths in dev. Do not import HTML as GLB.
    return reply.ok && !contentType.includes("text/html");
  } catch {
    return false;
  }
}

function positionHeroTree(
  meshes: AbstractMesh[],
  root: AbstractMesh,
  x: number,
  z: number,
  desiredHeight: number
) {
  let bottom = Infinity;
  let top = -Infinity;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const mesh of meshes) {
    if (mesh.getTotalVertices() < 1) continue;
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    bottom = Math.min(bottom, box.minimumWorld.y);
    top = Math.max(top, box.maximumWorld.y);
    minX = Math.min(minX, box.minimumWorld.x);
    maxX = Math.max(maxX, box.maximumWorld.x);
    minZ = Math.min(minZ, box.minimumWorld.z);
    maxZ = Math.max(maxZ, box.maximumWorld.z);
  }
  if (!Number.isFinite(bottom) || top - bottom <= .001) {
    throw Error("Hero tree has no valid world bounds");
  }
  const s = Math.min(20, Math.max(.05, desiredHeight / (top - bottom)));
  root.scaling.scaleInPlace(s);
  root.position.set(x - (minX + maxX) / 2 * s,
    groundHeight(x, z) - bottom * s,
    z - (minZ + maxZ) / 2 * s);
}

/**
 * Loads exactly one optional real high-detail tree plus the original procedural
 * tree as fallback. Real artwork does not replace any player gameplay code.
 */
export async function loadOriginalGameArt(
  scene: Scene,
  shadows: ShadowGenerator,
  world: ForestVillage,
  isActive: () => boolean = () => true
): Promise<number> {
  let loaded = 0;
  await import("@babylonjs/loaders/glTF/2.0");
  if (!isActive()) return 0;

  let realTreeLoaded = false;
  if (await heroFileInstalled() && isActive()) {
    try {
      const hero = await importModel(scene, HERO, "");
      if (!isActive()) { hero.root.dispose(false, true); return 0; }
      positionHeroTree(hero.meshes, hero.root, -22, -30, 12);
      for (const mesh of hero.meshes) {
        mesh.receiveShadows = true;
        // Shadow only textured bark/structural meshes to conserve GPU work.
        if (mesh instanceof Mesh && /trunk|bark/i.test(mesh.name)) {
          shadows.addShadowCaster(mesh);
        }
      }
      realTreeLoaded = true;
      console.info("[SL Ravan] Verified local high-detail tree imported into village");
    } catch (error) {
      console.warn("[SL Ravan] Hero tree import failed; procedural fallback remains", error);
    }
  }
  if (!isActive()) return loaded;

  try {
    const tree = await importModel(scene, "heritage-tree.glb");
    if (!isActive()) { tree.root.dispose(false, true); return loaded; }
    const x = realTreeLoaded ? 25 : -22;
    const z = realTreeLoaded ? 24 : -30;
    tree.root.position.set(x, groundHeight(x, z), z);
    tree.root.scaling.scaleInPlace(realTreeLoaded ? .92 : 1.08);
    for (const mesh of tree.meshes) {
      mesh.receiveShadows = true;
      if (mesh instanceof Mesh && mesh.material?.name?.includes("bark")) {
        shadows.addShadowCaster(mesh);
      }
    }
    if (!realTreeLoaded) {
      const clone = tree.root.instantiateHierarchy();
      if (clone) {
        clone.position.set(25, groundHeight(25, 24), 24);
        clone.scaling.scaleInPlace(.92);
      }
    }
    loaded++;
  } catch (error) {
    if (realTreeLoaded) loaded++;
    console.warn("[SL Ravan] Generated tree GLB unavailable", error);
  }
  if (!isActive()) return loaded;

  try {
    const temple = await importModel(scene, "stone-pavilion.glb");
    if (!isActive()) { temple.root.dispose(false, true); return loaded; }
    const x = -25, z = 88;
    temple.root.position.set(x, groundHeight(x, z), z);
    for (const mesh of temple.meshes) {
      mesh.receiveShadows = true;
      if (mesh instanceof Mesh && mesh.material && /granite|carved stone/i.test(mesh.material.name)) {
        shadows.addShadowCaster(mesh);
      }
    }
    world.addBlocker(x, z, 5.3, 5.3);
    loaded++;
  } catch (error) {
    console.warn("[SL Ravan] Pavilion GLB unavailable; retaining original ruins", error);
  }
  return loaded;
}
