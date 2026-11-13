import { useEffect, useRef, useState } from "react";
import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, Engine,
  HemisphericLight, MeshBuilder, Scene, SceneLoader,
  StandardMaterial, Vector3
} from "@babylonjs/core";

const ASSETS = {
  proxy: import.meta.env.BASE_URL + "assets/generated/heritage-tree.glb",
  hero: import.meta.env.BASE_URL + "assets/visual-slice/vegetation/hero-tree.glb",
  candidate: import.meta.env.BASE_URL + "assets/visual-slice/candidates/jacaranda/model.gltf"
};
type Selection = "proxy" | "hero" | "candidate" | "local";
interface ViewStats { fps: number; triangles: number; nodes: number; height: number }
const INITIAL: ViewStats = { fps: 0, triangles: 0, nodes: 0, height: 0 };

/**
 * A separate, optional GLB inspection scene. Does not alter local saves,
 * gameplay controller, or the working forest environment.
 */
export default function AssetLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const camera = useRef<ArcRotateCamera | null>(null);
  const blob = useRef<string | null>(null);
  const [source, setSource] = useState<Selection>("proxy");
  const [assetUrl, setAssetUrl] = useState(ASSETS.proxy);
  const [status, setStatus] = useState("Preparing the 3D asset viewer...");
  const [error, setError] = useState("");
  const [stats, setStats] = useState<ViewStats>(INITIAL);
  const [wireframe, setWireframe] = useState(false);
  const [fileLabel, setFileLabel] = useState("");

  useEffect(() => {
    if (!canvas.current) return;
    let disposed = false;
    let engine: Engine | null = null;
    let scene: Scene | null = null;
    let frameCount = 0;
    const view = canvas.current;
    const resize = () => engine?.resize();
    const init = async () => {
      try {
        engine = new Engine(view, true, { stencil: true, preserveDrawingBuffer: false }, true);
        scene = new Scene(engine);
        scene.clearColor = new Color4(.105, .14, .135, 1);
        scene.imageProcessingConfiguration.contrast = 1.12;
        const ambient = new HemisphericLight("studio-skylight", new Vector3(0, 1, 0), scene);
        ambient.intensity = 1.22;
        ambient.diffuse = new Color3(.86, .94, 1.0);
        ambient.groundColor = new Color3(.25, .25, .21);
        const sun = new DirectionalLight("studio-sun", new Vector3(-.5, -1, .38), scene);
        sun.intensity = 2;
        sun.diffuse = new Color3(1, .91, .74);
        sun.position.set(25, 40, -20);
        const ground = MeshBuilder.CreateGround("studio-ground", { width: 120, height: 120 }, scene);
        const floor = new StandardMaterial("studio-floor-mat", scene);
        floor.diffuseColor = new Color3(.25, .29, .26);
        floor.specularColor = Color3.Black();
        ground.material = floor;
        const orbit = new ArcRotateCamera("studio-orbit", -.6 * Math.PI, 1.16, 13, new Vector3(0, 3, 0), scene);
        orbit.lowerRadiusLimit = 1.1;
        orbit.upperRadiusLimit = 80;
        orbit.lowerBetaLimit = .15;
        orbit.upperBetaLimit = Math.PI / 2 - .04;
        orbit.wheelDeltaPercentage = .015;
        orbit.attachControl(view, true);
        scene.activeCamera = orbit;
        camera.current = orbit;
        window.addEventListener("resize", resize);
        engine.runRenderLoop(() => {
          if(disposed || !scene || !engine)return;
          scene.render();
          if(++frameCount % 30 === 0) {
            setStats(previous => ({ ...previous, fps: Math.round(engine!.getFps()),
              triangles: Math.round(scene!.getActiveIndices() / 3) }));
          }
        });
        // glTF loader is lazy, avoiding an additional dependency in the launcher.
        await import("@babylonjs/loaders/glTF/2.0");
        if(disposed || !scene)return;
        setStatus("Importing GLB geometry and materials...");
        const lastSlash = assetUrl.lastIndexOf("/");
        const rootUrl = assetUrl.startsWith("blob:") ? "" : assetUrl.slice(0, lastSlash + 1);
        const filename = assetUrl.startsWith("blob:") ? assetUrl : assetUrl.slice(lastSlash + 1);
        const extension = filename.toLowerCase().endsWith(".gltf") ? ".gltf" : ".glb";
        const imported = await SceneLoader.ImportMeshAsync(null, rootUrl, filename, scene, undefined, extension);
        if(disposed) {
          imported.meshes.forEach(m => m.dispose(false, true));
          return;
        }
        const meshes = imported.meshes;
        let lower = new Vector3(Infinity, Infinity, Infinity);
        let upper = new Vector3(-Infinity, -Infinity, -Infinity);
        for(const mesh of meshes) {
          if(mesh.getTotalVertices() === 0)continue;
          mesh.computeWorldMatrix(true);
          const bounds = mesh.getBoundingInfo().boundingBox;
          lower = Vector3.Minimize(lower, bounds.minimumWorld);
          upper = Vector3.Maximize(upper, bounds.maximumWorld);
          if(mesh.material) mesh.material.wireframe = wireframe;
        }
        if(!Number.isFinite(lower.y))throw Error("GLB has no renderable mesh geometry");
        const height = Math.max(.3, upper.y - lower.y);
        const center = lower.add(upper).scale(.5);
        const root = meshes[0];
        root.position.addInPlace(new Vector3(-center.x, -lower.y, -center.z));
        orbit.target.set(0, height * .48, 0);
        orbit.radius = Math.max(3, height * 1.7);
        setStats(prev => ({ ...prev, height, nodes: meshes.length }));
        setStatus("GLB loaded successfully. Drag to orbit; scroll to zoom.");
      } catch (err) {
        if(!disposed){
          const message = err instanceof Error ? err.message : String(err);
          console.error("[SL Ravan Art Lab] Preview failed", err);
          setError(message);
          setStatus("Unable to inspect this GLB.");
        }
      }
    };
    void init();
    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      camera.current = null;
      engine?.stopRenderLoop();
      scene?.dispose();
      engine?.dispose();
    };
  }, [assetUrl, wireframe]);

  useEffect(() => () => {
    if(blob.current)URL.revokeObjectURL(blob.current);
  }, []);

  function switchSource(next: "proxy" | "hero" | "candidate") {
    setSource(next);
    setError("");
    setStats(INITIAL);
    setAssetUrl(ASSETS[next]);
  }

  function upload(file?: File) {
    if(!file)return;
    if(!file.name.toLowerCase().endsWith(".glb") || file.size < 20 || file.size > 80 * 1024 * 1024) {
      setError("Choose a self-contained .glb file smaller than 80 MiB.");
      return;
    }
    const old = blob.current;
    const url = URL.createObjectURL(file);
    blob.current = url;
    setSource("local");
    setFileLabel(file.name);
    setStats(INITIAL);
    setError("");
    setAssetUrl(url);
    if(old)URL.revokeObjectURL(old);
  }

  return (
    <div className="artlab">
      <div className="artlab-viewport">
        <canvas ref={canvas} tabIndex={0} aria-label="Three dimensional model preview"/>
        <div className="artlab-overlay">SL RAVAN / ART LAB</div>
        <div className="artlab-metrics">{stats.fps} FPS · {stats.triangles.toLocaleString()} triangles</div>
      </div>
      <section className="artlab-panel">
        <a className="artlab-back" href="/">← Return to game</a>
        <p className="artlab-eyebrow">FOREST VILLAGE · GATE A</p>
        <h1>Visual Asset Studio</h1>
        <p>Inspect detailed tree models in isolation before replacing the playable village scenery.</p>
        <fieldset>
          <legend>Model</legend>
          <label><input type="radio" name="asset" checked={source==="proxy"} onChange={()=>switchSource("proxy")}/> Current procedural tree (comparison)</label>
          <label><input type="radio" name="asset" checked={source==="hero"} onChange={()=>switchSource("hero")}/> Approved local hero GLB</label>
          <label><input type="radio" name="asset" checked={source==="candidate"} onChange={()=>switchSource("candidate")}/> Poly Haven Jacaranda candidate (after download)</label>
        </fieldset>
        <label className="artlab-file">
          <strong>Preview a local GLB file</strong>
          <small>Self-contained GLB · Maximum 80 MiB</small>
          <input type="file" accept=".glb,model/gltf-binary" onChange={event=>upload(event.target.files?.[0])}/>
        </label>
        {source === "local" && <p>Local model: {fileLabel}</p>}
        <label className="artlab-option"><input type="checkbox" checked={wireframe} onChange={event=>setWireframe(event.target.checked)}/> Wireframe inspection</label>
        <button onClick={()=>{if(camera.current){camera.current.alpha=-.6*Math.PI;camera.current.beta=1.16;}}}>Reset camera angle</button>
        <div className="artlab-status" role="status">
          {status}
          {stats.nodes > 0 && <span> Nodes: {stats.nodes} · Height: {stats.height.toFixed(2)} source units</span>}
          {error && <code>{error}</code>}
        </div>
        <small className="artlab-disclaimer">An imported model is not automatically licensed, optimized, or approved for the game. Record its source and verify it before production use.</small>
      </section>
    </div>
  );
}
