import {
  Mesh, MeshBuilder, Scene, ShadowGenerator, StandardMaterial,
  TransformNode, Color3
} from "@babylonjs/core";
import { createMotionState, stepAvatarMotion } from "./AvatarMotion";

export interface PlayerAvatar {
  root: TransformNode;
  updateAnimation: (dt: number, moving: boolean, sprinting: boolean, grounded: boolean) => void;
}

/**
 * A more expressive, original ancient-Lanka-fantasy explorer.
 *
 * This is an articulated, engine-side proxy rig — NOT a final skeletal GLB.
 * Movement and animation states are independent of Babylon, so a rigged
 * character GLB can later replace the geometry without changing game rules.
 */
export function createPlayer(scene: Scene, shadows: ShadowGenerator): PlayerAvatar {
  const root = new TransformNode("player-root", scene);
  const body = new TransformNode("hero-visual-rig", scene);
  body.parent = root;
  const motion = createMotionState();

  function surface(name: string, hex: string, metal = false) {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = metal ? new Color3(.32, .28, .19) : new Color3(.06, .06, .06);
    return m;
  }
  const skin = surface("hero-skin", "#b87e53");
  const ivory = surface("hero-sand-linen", "#e5d6ac");
  const indigo = surface("hero-indigo-wrap", "#315d67");
  const dusk = surface("hero-deep-indigo", "#284451");
  const burgundy = surface("hero-royal-trim", "#88443b");
  const leather = surface("hero-aged-leather", "#76503a");
  const dark = surface("hero-hair-and-boots", "#2c2a29");
  const copper = surface("hero-antique-gold", "#c6a268", true);

  function part(name: string, mesh: Mesh, material: StandardMaterial, parent: TransformNode,
    xyz: [number,number,number], castShadow=false) {
    mesh.name=name;
    mesh.material=material;
    mesh.parent=parent;
    mesh.position.set(...xyz);
    if(castShadow) shadows.addShadowCaster(mesh);
    return mesh;
  }
  const cylinder=(name:string,height:number,diameter:number,parent:TransformNode,
    xyz:[number,number,number],material:StandardMaterial,cast=false)=>
      part(name,MeshBuilder.CreateCylinder(name,{height,diameter,tessellation:12},scene),material,parent,xyz,cast);
  const block=(name:string,w:number,h:number,d:number,parent:TransformNode,
    xyz:[number,number,number],material:StandardMaterial,cast=false)=>
      part(name,MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene),material,parent,xyz,cast);
  const sphere=(name:string,r:number,parent:TransformNode,xyz:[number,number,number],
    material:StandardMaterial,cast=false)=>
      part(name,MeshBuilder.CreateSphere(name,{diameter:r*2,segments:12},scene),material,parent,xyz,cast);

  cylinder("embroidered-tunic",.88,.66,body,[0,1.28,0],ivory,true);
  cylinder("waist-wrap",.22,.71,body,[0,.89,0],indigo);
  cylinder("copper-belt",.10,.77,body,[0,.96,0],copper);
  block("front-robe-fold",.32,.45,.08,body,[.10,.69,.29],ivory);
  block("royal-robe-ribbon",.11,.55,.085,body,[-.19,.71,.295],burgundy);
  block("back-mantle",.76,.87,.10,body,[0,1.20,-.35],dusk,true);
  block("mantle-trim",.76,.08,.12,body,[0,.78,-.36],copper);

  const shawl = block("shoulder-wrap",.83,.29,.73,body,[0,1.57,-.12],indigo,true);
  shawl.rotation.z=.04;
  block("shoulder-embroidered-trim",.82,.075,.14,body,[0,1.57,.245],copper);
  const strap = block("travel-strap",.085,.9,.095,body,[.14,1.31,-.33],leather);
  strap.rotation.z=-.42;
  block("leather-travel-bag",.36,.39,.22,body,[.39,1.03,-.3],leather);
  block("travel-bag-clasp",.18,.08,.06,body,[.39,1.08,-.43],copper);

  const head = new TransformNode("hero-head-joint",scene);
  head.parent=body;
  head.position.set(0,1.86,.04);
  sphere("hero-face",.28,head,[0,.12,.05],skin,true);
  const hairCap=sphere("long-black-hair",.29,head,[0,.32,-.03],dark);
  hairCap.scaling.y=.67;
  sphere("hair-topknot",.18,head,[0,.52,-.14],dark);
  cylinder("hair-ring",.06,.20,head,[0,.42,-.14],copper);
  block("forehead-band",.52,.08,.09,head,[0,.29,.235],burgundy);
  sphere("left-eye",.038,head,[-.105,.135,.305],dark);
  sphere("right-eye",.038,head,[.105,.135,.305],dark);
  for(const x of [-.27,.27]) {
    const earring=sphere("copper-earring",.062,head,[x,.055,.04],copper);
    earring.scaling.y=1.35;
  }

  function limbPivot(name:string,position:[number,number,number]) {
    const joint=new TransformNode(name,scene);
    joint.parent=body; joint.position.set(...position);
    return joint;
  }
  const leftLeg=limbPivot("left-leg",[-.205,.83,0]);
  const rightLeg=limbPivot("right-leg",[.205,.83,0]);
  for(const [side,joint] of [["left",leftLeg],["right",rightLeg]] as const) {
    cylinder(side+"-trouser",.72,.24,joint,[0,-.37,0],dusk);
    cylinder(side+"-shin-guard",.27,.27,joint,[0,-.53,.02],leather);
    block(side+"-leather-sandal",.32,.18,.46,joint,[0,-.75,.09],dark);
    block(side+"-ankle-metal",.29,.055,.34,joint,[0,-.61,.05],copper);
  }
  const leftArm=limbPivot("left-arm",[-.47,1.6,0]);
  const rightArm=limbPivot("right-arm",[.47,1.6,0]);
  for(const [side,joint] of [["left",leftArm],["right",rightArm]] as const) {
    cylinder(side+"-sleeve",.33,.26,joint,[0,-.13,0],side==="left"?indigo:ivory);
    cylinder(side+"-forearm",.36,.20,joint,[0,-.41,0],skin);
    cylinder(side+"-bronze-cuff",.13,.24,joint,[0,-.52,0],copper);
    sphere(side+"-hand",.12,joint,[0,-.70,0],skin);
  }
  const cape = block("loose-cloak-tail",.65,.53,.07,body,[0,.63,-.37],burgundy);
  cape.rotation.x=.08;

  return {
    root,
    updateAnimation(dt,moving,sprinting,grounded) {
      const pose=stepAvatarMotion(motion,{moving,sprinting,grounded},dt);
      leftLeg.rotation.x=pose.leftLeg;
      rightLeg.rotation.x=pose.rightLeg;
      leftArm.rotation.x=pose.leftArm;
      rightArm.rotation.x=pose.rightArm;
      body.position.y=pose.bodyBob;
      body.rotation.x=pose.forwardLean;
      head.rotation.y=pose.headTurn;
      cape.rotation.x=pose.capeSwing + .08;
    }
  };
}
