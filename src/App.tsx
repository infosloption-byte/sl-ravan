import { useEffect, useRef, useState } from "react";
import { RavanGame, type GameStats } from "./game/RavanGame";

const initialStats: GameStats = {
  fps: 0,
  position: { x: 0, z: 0 },
  location: "The Verdant Approach",
  nearby: null,
};

function Icon({ name }: { name: "sound" | "sun" | "moon" | "map" }) {
  if (name === "sound") return <span aria-hidden="true">♫</span>;
  if (name === "sun") return <span aria-hidden="true">☼</span>;
  if (name === "moon") return <span aria-hidden="true">☾</span>;
  return <span aria-hidden="true">⌖</span>;
}

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<RavanGame | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(true);
  const [night, setNight] = useState(false);
  const [muted, setMuted] = useState(false);
  const [stats, setStats] = useState<GameStats>(initialStats);
  const [notice, setNotice] = useState("Explore the forest village");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!canvas.current) return;
    let disposed = false;
    let instance: RavanGame | null = null;

    try {
      instance = new RavanGame(canvas.current, {
        onReady: () => { if (!disposed) setReady(true); },
        onStats: (next) => { if (!disposed) setStats(next); },
        onNotice: (message) => { if (!disposed) setNotice(message); },
        onEscape: () => {
          if (!disposed) {
            setPaused(true);
            setShowHelp(false);
          }
        },
      });
      game.current = instance;
    } catch (e) {
      if (!disposed) setError(e instanceof Error ? e.message : "Unable to start the 3D engine.");
    }

    return () => {
      disposed = true;
      instance?.dispose();
      if (game.current === instance) game.current = null;
    };
  }, []);

  const start = () => {
    if (!ready) return;
    setStarted(true);
    setPaused(false);
    setShowHelp(false);
    game.current?.setPaused(false);
    canvas.current?.focus();
  };

  const pause = () => {
    setPaused(true);
    game.current?.setPaused(true);
  };

  const resume = () => {
    setPaused(false);
    setShowHelp(false);
    game.current?.setPaused(false);
    canvas.current?.focus();
  };

  const toggleNight = () => {
    game.current?.setNight(!night);
    setNight(!night);
  };

  return (
    <div className="app">
      <canvas ref={canvas} className="game-canvas" tabIndex={0} aria-label="SL Ravan 3D forest village game" />

      <div className="vignette" aria-hidden="true" />
      <header className="topbar">
        <div className="brand"><div className="brand-symbol">✦</div><div><strong>SL RAVAN</strong><small>THE FIRST JOURNEY</small></div></div>
        <div className="topbar-right">
          <span className="prototype-tag">EXPLORATION PROTOTYPE</span>
          <span className="fps"><span className="status-dot" /> {stats.fps} FPS</span>
          {started && <button className="icon-button" aria-label="Pause game" onClick={pause}>Ⅱ</button>}
        </div>
      </header>

      {started && !paused && (
        <>
          <section className="location-label" aria-live="polite">
            <div className="eyebrow">NOW EXPLORING</div>
            <h2>{stats.location}</h2>
            <span>✧ A world waiting to be discovered</span>
          </section>
          <div className="crosshair" aria-hidden="true">·</div>
          <aside className="objective-card">
            <div className="eyebrow">JOURNEY 001 <span className="eyebrow-separator">/</span> FREE EXPLORE</div>
            <h3>{notice}</h3>
            <div className="objective-foot"><span className="diamond">◇</span> Find the glowing shrine</div>
          </aside>
          <div className="interaction" role="status" aria-live="polite">
            {stats.nearby && <><kbd>E</kbd> {stats.nearby}</>}
          </div>
          <aside className="minimap" aria-label="Player coordinates">
            <div className="minimap-grid"><div className="minimap-arrow">▲</div></div>
            <span><Icon name="map" /> {stats.position.x.toFixed(0)}, {stats.position.z.toFixed(0)}</span>
          </aside>
          <footer className="footerbar">
            <div className="control-hints"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span><span><kbd>SHIFT</kbd> Run</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>E</kbd> Interact</span><span>Drag to look</span></div>
            <div className="footer-actions">
              <button onClick={toggleNight} title="Toggle day or night"><Icon name={night ? "moon" : "sun"} /> {night ? "Night" : "Day"}</button>
              <button onClick={() => setMuted(!muted)} title="Audio is planned for a future phase"><Icon name="sound" /> {muted ? "Muted" : "Audio soon"}</button>
              <button onClick={() => { pause(); setShowHelp(true); }}>? Help</button>
            </div>
          </footer>
        </>
      )}

      {(!started || paused) && (
        <div className="overlay">
          <section className="menu-panel" aria-label="Game menu">
            <div className="ornament">✦ <span>✧</span> ✦</div>
            <div className="overline">AN OPEN WORLD IS BEGINNING</div>
            <h1>SL <em>RAVAN</em></h1>
            <div className="divider"><span>◆</span></div>
            <p>Beyond the ancient trees, a forgotten world awaits. Take your first steps through a living forest village.</p>
            <p className="demo-note">A playable environment test. The Ravana-inspired story comes later.</p>
            {error && <p className="error" role="alert">{error}</p>}
            {showHelp && <p className="help">Move with WASD or arrows. Hold Shift to sprint. Press Space to jump, E to interact, drag to orbit the camera, and Esc to pause. Progress is saved in this browser.</p>}
            <button className="primary-button" onClick={paused && started ? resume : start} disabled={!ready || Boolean(error)}>
              {error ? "GRAPHICS UNAVAILABLE" : !ready ? "PREPARING THE WORLD…" : started ? "CONTINUE JOURNEY" : "ENTER THE WORLD"} <span>↗</span>
            </button>
            <div className="menu-bottom"><span>CHAPTER ZERO · PROTOTYPE</span><span>DESKTOP BROWSER</span></div>
          </section>
        </div>
      )}
    </div>
  );
}
