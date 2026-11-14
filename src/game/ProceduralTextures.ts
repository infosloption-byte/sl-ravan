import { DynamicTexture, type Scene } from "@babylonjs/core";
import { buildTileableNormalMap, clamp01, fbm, mulberry32, smoothstep, tileableHeight } from "./Noise";
import { paintGroundPixels, type TerrainBounds } from "./TerrainPaint";

/**
 * Original, canvas-generated textures. Nothing here is copied from any game;
 * these stand in for authored texture sets until hand-painted ones exist.
 */
type Ctx = CanvasRenderingContext2D;

function makeTexture(
  scene: Scene, name: string, width: number, height: number, draw: (ctx: Ctx, w: number, h: number) => void,
  options: { alpha?: boolean; mips?: boolean; aniso?: number } = {}
): DynamicTexture {
  const texture = new DynamicTexture(name, { width, height }, scene, options.mips ?? true);
  const ctx = texture.getContext() as unknown as Ctx;
  draw(ctx, width, height);
  texture.update();
  if (options.alpha) texture.hasAlpha = true;
  if (options.aniso) texture.anisotropicFilteringLevel = options.aniso;
  return texture;
}

/** One arching fern frond. Stem at the bottom centre, tip at the top. */
export function createFrondTexture(scene: Scene): DynamicTexture {
  return makeTexture(scene, "fern-frond", 256, 512, (ctx, w, h) => {
    const R = mulberry32(101);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    ctx.strokeStyle = "#2f5f27";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, h - 2);
    ctx.quadraticCurveTo(cx + 2, h * .5, cx, h * .025);
    ctx.stroke();
    const leaflets = 28;
    for (let i = 0; i < leaflets; i++) {
      const t = i / (leaflets - 1);
      const y = h * (.965 - t * .91);
      const span = w * .485 * Math.sin(Math.PI * (.1 + .8 * Math.pow(t, .7))) * (1 - t * .3);
      const lift = span * (.5 - t * .12);
      const thick = 7 + span * .1;
      for (const side of [-1, 1]) {
        const tipX = cx + side * span;
        const tipY = y - lift;
        const gradient = ctx.createLinearGradient(cx, y, tipX, tipY);
        const hue = 92 + R() * 20;
        gradient.addColorStop(0, `hsl(${hue}, 50%, 24%)`);
        gradient.addColorStop(.55, `hsl(${hue + 4}, 46%, 40%)`);
        gradient.addColorStop(1, `hsl(${hue + 10}, 50%, ${54 + R() * 8}%)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.quadraticCurveTo(cx + side * span * .5, y - lift * .5 - thick, tipX, tipY);
        ctx.quadraticCurveTo(cx + side * span * .55, y - lift * .35 + thick * .55, cx, y + 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#6fa845";
    ctx.beginPath();
    ctx.moveTo(cx, h * .02);
    ctx.quadraticCurveTo(cx + 9, h * .06, cx, h * .125);
    ctx.quadraticCurveTo(cx - 9, h * .06, cx, h * .02);
    ctx.fill();
  }, { alpha: true });
}

/** A dense scatter of leaves, lighter toward the top so foliage looks sun-lit. */
export function createLeafTexture(scene: Scene): DynamicTexture {
  return makeTexture(scene, "leaf-cluster", 256, 256, (ctx, w, h) => {
    const R = mulberry32(202);
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const angle = R() * Math.PI * 2;
      const radius = Math.sqrt(R()) * w * .4;
      const x = w / 2 + Math.cos(angle) * radius;
      const y = h / 2 + Math.sin(angle) * radius;
      const length = w * (.15 + R() * .1);
      const width = length * .42;
      const lightness = 27 + (1 - radius / (w * .4)) * 8 + (y < h / 2 ? 10 : 0) + R() * 12;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(R() * Math.PI * 2);
      ctx.fillStyle = `hsl(${86 + R() * 30}, ${44 + R() * 12}%, ${lightness}%)`;
      ctx.beginPath();
      ctx.moveTo(-length / 2, 0);
      ctx.quadraticCurveTo(0, -width, length / 2, 0);
      ctx.quadraticCurveTo(0, width, -length / 2, 0);
      ctx.fill();
      ctx.strokeStyle = `hsla(${88 + R() * 20}, 45%, ${lightness + 14}%, .55)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-length / 2, 0);
      ctx.lineTo(length / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
  }, { alpha: true });
}

export function createGrassTexture(scene: Scene): DynamicTexture {
  return makeTexture(scene, "grass-tuft", 128, 256, (ctx, w, h) => {
    const R = mulberry32(303);
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 17; i++) {
      const baseX = w / 2 + (R() - .5) * w * .55;
      const tipX = baseX + (R() - .5) * w * .7;
      const tipY = h * (.04 + R() * .5);
      const half = 4 + R() * 4;
      const gradient = ctx.createLinearGradient(baseX, h, tipX, tipY);
      const hue = 82 + R() * 28;
      gradient.addColorStop(0, `hsl(${hue}, 48%, 26%)`);
      gradient.addColorStop(1, `hsl(${hue + 6}, 52%, ${46 + R() * 16}%)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(baseX - half, h);
      ctx.quadraticCurveTo(baseX - half * .3, h * .55, tipX, tipY);
      ctx.quadraticCurveTo(baseX + half * .6, h * .55, baseX + half, h);
      ctx.fill();
    }
  }, { alpha: true });
}

export function createFlowerTexture(scene: Scene): DynamicTexture {
  return makeTexture(scene, "wild-flowers", 128, 128, (ctx, w, h) => {
    const R = mulberry32(404);
    ctx.clearRect(0, 0, w, h);
    const heads: Array<[number, number, string]> = [
      [.28, .3, "#f8f4e6"], [.62, .2, "#f1b9c9"], [.78, .46, "#f8f4e6"], [.45, .52, "#f6efe0"]
    ];
    for (const [fx, fy, petal] of heads) {
      const x = fx * w, y = fy * h;
      ctx.strokeStyle = "#3d7230";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(w * (.35 + R() * .3), h);
      ctx.quadraticCurveTo(w * .5, h * .7, x, y);
      ctx.stroke();
      ctx.fillStyle = "#4b8a36";
      ctx.beginPath();
      ctx.ellipse(x + (R() - .5) * 16, y + h * .22, 7, 3, R() * 3, 0, Math.PI * 2);
      ctx.fill();
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        ctx.fillStyle = petal;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * 6.5, y + Math.sin(a) * 6.5, 6, 3.4, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#f2c94a";
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { alpha: true });
}

/** Soft radial dot for pollen and firefly particles. */
export function createGlowDotTexture(scene: Scene): DynamicTexture {
  return makeTexture(scene, "glow-dot", 64, 64, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(.35, "rgba(255,255,255,.45)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }, { alpha: true, mips: false });
}

/** Vertical light shaft: soft edges, fading toward the lower end. */
export function createLightShaftTexture(scene: Scene): DynamicTexture {
  return makeTexture(scene, "light-shaft", 64, 256, (ctx, w, h) => {
    const image = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1); // 0 at the lower (ground) end
      const along = smoothstep(0, .12, v) * Math.pow(smoothstep(0, 1, 1 - Math.abs(v - .55) / .55), .8);
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        const across = Math.pow(Math.sin(Math.PI * u), 1.7);
        const i = (y * w + x) * 4;
        image.data[i] = 255; image.data[i + 1] = 255; image.data[i + 2] = 255;
        image.data[i + 3] = clamp01(along * across) * 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }, { alpha: true, mips: false });
}

export function createBarkTexture(scene: Scene): DynamicTexture {
  return makeTexture(scene, "bark", 128, 256, (ctx, w, h) => {
    const R = mulberry32(505);
    ctx.fillStyle = "#6b533c";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 170; i++) {
      const x = R() * w;
      const y = R() * h;
      ctx.strokeStyle = R() > .5 ? "rgba(36,24,15,.55)" : "rgba(150,122,90,.35)";
      ctx.lineWidth = 1 + R() * 2.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (R() - .5) * 6, y + 30 + R() * 130);
      ctx.stroke();
    }
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(70,110,52,${.12 + R() * .2})`;
      ctx.beginPath();
      ctx.ellipse(R() * w, h * (.55 + R() * .45), 10 + R() * 18, 6 + R() * 12, R() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function createThatchTexture(scene: Scene): DynamicTexture {
  return makeTexture(scene, "thatch", 256, 128, (ctx, w, h) => {
    const R = mulberry32(606);
    ctx.fillStyle = "#8a7848";
    ctx.fillRect(0, 0, w, h);
    const straw = ["#b09a5c", "#7d6c3e", "#c2ad70", "#665a33", "#9a8650"];
    for (let i = 0; i < 520; i++) {
      ctx.strokeStyle = straw[Math.floor(R() * straw.length)];
      ctx.globalAlpha = .4 + R() * .5;
      ctx.lineWidth = 1 + R() * 1.6;
      const y = R() * h;
      const x = R() * w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 18 + R() * 55, y + (R() - .5) * 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = `rgba(78,112,52,${.15 + R() * .22})`;
      ctx.beginPath();
      ctx.ellipse(R() * w, R() * h, 12 + R() * 28, 5 + R() * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function createPlankTexture(scene: Scene): DynamicTexture {
  return makeTexture(scene, "wood-planks", 256, 256, (ctx, w, h) => {
    const R = mulberry32(707);
    const planks = 6;
    const planWidth = w / planks;
    for (let p = 0; p < planks; p++) {
      const tone = 105 + Math.floor(R() * 40);
      ctx.fillStyle = `rgb(${tone + 26}, ${tone - 6}, ${tone - 46})`;
      ctx.fillRect(p * planWidth, 0, planWidth, h);
      for (let g = 0; g < 26; g++) {
        ctx.strokeStyle = R() > .5 ? "rgba(60,38,20,.35)" : "rgba(210,170,120,.22)";
        ctx.lineWidth = .7 + R() * 1.3;
        const x = p * planWidth + R() * planWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + (R() - .5) * 8, h * .3, x + (R() - .5) * 8, h * .7, x + (R() - .5) * 4, h);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(35,22,12,.75)";
      ctx.fillRect(p * planWidth, 0, 2, h);
      ctx.fillStyle = "rgba(30,20,12,.7)";
      for (const ny of [h * .12, h * .88]) {
        ctx.beginPath();
        ctx.arc(p * planWidth + planWidth / 2, ny, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

export function createRockTexture(scene: Scene): DynamicTexture {
  return makeTexture(scene, "mossy-rock", 128, 128, (ctx, w, h) => {
    const image = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = fbm(x * .07, y * .07, 4, 9);
        const crack = Math.abs(fbm(x * .05 + 40, y * .05, 3, 4) - .5) < .02 ? .55 : 1;
        const moss = smoothstep(.55, .75, fbm(x * .05 + 7, y * .05 + 3, 3, 12));
        const grey = (.42 + n * .34) * crack;
        const i = (y * w + x) * 4;
        image.data[i] = (grey * (1 - moss * .45) + moss * .08) * 255;
        image.data[i + 1] = (grey * (1 - moss * .1) + moss * .2) * 255;
        image.data[i + 2] = (grey * (1 - moss * .45) + moss * .06) * 255;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  });
}

export function createClothTexture(scene: Scene, name: string, base: string, stripe: string): DynamicTexture {
  return makeTexture(scene, name, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = stripe;
    ctx.fillRect(0, h * .78, w, h * .06);
    ctx.fillRect(0, h * .9, w, h * .03);
    ctx.strokeStyle = "rgba(0,0,0,.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,.07)";
    for (let i = 0; i < h; i += 4) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }
  });
}

/** Large baked albedo for the whole playable terrain. */
export function createGroundAlbedo(
  scene: Scene, bounds: TerrainBounds, pathCenter: (z: number) => number, size = 2048
): DynamicTexture {
  return makeTexture(scene, "forest-ground-albedo", size, size, (ctx) => {
    const pixels = paintGroundPixels(size, bounds, pathCenter);
    const image = ctx.createImageData(size, size);
    image.data.set(pixels);
    ctx.putImageData(image, 0, 0);
  }, { aniso: 8 });
}

/** Small tileable normal map that gives the baked albedo micro relief. */
export function createGroundNormalMap(scene: Scene, size = 256): DynamicTexture {
  return makeTexture(scene, "forest-ground-normal", size, size, (ctx) => {
    const image = ctx.createImageData(size, size);
    image.data.set(buildTileableNormalMap(size));
    ctx.putImageData(image, 0, 0);
  }, { aniso: 4 });
}

/**
 * Tiled fine-grain layer for Babylon's detail map: red modulates the albedo,
 * green/blue carry a tangent-space normal. Tiled ~1 m so the ground stays
 * sharp up close where the single baked albedo would be magnified and blurry.
 */
export function createGroundDetailTexture(scene: Scene, size = 256): DynamicTexture {
  return makeTexture(scene, "forest-ground-detail", size, size, (ctx) => {
    const normals = buildTileableNormalMap(size, 3.2, 8);
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const grain = tileableHeight(x, y, size, 19);
        image.data[i] = (.5 + (grain - .5) * .8) * 255;
        image.data[i + 1] = normals[i];
        image.data[i + 2] = normals[i + 1];
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }, { aniso: 8 });
}
