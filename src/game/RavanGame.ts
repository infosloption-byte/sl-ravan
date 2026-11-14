import {
  ArcRotateCamera, CascadedShadowGenerator, DirectionalLight, Engine,
  HemisphericLight, Scene, ShadowGenerator, Vector3
} from "@babylonjs/core";
import { LocalSession } from "./LocalSession";
import { createPlayer, type PlayerAvatar } from "./Player";
import { createForestVillage, type ForestVillage, groundHeight, pathCenter } from "./World";
import { loadOriginalGameArt } from "./GameArtAssets";
import { createAtmosphere, type Atmosphere, type ShaftAnchor } from "./Atmosphere";

export interface GameStats {
  fps: number;
  position: { x: number; z: number };
  location: string;
  nearby: string | null;
  artModels: number;
}
interface GameCallbacks {
  onReady: () => void;
  onStats: (stats: GameStats) => void;
  onNotice: (text: string) => void;
  onEscape: () => void;
}

const BASE_FOV = .95;
const SPRINT_FOV = 1.04;

export class RavanGame {
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  private player: PlayerAvatar;
  private world: ForestVillage;
  private atmosphere: Atmosphere;
  private sun: DirectionalLight;
  private ambient: HemisphericLight;
  private session: LocalSession | null = null;
  private pressed = new Set<string>();
  private paused = true;
  private night = false;
  private shrineFound = false;
  private artModels = 0;
  private jumpVelocity = 0;
  private heightOffset = 0;
  private statsTime = 0;
  private saveTime = 0;
  private disposed = false;
  // Adaptive resolution: if the frame rate stays low the render scale is reduced.
  private renderScale = 1;
  private perfTime = 0;
  private perfFrames = 0;
  private perfWarmup = 0;

  constructor(canvas: HTMLCanvasElement, private callbacks: GameCallbacks) {
    this.engine = new Engine(canvas, true, {
      stencil: true, preserveDrawingBuffer: false, powerPreference: "high-performance"
    }, true);
    this.renderScale = Math.max(1, window.devicePixelRatio / 1.5);
    this.engine.setHardwareScalingLevel(this.renderScale);
    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true;

    // The camera exists first: cascaded shadows and the post-processing stack both need it.
    this.camera = new ArcRotateCamera("third-person", -Math.PI / 2, 1.14, 12, new Vector3(0, 1.5, -45), this.scene);
    this.camera.lowerRadiusLimit = 5;
    this.camera.upperRadiusLimit = 22;
    this.camera.lowerBetaLimit = .55;
    this.camera.upperBetaLimit = 1.48;
    this.camera.wheelDeltaPercentage = .02;
    this.camera.panningSensibility = 0;
    this.camera.minZ = .3;
    this.camera.maxZ = 900;
    this.camera.fov = BASE_FOV;
    this.camera.attachControl(canvas, true);
    this.scene.activeCamera = this.camera;

    // Lower, side-on golden sun: long shadows fall across the trail. The
    // Atmosphere module owns colours/intensities for day and night.
    this.ambient = new HemisphericLight("sky-ambient", new Vector3(0, 1, 0), this.scene);
    this.sun = new DirectionalLight("golden-sun", new Vector3(.7, -.55, .25), this.scene);

    let shadows: ShadowGenerator;
    try {
      const cascaded = new CascadedShadowGenerator(2048, this.sun, undefined, this.camera);
      cascaded.numCascades = 2;
      cascaded.lambda = .75;
      cascaded.shadowMaxZ = 90;
      cascaded.stabilizeCascades = true;
      cascaded.autoCalcDepthBounds = false;
      cascaded.usePercentageCloserFiltering = true;
      cascaded.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      cascaded.bias = .001;
      cascaded.normalBias = .02;
      cascaded.setDarkness(.45);
      shadows = cascaded;
    } catch (error) {
      console.warn("SL Ravan: cascaded shadows unavailable; using a single shadow map", error);
      const basic = new ShadowGenerator(2048, this.sun);
      basic.useBlurExponentialShadowMap = true;
      basic.blurKernel = 12;
      shadows = basic;
    }

    this.world = createForestVillage(this.scene, shadows);
    // Optional original GLB models load after the procedural scene is ready.
    void loadOriginalGameArt(this.scene, shadows, this.world, () => !this.disposed)
      .then((count) => { if (!this.disposed) this.artModels = count; })
      .catch((error: unknown) => {
        console.warn("SL Ravan: optional authored game art could not be loaded", error);
      });
    this.player = createPlayer(this.scene, shadows);

    const shaftAnchors: ShaftAnchor[] = [-70, -45, -20, 5, 30, 60, 85].map((z, i) => {
      const x = pathCenter(z) + 5 + (i % 3) * 3;
      return { x, y: groundHeight(x, z), z };
    });
    this.atmosphere = createAtmosphere(this.scene, this.camera, this.sun, this.ambient, shaftAnchors);

    try { if (typeof window !== "undefined") this.session = new LocalSession(window.localStorage); } catch { /* Storage may be unavailable. */ }
    const save = this.session?.load();
    const x = save?.position.x ?? 0;
    const z = save?.position.z ?? -45;
    this.player.root.position.set(x, groundHeight(x, z), z);
    this.camera.target.set(x, groundHeight(x, z) + 1.45, z);
    this.shrineFound = save?.discoveredShrine ?? false;
    if (save?.night) this.applyNight(true, true);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("beforeunload", this.onBeforeUnload);
    this.engine.runRenderLoop(this.render);
    this.callbacks.onReady();
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const code = event.code;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) event.preventDefault();
    if (code === "Escape") {
      this.setPaused(true);
      this.callbacks.onEscape();
      return;
    }
    this.pressed.add(code);
    if (code === "KeyE" && !event.repeat && !this.paused) this.interact();
  };
  private onKeyUp = (event: KeyboardEvent) => { this.pressed.delete(event.code); };
  private onResize = () => { this.engine.resize(); };
  private onBlur = () => { this.pressed.clear(); };
  private onBeforeUnload = () => { this.save(); };

  private interact() {
    const nearest = this.world.nearestInteraction(this.player.root.position, 3.6);
    if (!nearest) return;
    if (nearest.id === "shrine") {
      this.shrineFound = true;
      this.callbacks.onNotice("The ancient shrine has awakened");
    } else {
      this.callbacks.onNotice(nearest.message);
    }
    this.save();
  }

  setPaused(value: boolean) {
    this.paused = value;
    if (value) this.pressed.clear();
  }

  setNight(value: boolean) {
    this.applyNight(value, false);
    this.save();
  }

  private applyNight(value: boolean, instant: boolean) {
    this.night = value;
    this.atmosphere.setNight(value, instant);
    this.world.setNight(value);
  }

  private update(dt: number) {
    const keys = this.pressed;
    const forward = this.camera.target.subtract(this.camera.position);
    forward.y = 0;
    if (forward.lengthSquared() < .00001) forward.set(0, 0, 1);
    forward.normalize();
    const right = Vector3.Cross(Vector3.Up(), forward).normalize();
    const z = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
    const x = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
    const input = forward.scale(z).add(right.scale(x));
    const moving = input.lengthSquared() > .001;
    const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const p = this.player.root.position;
    if (moving) {
      input.normalize();
      const speed = sprinting ? 8.2 : 4.7;
      const nextX = p.x + input.x * speed * dt;
      const nextZ = p.z + input.z * speed * dt;
      if (!this.world.isBlocked(nextX, p.z)) p.x = Math.max(-94, Math.min(94, nextX));
      if (!this.world.isBlocked(p.x, nextZ)) p.z = Math.max(-103, Math.min(103, nextZ));
      const targetRotation = Math.atan2(input.x, input.z);
      const diff = (targetRotation - this.player.root.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      this.player.root.rotation.y += diff * Math.min(1, dt * 12);
    }
    const grounded = this.heightOffset <= 0.0001;
    if (keys.has("Space") && grounded) this.jumpVelocity = 6.5;
    this.jumpVelocity -= 17 * dt;
    this.heightOffset += this.jumpVelocity * dt;
    if (this.heightOffset < 0) { this.heightOffset = 0; this.jumpVelocity = 0; }
    p.y = groundHeight(p.x, p.z) + this.heightOffset;
    // Visual motion blends locally; gameplay position and jumping remain
    // controlled by the existing game simulation.
    const nowGrounded = this.heightOffset <= .01 && this.jumpVelocity <= 0;
    this.player.updateAnimation(dt, moving, sprinting, nowGrounded);
    this.camera.target = Vector3.Lerp(this.camera.target, p.add(new Vector3(0, 1.55, 0)), Math.min(1, dt * 6));

    // A subtle widening of the field of view sells the sense of speed.
    const wantedFov = moving && sprinting ? SPRINT_FOV : BASE_FOV;
    this.camera.fov += (wantedFov - this.camera.fov) * Math.min(1, dt * 4);

    // Keep the camera above the terrain by tilting it upward instead of clipping into the hill.
    const cam = this.camera.position;
    const minimumY = groundHeight(cam.x, cam.z) + .7;
    if (cam.y < minimumY) {
      this.camera.beta = Math.max(this.camera.lowerBetaLimit ?? .55, this.camera.beta - Math.min((minimumY - cam.y) * .3, .06));
    }

    this.saveTime += dt;
    if (this.saveTime > 12) { this.saveTime = 0; this.save(); }
  }

  /** When the frame rate stays poor: drop effects first, then resolution (capped at 1.5x). */
  private adaptResolution(rawDt: number) {
    this.perfWarmup += rawDt;
    if (this.perfWarmup < 5) return; // ignore shader compilation and texture upload
    this.perfTime += rawDt;
    this.perfFrames++;
    if (this.perfTime < 3) return;
    const fps = this.perfFrames / this.perfTime;
    this.perfTime = 0;
    this.perfFrames = 0;
    if (fps >= 34) return;
    // Drop expensive effects first; only then trade away sharpness.
    if (this.atmosphere.reduceQuality()) return;
    if (this.renderScale < 1.5) {
      this.renderScale = Math.min(1.5, this.renderScale + .25);
      this.engine.setHardwareScalingLevel(this.renderScale);
    }
  }

  private render = () => {
    if (this.disposed) return;
    const rawDt = this.engine.getDeltaTime() / 1000;
    const dt = Math.min(.05, rawDt);
    if (!this.paused) {
      this.update(dt);
      this.adaptResolution(rawDt);
    }
    this.atmosphere.update(dt, this.player.root.position);
    this.scene.render();
    this.statsTime += dt;
    if (this.statsTime > .4) {
      this.statsTime = 0;
      const p = this.player.root.position;
      const nearest = this.world.nearestInteraction(p, 3.6);
      this.callbacks.onStats({
        fps: Math.round(this.engine.getFps()),
        artModels: this.artModels,
        position: { x: p.x, z: p.z },
        location: p.z > 78 ? "The Royal Sanctuary" : p.z > 0 ? "Lanka Forest Settlement" : "The Ancient Forest",
        nearby: nearest ? "Interact · " + nearest.label : null,
      });
    }
  };

  private save() {
    if (!this.session || !this.player) return;
    const p = this.player.root.position;
    this.session.save({
      version: 1,
      position: { x: p.x, y: p.y, z: p.z },
      night: this.night,
      discoveredShrine: this.shrineFound,
    });
  }

  dispose() {
    if (this.disposed) return;
    this.save();
    this.disposed = true;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("beforeunload", this.onBeforeUnload);
    this.engine.stopRenderLoop(this.render);
    this.atmosphere.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
