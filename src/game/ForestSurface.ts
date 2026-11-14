import { Color3, DynamicTexture, Scene, StandardMaterial, Texture } from "@babylonjs/core";
/**
 * Subtle tileable color-grain for the original blockout terrain.
 * The terrain's existing vertex colors continue to define dirt and grass.
 * This texture only breaks up large areas of flat, uniform color.
 */
export function surfaceHash(x: number, y: number): number {
  let value = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + 0x2c1b3c6d) | 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

export function createForestSurfaceMaterial(scene: Scene): StandardMaterial {
  const size = 256;
  const tex = new DynamicTexture("forest-ground-detail", { width: size, height: size }, scene, false);
  const ctx = tex.getContext();
  ctx.fillStyle = "#f2f1e9";
  ctx.fillRect(0, 0, size, size);

  const palette = ["#e8e9df", "#dedfd1", "#f8f6ec", "#cbd4c4", "#f0e9dc"];
  for (let i = 0; i < 3800; i++) {
    const x = Math.floor(surfaceHash(i, 17) * size);
    const y = Math.floor(surfaceHash(i, 41) * size);
    ctx.fillStyle = palette[Math.floor(surfaceHash(i, 83) * palette.length)];
    const radius = surfaceHash(i, 113) > .88 ? 3 : 1;
    ctx.fillRect(x, y, radius, radius);
  }

  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.uScale = 24;
  tex.vScale = 28;
  tex.update();

  const material = new StandardMaterial("forest-ground-detailed", scene);
  material.diffuseColor = Color3.White();
  material.diffuseTexture = tex;
  material.specularColor = Color3.Black();
  return material;
}
