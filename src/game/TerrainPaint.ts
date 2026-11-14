import { fbm, hash2, lerp, smoothstep, valueNoise } from "./Noise";

/**
 * Pure ground-albedo painter. The terrain is shaded with ONE large baked
 * texture generated from the same path function the gameplay uses, so the
 * painted dirt trail always lines up with the 3D world.
 *
 * Texture convention: canvas row 0 is the north (maxZ) edge, column 0 is minX.
 *
 * Performance: the large-scale colour fields (grass patches, moss, dry grass,
 * dirt tone) vary slowly, so they are sampled on a coarse grid and bilinearly
 * interpolated. Only fine grain, specks and the trail edge are per-pixel.
 */
export interface TerrainBounds { minX: number; maxX: number; minZ: number; maxZ: number }
export type RGB = [number, number, number];

const GRASS_DARK: RGB = [.12, .29, .14];
const GRASS_MID: RGB = [.22, .45, .16];
const GRASS_LIGHT: RGB = [.42, .62, .22];
const GRASS_DRY: RGB = [.56, .58, .25];
const MOSS: RGB = [.15, .37, .22];
const DIRT_DARK: RGB = [.33, .23, .14];
const DIRT_LIGHT: RGB = [.58, .44, .28];
const TRAMPLED: RGB = [.45, .40, .20];
const OUTER_TINT: RGB = [.12, .26, .17];
const PEBBLE: RGB = [.64, .62, .56];
const CLOVER: RGB = [.92, .92, .82];
const LITTER: RGB[] = [[.66, .40, .13], [.46, .27, .10], [.72, .60, .20]];

/** Number of floats in a low-frequency sample: grass RGB then dirt RGB. */
const LF = 6;

function lowFrequency(x: number, z: number, out: Float32Array, o: number) {
  const broad = fbm(x * .045 + 11, z * .045 + 5, 3, 1);
  const mid = fbm(x * .22, z * .22, 3, 2);
  const dry = smoothstep(.62, .85, fbm(x * .09 + 40, z * .09 + 9, 2, 4)) * .45;
  const moss = smoothstep(.55, .8, fbm(x * .15 - 30, z * .15 + 70, 2, 5)) * .5;
  const toLight = smoothstep(.45, .8, mid) * .7;
  const toMid = smoothstep(.25, .7, broad);
  const toDirt = smoothstep(.3, .75, mid);
  for (let c = 0; c < 3; c++) {
    let v = lerp(GRASS_DARK[c], GRASS_MID[c], toMid);
    v = lerp(v, GRASS_LIGHT[c], toLight);
    v = lerp(v, GRASS_DRY[c], dry);
    v = lerp(v, MOSS[c], moss);
    out[o + c] = v;
    out[o + 3 + c] = lerp(DIRT_DARK[c], DIRT_LIGHT[c], toDirt);
  }
}

/** Fine per-pixel grain in [0, 1]; `speck` is the per-cell hash reused as jitter. */
function fineGrain(x: number, z: number, speck: number): number {
  return valueNoise(x * 2.1, z * 2.1, 3) * .78 + speck * .22;
}

/**
 * Final colour for one point, given its low-frequency sample.
 * `centre` is the trail centre line at this z and `jag` its ragged edge offset.
 */
function shadeGround(
  lf: ArrayLike<number>, x: number, z: number, centre: number, jag: number, out: Float32Array, o: number
) {
  const cellX = Math.floor(x * 9);
  const cellZ = Math.floor(z * 9);
  const speck = hash2(cellX, cellZ, 7);
  const fine = fineGrain(x, z, speck);
  const d = Math.abs(x - centre);

  const gShade = .86 + fine * .28;
  const pathMask = 1 - smoothstep(2.3 + jag, 3.1 + jag, d);
  const fringe = (1 - smoothstep(3.0 + jag, 5.2 + jag, d)) * (1 - pathMask) * .5;
  const nearTrail = pathMask > 0 || fringe > 0;
  const dShade = nearTrail ? (.88 + fine * .3) * (1 - Math.exp(-(((d - 1.05) / .28) ** 2)) * .28) : 1;

  const clover = speck > .985;
  const pebble = speck > .93;
  const litter = speck > .955 && d < 14
    ? LITTER[Math.floor(hash2(cellX, cellZ, 11) * LITTER.length)]
    : null;
  const outer = smoothstep(46, 95, Math.abs(x));
  const outerShade = 1 - outer * .18;

  for (let c = 0; c < 3; c++) {
    let v = lf[c] * gShade;
    if (clover) v = lerp(v, CLOVER[c], .55);
    if (nearTrail) {
      let dirt = lf[3 + c] * dShade;
      if (pebble) dirt = lerp(dirt, PEBBLE[c], .5);
      v = lerp(v, dirt, pathMask);
      v = lerp(v, lerp(lf[c] * gShade, TRAMPLED[c], .5), fringe);
    }
    if (litter) v = lerp(v, litter[c], .7);
    out[o + c] = lerp(v, OUTER_TINT[c], outer * .3) * outerShade;
  }
}

/** Reference implementation for a single point (exact, un-interpolated). */
export function groundColorAt(x: number, z: number, pathCenter: (z: number) => number): RGB {
  const lf = new Float32Array(LF);
  lowFrequency(x, z, lf, 0);
  const centre = pathCenter(z) - Math.sin(z * .51) * .38;
  const jag = Math.sin(x * 1.8 + z * .4) * .27 + Math.sin(z * 2.3) * .16;
  const out = new Float32Array(3);
  shadeGround(lf, x, z, centre, jag, out, 0);
  return [out[0], out[1], out[2]];
}

export function paintGroundPixels(
  size: number,
  bounds: TerrainBounds,
  pathCenter: (z: number) => number
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxZ - bounds.minZ;

  // Coarse grid of low-frequency samples (one node every `step` pixels).
  const step = 8;
  const nodes = Math.ceil(size / step) + 1;
  const grid = new Float32Array(nodes * nodes * LF);
  for (let gy = 0; gy < nodes; gy++) {
    const z = bounds.maxZ - (gy * step / size) * height;
    for (let gx = 0; gx < nodes; gx++) {
      const x = bounds.minX + (gx * step / size) * width;
      lowFrequency(x, z, grid, (gy * nodes + gx) * LF);
    }
  }

  // Per-column trig for the jagged trail edge: sin(a + b) = sin a cos b + cos a sin b.
  const xs = new Float32Array(size);
  const sinX = new Float32Array(size);
  const cosX = new Float32Array(size);
  for (let px = 0; px < size; px++) {
    xs[px] = bounds.minX + ((px + .5) / size) * width;
    sinX[px] = Math.sin(xs[px] * 1.8);
    cosX[px] = Math.cos(xs[px] * 1.8);
  }

  const lf = new Float32Array(LF);
  const rgb = new Float32Array(3);
  for (let py = 0; py < size; py++) {
    const z = bounds.maxZ - ((py + .5) / size) * height;
    const centre = pathCenter(z) - Math.sin(z * .51) * .38;
    const rowJag = Math.sin(z * 2.3) * .16;
    const sinZ = Math.sin(z * .4);
    const cosZ = Math.cos(z * .4);
    const gy = py / step;
    const gy0 = Math.min(nodes - 2, Math.floor(gy));
    const fy = gy - gy0;
    for (let px = 0; px < size; px++) {
      const gx = px / step;
      const gx0 = Math.min(nodes - 2, Math.floor(gx));
      const fx = gx - gx0;
      const a = (gy0 * nodes + gx0) * LF;
      const b = a + LF;
      const c = a + nodes * LF;
      const d = c + LF;
      for (let k = 0; k < LF; k++) {
        lf[k] = lerp(lerp(grid[a + k], grid[b + k], fx), lerp(grid[c + k], grid[d + k], fx), fy);
      }
      const jag = (sinX[px] * cosZ + cosX[px] * sinZ) * .27 + rowJag;
      shadeGround(lf, xs[px], z, centre, jag, rgb, 0);
      const i = (py * size + px) * 4;
      data[i] = rgb[0] * 255;
      data[i + 1] = rgb[1] * 255;
      data[i + 2] = rgb[2] * 255;
      data[i + 3] = 255;
    }
  }
  return data;
}
