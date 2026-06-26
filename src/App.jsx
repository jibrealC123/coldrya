import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Engine } from "./game/engine";
import { COUNTRIES, flagUrl } from "./data/countries";
import "./index.css";

const HIGH_KEY = "voidraider_high";
const PILOT_KEY = "voidraider_pilot";

function loadPilot() {
  try {
    const raw = localStorage.getItem(PILOT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && p.username && p.country?.code) return p;
  } catch {
    /* ignore */
  }
  return null;
}

export default function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const savedPilot = useMemo(loadPilot, []);
  const [pilot, setPilot] = useState(savedPilot); // { username, country: {code,name} }

  // intro = registration | menu | playing | paused | over
  const [status, setStatus] = useState(savedPilot ? "menu" : "intro");
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

  const start = useCallback(() => {
    // hand pilot to the engine so a flagged ship model can use it later
    engineRef.current?.startGame(pilot);
  }, [pilot]);
  const resume = useCallback(() => engineRef.current?.resume(), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);

  const registerPilot = useCallback((p) => {
    setPilot(p);
    localStorage.setItem(PILOT_KEY, JSON.stringify(p));
    setStatus("menu");
  }, []);

  const editPilot = useCallback(() => setStatus("intro"), []);

  // keyboard shortcuts (not during registration — typing there)
  useEffect(() => {
    if (status === "intro") return;
    const onKey = (e) => {
      if (e.key === "Enter" && (status === "menu" || status === "over")) start();
      if (e.key === "Escape" || e.key.toLowerCase() === "p") {
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
            {pilot && (
              <span className="hud-pilot">
                <img src={flagUrl(pilot.country.code, 20)} alt="" className="hud-flag" />
                {pilot.username}
              </span>
            )}
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

      {playing && (
        <button className="pause-btn" onClick={pause} aria-label="Pause game">
          II
        </button>
      )}

      {/* REGISTRATION */}
      {status === "intro" && (
        <Registration initial={pilot} onComplete={registerPilot} />
      )}

      {/* MENU */}
      {status === "menu" && (
        <Overlay>
          <h1 className="title">
            VOID<span className="title-accent"> RAIDER</span>
          </h1>
          {pilot && (
            <p className="pilot-greet">
              <img src={flagUrl(pilot.country.code, 40)} alt={pilot.country.name} className="greet-flag" />
              PILOT <span className="pilot-name">{pilot.username}</span>
            </p>
          )}
          <button className="btn btn-primary" onClick={start}>
            START MISSION
          </button>
          <button className="btn-link" onClick={editPilot}>
            change pilot
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
          {pilot && (
            <p className="pilot-greet">
              <img src={flagUrl(pilot.country.code, 40)} alt={pilot.country.name} className="greet-flag" />
              <span className="pilot-name">{pilot.username}</span>
            </p>
          )}
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

/* ── Pilot registration screen ───────────────────────────────────────── */
function Registration({ initial, onComplete }) {
  const [username, setUsername] = useState(initial?.username || "");
  const [selected, setSelected] = useState(initial?.country || null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  const cleanName = username.trim();
  const valid = cleanName.length >= 2 && cleanName.length <= 16 && selected;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onComplete({ username: cleanName, country: selected });
  };

  return (
    <div className="overlay">
      <form className="reg-panel" onSubmit={submit}>
        <h1 className="reg-title">PILOT REGISTRATION</h1>

        {/* Country */}
        <div className="field">
          <label className="field-label" htmlFor="country-search">
            WHERE ARE YOU FROM?
          </label>
          <div className="reg-selected">
            {selected ? (
              <>
                <img src={flagUrl(selected.code, 40)} alt="" className="flag-img" />
                <span className="reg-selected-name">{selected.name}</span>
              </>
            ) : (
              <span className="reg-selected-empty">Select your country</span>
            )}
          </div>
          <input
            id="country-search"
            type="text"
            className="reg-input"
            placeholder="Search countries…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <div className="country-list" role="listbox" aria-label="Countries">
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={selected?.code === c.code}
                className={`country-item ${selected?.code === c.code ? "selected" : ""}`}
                onClick={() => setSelected(c)}
              >
                <img
                  src={flagUrl(c.code, 40)}
                  srcSet={`${flagUrl(c.code, 40)} 1x, ${flagUrl(c.code, 80)} 2x`}
                  alt={`${c.name} flag`}
                  width="30"
                  height="20"
                  loading="lazy"
                  className="flag-img"
                />
                <span className="country-name">{c.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="country-empty">No countries match “{query}”.</p>
            )}
          </div>
        </div>

        {/* Username */}
        <div className="field">
          <label className="field-label" htmlFor="username">
            CALLSIGN
          </label>
          <input
            id="username"
            type="text"
            className="reg-input"
            placeholder="Enter your name…"
            value={username}
            maxLength={16}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
          <p className="field-hint">2–16 characters</p>
        </div>

        <button type="submit" className="btn btn-primary" disabled={!valid}>
          LAUNCH
        </button>
      </form>
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
