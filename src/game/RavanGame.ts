import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, Engine,
  HemisphericLight, Scene, ShadowGenerator, Vector3
} from "@babylonjs/core";
import { LocalSession } from "./LocalSession";
import { createPlayer, type PlayerAvatar } from "./Player";
import { createForestVillage, type ForestVillage, groundHeight } from "./World";
import { loadOriginalGameArt } from "./GameArtAssets";

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
export class RavanGame {
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  private player: PlayerAvatar;
  private world: ForestVillage;
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

  constructor(canvas: HTMLCanvasElement, private callbacks: GameCallbacks) {
    this.engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false }, true);
    this.engine.setHardwareScalingLevel(Math.min(1.5, Math.max(1, window.devicePixelRatio / 1.5)));
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(.69, .79, .75, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = .0048;
    this.scene.imageProcessingConfiguration.contrast = 1.16;
    this.scene.fogColor = new Color3(.69, .79, .75);
    this.ambient = new HemisphericLight("sky-ambient", new Vector3(0, 1, 0), this.scene);
    this.ambient.intensity = .95;
    this.ambient.diffuse = new Color3(.85, .93, .88);
    this.sun = new DirectionalLight("golden-sun", new Vector3(-.45, -1, .35), this.scene);
    this.sun.position.set(35, 75, -35);
    this.sun.intensity = 2.3;
    this.sun.diffuse = new Color3(1, .91, .73);
    const shadows = new ShadowGenerator(512, this.sun);
    shadows.useBlurExponentialShadowMap = true;
    shadows.blurKernel = 12;

    this.world = createForestVillage(this.scene, shadows);
    // Optional original GLB models load after the procedural scene is ready.
    void loadOriginalGameArt(this.scene, shadows, this.world, () => !this.disposed)
      .then((count) => { if (!this.disposed) this.artModels = count; })
      .catch((error: unknown) => {
        console.warn("SL Ravan: optional authored game art could not be loaded", error);
      });
    this.player = createPlayer(this.scene, shadows);
    this.camera = new ArcRotateCamera("third-person", -Math.PI / 2, 1.14, 12, new Vector3(0, 1.5, -45), this.scene);
    this.camera.lowerRadiusLimit = 5;
    this.camera.upperRadiusLimit = 22;
    this.camera.lowerBetaLimit = .55;
    this.camera.upperBetaLimit = 1.48;
    this.camera.wheelDeltaPercentage = .02;
    this.camera.panningSensibility = 0;
    this.camera.attachControl(canvas, true);
    this.scene.activeCamera = this.camera;

    try { if (typeof window !== "undefined") this.session = new LocalSession(window.localStorage); } catch { /* Storage may be unavailable. */ }
    const save = this.session?.load();
    const x = save?.position.x ?? 0;
    const z = save?.position.z ?? -45;
    this.player.root.position.set(x, groundHeight(x, z), z);
    this.camera.target.set(x, groundHeight(x, z) + 1.45, z);
    this.shrineFound = save?.discoveredShrine ?? false;
    if (save?.night) this.setNight(true);

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
    this.night = value;
    this.sun.intensity = value ? .23 : 2.3;
    this.sun.diffuse = value ? new Color3(.49, .61, .9) : new Color3(1, .91, .73);
    this.ambient.intensity = value ? .38 : .95;
    this.scene.clearColor = value ? new Color4(.065, .104, .17, 1) : new Color4(.69, .79, .75, 1);
    this.scene.fogColor = value ? new Color3(.08, .13, .20) : new Color3(.69, .79, .75);
    this.world.setNight(value);
    this.save();
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
      let diff = (targetRotation - this.player.root.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI;
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
    this.saveTime += dt;
    if (this.saveTime > 12) { this.saveTime = 0; this.save(); }
  }

  private render = () => {
    if (this.disposed) return;
    const dt = Math.min(.05, this.engine.getDeltaTime() / 1000);
    if (!this.paused) this.update(dt);
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
    this.scene.dispose();
    this.engine.dispose();
  }
}
