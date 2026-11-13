import {
  Mesh, MeshBuilder, Scene, ShadowGenerator, StandardMaterial,
  TransformNode, Color3
} from "@babylonjs/core";

export interface PlayerAvatar {
  root: TransformNode;
  updateAnimation: (elapsed: number, moving: boolean, sprinting: boolean) => void;
}

/** Self-contained stylized test character; can later be swapped for an animated GLB. */
export function createPlayer(scene: Scene, shadows: ShadowGenerator): PlayerAvatar {
  const root = new TransformNode("player-root", scene);
  const skin = material("player-skin", "#e2a97e");
  const tunic = material("player-tunic", "#e8dcc1");
  const blue = material("player-shoulder-wrap", "#4f8aa0");
  const dark = material("player-boots", "#25333c");
  const hair = material("player-hair", "#24212a");
  const leather = material("player-leather", "#936342");
  const gold = material("player-gold", "#d7b56c");

  function material(name: string, hex: string) {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(.09, .09, .09);
    return m;
  }

  function part(name: string, mesh: Mesh, mat: StandardMaterial, parent: TransformNode, pos: [number, number, number], scale?: [number, number, number]) {
    mesh.name = name;
    mesh.material = mat;
    mesh.parent = parent;
    mesh.position.set(...pos);
    if (scale) mesh.scaling.set(...scale);
    shadows.addShadowCaster(mesh);
    return mesh;
  }

  part("torso", MeshBuilder.CreateCylinder("torso", { height: .92, diameterTop: .64, diameterBottom: .75, tessellation: 10 }, scene), tunic, root, [0, 1.24, 0]);
  part("cape", MeshBuilder.CreateBox("cape", { width: .76, height: .78, depth: .12 }, scene), blue, root, [0, 1.25, -.32]);
  part("belt", MeshBuilder.CreateCylinder("belt", { height: .14, diameter: .75, tessellation: 12 }, scene), leather, root, [0, .89, 0]);
  part("head", MeshBuilder.CreateSphere("head", { diameter: .54, segments: 14 }, scene), skin, root, [0, 2.02, .05]);
  part("hair cap", MeshBuilder.CreateSphere("hair", { diameter: .56, segments: 12 }, scene), hair, root, [0, 2.20, -.05], [1, .64, 1]);
  part("hair knot", MeshBuilder.CreateSphere("hair-knot", { diameter: .28, segments: 10 }, scene), hair, root, [0, 2.37, -.23]);
  part("satchel", MeshBuilder.CreateBox("satchel", { width: .39, height: .4, depth: .2 }, scene), leather, root, [.42, 1.05, -.21]);
  const strap = part("satchel strap", MeshBuilder.CreateBox("strap", { width: .08, height: .95, depth: .09 }, scene), gold, root, [.12, 1.41, -.35]);
  strap.rotation.z = -.44;

  const leftLeg = new TransformNode("left-leg-pivot", scene);
  const rightLeg = new TransformNode("right-leg-pivot", scene);
  leftLeg.parent = root; rightLeg.parent = root;
  leftLeg.position.set(-.20, .83, 0); rightLeg.position.set(.20, .83, 0);
  for (const [name, parent] of [["left", leftLeg], ["right", rightLeg]] as const) {
    part(name + "-leg", MeshBuilder.CreateCylinder(name + "-leg", { height: .72, diameter: .25, tessellation: 9 }, scene), dark, parent, [0, -.35, 0]);
    part(name + "-boot", MeshBuilder.CreateBox(name + "-boot", { width: .3, height: .21, depth: .45 }, scene), leather, parent, [0, -.70, .08]);
  }

  const leftArm = new TransformNode("left-arm-pivot", scene);
  const rightArm = new TransformNode("right-arm-pivot", scene);
  leftArm.parent = root; rightArm.parent = root;
  leftArm.position.set(-.44, 1.63, 0); rightArm.position.set(.44, 1.63, 0);
  part("left-sleeve", MeshBuilder.CreateCylinder("left-sleeve", { height: .65, diameter: .25, tessellation: 10 }, scene), blue, leftArm, [0, -.29, 0]);
  part("right-sleeve", MeshBuilder.CreateCylinder("right-sleeve", { height: .65, diameter: .25, tessellation: 10 }, scene), tunic, rightArm, [0, -.29, 0]);
  part("left-hand", MeshBuilder.CreateSphere("left-hand", { diameter: .19, segments: 9 }, scene), skin, leftArm, [0, -.64, 0]);
  part("right-hand", MeshBuilder.CreateSphere("right-hand", { diameter: .19, segments: 9 }, scene), skin, rightArm, [0, -.64, 0]);

  return {
    root,
    updateAnimation: (elapsed, moving, sprinting) => {
      const swing = moving ? Math.sin(elapsed * (sprinting ? 12 : 8)) * (sprinting ? .65 : .4) : 0;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = -swing * .7;
      rightArm.rotation.x = swing * .7;
      root.scaling.y = moving ? 1 + Math.abs(Math.sin(elapsed * (sprinting ? 12 : 8))) * .014 : 1;
    }
  };
}
