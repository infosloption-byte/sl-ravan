import { Mesh, SceneLoader, type Scene, type ShadowGenerator } from "@babylonjs/core";
import type { ForestVillage } from "./World";
import { groundHeight } from "./World";

const ASSET_ROOT = import.meta.env.BASE_URL + "assets/generated/";

async function importModel(scene: Scene, filename: string) {
  const result = await SceneLoader.ImportMeshAsync(null, ASSET_ROOT, filename, scene);
  const root = result.meshes[0];
  if (!root) throw new Error(filename + ": no root node imported");
  return { root, meshes: result.meshes };
}

/**
 * Original generated glTF assets. These models load after the procedural
 * scene has initialized, with an explicit fallback when files are missing.
 */
export async function loadOriginalGameArt(
  scene: Scene,
  shadows: ShadowGenerator,
  world: ForestVillage
): Promise<void> {
  await import("@babylonjs/loaders/glTF/2.0");

  try {
    const tree = await importModel(scene, "heritage-tree.glb");
    tree.root.position.set(-22, groundHeight(-22, -30), -30);
    tree.root.scaling.scaleInPlace(1.08);
    for (const mesh of tree.meshes) {
      mesh.receiveShadows = true;
      if (mesh instanceof Mesh && mesh.material?.name?.includes("bark")) {
        shadows.addShadowCaster(mesh);
      }
    }
    const clone = tree.root.instantiateHierarchy();
    if (clone) {
      clone.position.set(25, groundHeight(25, 24), 24);
      clone.scaling.scaleInPlace(.92);
    }
  } catch (error) {
    console.warn("SL Ravan: tree GLB unavailable; retaining original forest", error);
  }

  try {
    const temple = await importModel(scene, "stone-pavilion.glb");
    const x = -25, z = 88;
    temple.root.position.set(x, groundHeight(x, z), z);
    for (const mesh of temple.meshes) {
      mesh.receiveShadows = true;
      if (mesh instanceof Mesh && mesh.material && /granite|carved stone/i.test(mesh.material.name)) {
        shadows.addShadowCaster(mesh);
      }
    }
    world.addBlocker(x, z, 5.3, 5.3);
  } catch (error) {
    console.warn("SL Ravan: pavilion GLB unavailable; retaining original ruins", error);
  }
}
