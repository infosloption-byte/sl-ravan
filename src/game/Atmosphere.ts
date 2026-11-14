import {
  ArcRotateCamera, Axis, Color3, Color4, ColorCurves, DefaultRenderingPipeline, DirectionalLight,
  Effect, Engine, HemisphericLight, ImageProcessingConfiguration, Mesh, MeshBuilder,
  ParticleSystem, Quaternion, Scene, ShaderMaterial, Space, StandardMaterial, Vector3
} from "@babylonjs/core";
import { createGlowDotTexture, createLightShaftTexture } from "./ProceduralTextures";
import { mulberry32 } from "./Noise";

/**
 * Everything that makes the world feel like it has air in it: a procedural
 * sky, atmospheric haze, distant ridges, sun shafts, drifting pollen /
 * fireflies and the cinematic post-processing stack (MSAA, bloom, filmic tone
 * mapping, colour grading, vignette). Day/night changes blend smoothly.
 */

export interface ShaftAnchor { x: number; y: number; z: number }
export interface Atmosphere {
  setNight(night: boolean, instant?: boolean): void;
  update(dt: number, focus: Vector3): void;
  /** Drops one expensive effect. Returns false once nothing is left to drop. */
  reduceQuality(): boolean;
  dispose(): void;
}

interface Palette {
  top: Color3; horizon: Color3; sunGlow: Color3;
  sunLight: Color3; sunIntensity: number;
  ambientSky: Color3; ambientGround: Color3; ambientIntensity: number;
  exposure: number; bloom: number; fogDensity: number;
  hillNear: Color3; hillFar: Color3;
  shafts: number; stars: number; cloud: number;
  pollen: Color4; pollenRate: number;
}

const c3 = (hex: string) => Color3.FromHexString(hex);

const DAY: Palette = {
  top: c3("#4f8fbd"), horizon: c3("#bfd8c6"), sunGlow: c3("#ffe0a0"),
  sunLight: c3("#ffe3b3"), sunIntensity: 2.0,
  ambientSky: c3("#d3ead9"), ambientGround: c3("#7a6844"), ambientIntensity: .98,
  exposure: 1.3, bloom: .3, fogDensity: .0034,
  hillNear: c3("#5f8d73"), hillFar: c3("#86aa9a"),
  shafts: .17, stars: 0, cloud: .75,
  pollen: new Color4(1, .93, .62, .55), pollenRate: 26,
};
const NIGHT: Palette = {
  top: c3("#060c1d"), horizon: c3("#16263a"), sunGlow: c3("#7f98d8"),
  sunLight: c3("#8aa2e8"), sunIntensity: .62,
  ambientSky: c3("#5a74aa"), ambientGround: c3("#0f1a22"), ambientIntensity: .42,
  exposure: .95, bloom: .6, fogDensity: .0072,
  hillNear: c3("#0f2027"), hillFar: c3("#172c38"),
  shafts: 0, stars: 1, cloud: .25,
  pollen: new Color4(.55, 1, .85, .9), pollenRate: 38,
};

const clonePalette = (p: Palette): Palette => ({
  ...p,
  top: p.top.clone(), horizon: p.horizon.clone(), sunGlow: p.sunGlow.clone(),
  sunLight: p.sunLight.clone(), ambientSky: p.ambientSky.clone(), ambientGround: p.ambientGround.clone(),
  hillNear: p.hillNear.clone(), hillFar: p.hillFar.clone(), pollen: p.pollen.clone(),
});

const mixNumber = (a: number, b: number, k: number) => a + (b - a) * k;

function approach(cur: Palette, goal: Palette, k: number) {
  for (const key of ["top", "horizon", "sunGlow", "sunLight", "ambientSky", "ambientGround", "hillNear", "hillFar"] as const) {
    Color3.LerpToRef(cur[key], goal[key], k, cur[key]);
  }
  for (const key of ["sunIntensity", "ambientIntensity", "exposure", "bloom", "fogDensity",
    "shafts", "stars", "cloud", "pollenRate"] as const) {
    cur[key] = mixNumber(cur[key], goal[key], k);
  }
  cur.pollen = new Color4(
    mixNumber(cur.pollen.r, goal.pollen.r, k), mixNumber(cur.pollen.g, goal.pollen.g, k),
    mixNumber(cur.pollen.b, goal.pollen.b, k), mixNumber(cur.pollen.a, goal.pollen.a, k)
  );
}

const SKY_VERTEX = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

const SKY_FRAGMENT = `
precision highp float;
varying vec3 vDir;
uniform vec3 sunDir;
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 sunColor;
uniform float time;
uniform float cloudAmount;
uniform float stars;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec3 d = normalize(vDir);
  float up = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(horizonColor, topColor, pow(up, 0.55));
  col = mix(col, horizonColor, smoothstep(0.03, -0.12, d.y));

  vec2 uv = d.xz / (d.y + 0.28) * 1.7 + vec2(time * 0.004, 0.0);
  float cloud = smoothstep(0.46, 0.82, fbm(uv)) * smoothstep(0.0, 0.3, d.y) * cloudAmount;
  vec3 cloudColor = mix(horizonColor, sunColor, 0.35) + 0.12;
  col = mix(col, cloudColor, cloud * 0.55);

  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 8.0) * 0.22 + pow(s, 220.0) * 0.9 + pow(s, 2500.0) * 4.0);

  vec2 sp = d.xz / (d.y + 1.1) * 220.0;
  float star = step(0.9965, hash(floor(sp))) * smoothstep(0.1, 0.5, d.y) * stars;
  col += vec3(star);
  gl_FragColor = vec4(col, 1.0);
}`;

let shadersRegistered = false;
function registerSkyShader() {
  if (shadersRegistered) return;
  Effect.ShadersStore["slRavanSkyVertexShader"] = SKY_VERTEX;
  Effect.ShadersStore["slRavanSkyFragmentShader"] = SKY_FRAGMENT;
  shadersRegistered = true;
}

export function createAtmosphere(
  scene: Scene,
  camera: ArcRotateCamera,
  sun: DirectionalLight,
  ambient: HemisphericLight,
  shaftAnchors: ShaftAnchor[]
): Atmosphere {
  const random = mulberry32(777);
  const toSun = sun.direction.scale(-1).normalize();
  const current = clonePalette(DAY);
  let goal = DAY;
  let time = 0;
  let quality = 0;

  scene.fogMode = Scene.FOGMODE_EXP2;

  // ---- Sky dome ---------------------------------------------------------
  registerSkyShader();
  const sky = new ShaderMaterial("sl-ravan-sky", scene, "slRavanSky", {
    attributes: ["position"],
    uniforms: ["worldViewProjection", "sunDir", "topColor", "horizonColor", "sunColor", "time", "cloudAmount", "stars"],
  });
  sky.backFaceCulling = false;
  sky.disableDepthWrite = true;
  const dome = MeshBuilder.CreateSphere("sky-dome", { diameter: 1400, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  dome.material = sky;
  dome.infiniteDistance = true;
  dome.isPickable = false;
  dome.applyFog = false;
  sky.setVector3("sunDir", toSun);

  // ---- Distant ridges (fogged by the scene haze for atmospheric depth) ---
  const hillNearMat = new StandardMaterial("ridge-near", scene);
  const hillFarMat = new StandardMaterial("ridge-far", scene);
  for (const m of [hillNearMat, hillFarMat]) {
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
  }
  const hills: Mesh[] = [];
  const ridgeLayer = (
    count: number, radius: number, jitter: number, minH: number, maxH: number,
    minW: number, maxW: number, mat: StandardMaterial
  ) => {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (random() - .5) * .25;
      const r = radius + (random() - .5) * jitter;
      const hill = MeshBuilder.CreateSphere("distant-ridge", { diameter: 1, segments: 8 }, scene);
      const height = minH + random() * (maxH - minH);
      hill.scaling.set(minW + random() * (maxW - minW), height, minW * .9 + random() * (maxW - minW) * .8);
      hill.position.set(Math.cos(angle) * r, -10 + height * .18, Math.sin(angle) * r);
      hill.material = mat;
      hill.isPickable = false;
      hills.push(hill);
    }
  };
  ridgeLayer(18, 300, 60, 50, 90, 110, 180, hillNearMat);
  ridgeLayer(14, 400, 70, 70, 120, 150, 240, hillFarMat);

  // ---- Sun shafts -------------------------------------------------------
  const shaftMat = new StandardMaterial("sun-shaft", scene);
  shaftMat.diffuseColor = Color3.Black();
  shaftMat.specularColor = Color3.Black();
  shaftMat.disableLighting = true;
  shaftMat.opacityTexture = createLightShaftTexture(scene);
  shaftMat.alphaMode = Engine.ALPHA_ADD;
  shaftMat.backFaceCulling = false;
  shaftMat.disableDepthWrite = true;
  const shaftLength = 36;
  const upAxis = toSun.clone();
  const tilt = Quaternion.RotationAxis(
    Vector3.Cross(Axis.Y, upAxis).normalize(), Math.acos(Math.min(1, Vector3.Dot(Axis.Y, upAxis)))
  );
  const shafts: Mesh[] = [];
  for (const anchor of shaftAnchors) {
    for (let k = 0; k < 2; k++) {
      const plane = MeshBuilder.CreatePlane("sun-shaft", { width: 5 + random() * 3, height: shaftLength }, scene);
      plane.position.copyFromFloats(
        anchor.x + toSun.x * shaftLength / 2, anchor.y + toSun.y * shaftLength / 2 - 1, anchor.z + toSun.z * shaftLength / 2
      );
      plane.rotationQuaternion = tilt.clone();
      plane.rotate(Axis.Y, k * Math.PI / 2 + random() * .6, Space.LOCAL);
      plane.material = shaftMat;
      plane.isPickable = false;
      shafts.push(plane);
    }
  }

  // ---- Pollen by day, fireflies by night -------------------------------
  const emitter = new Vector3();
  const motes = new ParticleSystem("pollen-and-fireflies", 700, scene);
  motes.particleTexture = createGlowDotTexture(scene);
  motes.emitter = emitter;
  motes.minEmitBox = new Vector3(-32, .3, -32);
  motes.maxEmitBox = new Vector3(32, 11, 32);
  motes.direction1 = new Vector3(-.25, .06, -.25);
  motes.direction2 = new Vector3(.25, .3, .25);
  motes.minLifeTime = 6;
  motes.maxLifeTime = 11;
  motes.minSize = .05;
  motes.maxSize = .16;
  motes.minEmitPower = .15;
  motes.maxEmitPower = .5;
  motes.gravity = new Vector3(0, .015, 0);
  motes.blendMode = ParticleSystem.BLENDMODE_ADD;
  motes.color1 = current.pollen.clone();
  motes.color2 = current.pollen.clone();
  motes.colorDead = new Color4(1, 1, 1, 0);
  motes.emitRate = current.pollenRate;
  motes.start();

  // ---- Post-processing --------------------------------------------------
  const pipeline = new DefaultRenderingPipeline("sl-ravan-cinematic", true, scene, [camera]);
  pipeline.samples = 4;
  // Scene.getEngine() is typed as AbstractEngine in Babylon 8.
  // webGLVersion exists on the WebGL Engine, not on AbstractEngine/WebGPU.
  const renderEngine = scene.getEngine();
  pipeline.fxaaEnabled = renderEngine instanceof Engine && renderEngine.webGLVersion < 2;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = .8;
  pipeline.bloomKernel = 40;
  pipeline.bloomScale = .5;
  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = .2;
  pipeline.imageProcessingEnabled = true;
  const ip = pipeline.imageProcessing;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.contrast = 1.04;
  ip.vignetteEnabled = true;
  ip.vignetteWeight = .8;
  ip.vignetteStretch = .3;
  ip.vignetteColor = new Color4(.02, .05, .04, 0);
  ip.colorCurvesEnabled = true;
  const curves = new ColorCurves();
  curves.globalSaturation = 8;
  curves.shadowsHue = 185;
  curves.shadowsDensity = 14;
  curves.shadowsSaturation = 18;
  curves.highlightsHue = 48;
  curves.highlightsDensity = 18;
  curves.highlightsSaturation = 24;
  ip.colorCurves = curves;

  function apply() {
    scene.fogColor.copyFrom(current.horizon);
    scene.fogDensity = current.fogDensity;
    scene.clearColor.set(current.horizon.r, current.horizon.g, current.horizon.b, 1);
    ambient.diffuse.copyFrom(current.ambientSky);
    ambient.groundColor.copyFrom(current.ambientGround);
    ambient.intensity = current.ambientIntensity;
    sun.diffuse.copyFrom(current.sunLight);
    sun.intensity = current.sunIntensity;
    ip.exposure = current.exposure;
    pipeline.bloomWeight = current.bloom;
    hillNearMat.emissiveColor.copyFrom(current.hillNear);
    hillFarMat.emissiveColor.copyFrom(current.hillFar);
    shaftMat.emissiveColor.copyFrom(current.sunGlow);
    shaftMat.alpha = current.shafts;
    for (const shaft of shafts) shaft.setEnabled(current.shafts > .01);
    sky.setColor3("topColor", current.top);
    sky.setColor3("horizonColor", current.horizon);
    sky.setColor3("sunColor", current.sunGlow);
    sky.setFloat("cloudAmount", current.cloud);
    sky.setFloat("stars", current.stars);
    motes.color1 = current.pollen;
    motes.color2 = current.pollen;
    motes.emitRate = current.pollenRate;
  }
  apply();

  return {
    setNight(night, instant = false) {
      goal = night ? NIGHT : DAY;
      if (instant) {
        approach(current, goal, 1);
        apply();
      }
    },
    update(dt, focus) {
      time += dt;
      approach(current, goal, 1 - Math.exp(-dt * 2.4));
      apply();
      sky.setFloat("time", time);
      emitter.copyFrom(focus);
    },
    reduceQuality() {
      quality++;
      if (quality === 1) {
        pipeline.samples = 1;
        pipeline.fxaaEnabled = true;
        return true;
      }
      if (quality === 2) {
        pipeline.sharpenEnabled = false;
        pipeline.bloomScale = .25;
        pipeline.bloomKernel = 24;
        return true;
      }
      return false;
    },
    dispose() {
      motes.dispose();
      pipeline.dispose();
      for (const mesh of [dome, ...hills, ...shafts]) mesh.dispose();
      sky.dispose();
    },
  };
}
