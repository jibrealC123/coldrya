import { useEffect, useRef, useState, useCallback } from "react";
import { Engine } from "./game/engine";
import "./index.css";

const HIGH_KEY = "voidraider_high";

export default function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const [status, setStatus] = useState("menu"); // menu | playing | paused | over
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [high, setHigh] = useState(() => Number(localStorage.getItem(HIGH_KEY) || 0));

  // build engine once
  useEffect(() => {
    const engine = new Engine(canvasRef.current, {
      onState: ({ score, lives, wave, status }) => {
        setScore(score);
        setLives(lives);
        setWave(wave);
        setStatus(status);
      },
    });
    engineRef.current = engine;
    return () => engine.destroy();
  }, []);

  // persist high score on game over
  useEffect(() => {
    if (status === "over" && score > high) {
      setHigh(score);
      localStorage.setItem(HIGH_KEY, String(score));
    }
  }, [status, score, high]);

  const start = useCallback(() => engineRef.current?.startGame(), []);
  const resume = useCallback(() => engineRef.current?.resume(), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);

  // keyboard: Enter to start/restart, Esc/P to pause-resume
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter" && (status === "menu" || status === "over")) start();
      if ((e.key === "Escape" || e.key.toLowerCase() === "p")) {
        if (status === "playing") pause();
        else if (status === "paused") resume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, start, pause, resume]);

  const playing = status === "playing";

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />

      {/* HUD */}
      {(playing || status === "paused") && (
        <div className="hud" aria-hidden="true">
          <div className="hud-left">
            <span className="hud-label">SCORE</span>
            <span className="hud-score">{String(score).padStart(6, "0")}</span>
          </div>
          <div className="hud-center">
            <span className="hud-label">WAVE</span>
            <span className="hud-wave">{wave}</span>
          </div>
          <div className="hud-right">
            <span className="hud-label">SHIPS</span>
            <span className="hud-lives">
              {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
                <span key={i} className="life-pip" />
              ))}
            </span>
          </div>
        </div>
      )}

      {/* Pause button while playing */}
      {playing && (
        <button className="pause-btn" onClick={pause} aria-label="Pause game">
          II
        </button>
      )}

      {/* MENU */}
      {status === "menu" && (
        <Overlay>
          <h1 className="title">
            VOID<span className="title-accent"> RAIDER</span>
          </h1>
          <p className="subtitle">Clear the swarm. Survive the waves.</p>
          <button className="btn btn-primary" onClick={start}>
            START MISSION
          </button>
          {high > 0 && <p className="high">BEST {String(high).padStart(6, "0")}</p>}
          <Controls />
        </Overlay>
      )}

      {/* PAUSED */}
      {status === "paused" && (
        <Overlay>
          <h2 className="title-sm">PAUSED</h2>
          <button className="btn btn-primary" onClick={resume}>
            RESUME
          </button>
          <button className="btn btn-ghost" onClick={start}>
            RESTART
          </button>
        </Overlay>
      )}

      {/* GAME OVER */}
      {status === "over" && (
        <Overlay>
          <h2 className="title-sm gameover">GAME OVER</h2>
          <div className="score-final">
            <span className="hud-label">FINAL SCORE</span>
            <span className="big-score">{String(score).padStart(6, "0")}</span>
            {score >= high && score > 0 && <span className="new-best">NEW BEST!</span>}
          </div>
          <button className="btn btn-primary" onClick={start}>
            PLAY AGAIN
          </button>
          <p className="high">BEST {String(high).padStart(6, "0")}</p>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children }) {
  return (
    <div className="overlay">
      <div className="overlay-panel">{children}</div>
    </div>
  );
}

function Controls() {
  return (
    <div className="controls">
      <div className="control-row">
        <kbd>W A S D</kbd>
        <kbd>↑ ← ↓ →</kbd>
        <span>move</span>
      </div>
      <div className="control-row">
        <kbd>SPACE</kbd>
        <span>fire</span>
      </div>
      <div className="control-row">
        <kbd>P</kbd>
        <kbd>ESC</kbd>
        <span>pause</span>
      </div>
      <div className="control-row">
        <span className="hint">or tap &amp; drag to fly + auto-fire</span>
      </div>
    </div>
  );
}
