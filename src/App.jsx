import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Engine } from "./game/engine";
import { NetClient } from "./net/NetClient";
import { COUNTRIES, flagUrl } from "./data/countries";
import "./index.css";

const HIGH_KEY = "voidraider_high";
const PILOT_KEY = "voidraider_pilot";

// readable codes: no ambiguous chars (no O/0, I/1)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genRoomCode(len = 4) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

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
  const netRef = useRef(null);

  const savedPilot = useMemo(loadPilot, []);
  const [pilot, setPilot] = useState(savedPilot);

  const [status, setStatus] = useState(savedPilot ? "menu" : "intro");
  const [mode, setMode] = useState("solo"); // solo | coop
  const [netStatus, setNetStatus] = useState("idle"); // idle|connecting|connected|reconnecting
  const [coopPhase, setCoopPhase] = useState("idle"); // idle|connecting|joined|live
  const [joinedRoom, setJoinedRoom] = useState("");
  const [hostMode, setHostMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [room, setRoom] = useState("");
  const [playerCount, setPlayerCount] = useState(1);
  const [players, setPlayers] = useState([]); // room roster: {id,name,country,alive}
  const [update, setUpdate] = useState(null); // {phase, percent, version, message}
  const joinTimer = useRef(null);
  const rosterKeyRef = useRef("");

  // desktop auto-update events (only present in the Electron app)
  useEffect(() => {
    if (!window.voidUpdater) return;
    return window.voidUpdater.onStatus((data) => setUpdate(data));
  }, []);

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
    return () => {
      engine.destroy();
      netRef.current?.close();
      clearTimeout(joinTimer.current);
    };
  }, []);

  // persist high score (solo only — co-op is a shared team score)
  useEffect(() => {
    if (mode === "solo" && status === "over" && score > high) {
      setHigh(score);
      localStorage.setItem(HIGH_KEY, String(score));
    }
  }, [status, score, high, mode]);

  const startSolo = useCallback(() => {
    setMode("solo");
    engineRef.current?.startGame(pilot);
  }, [pilot]);

  const enterArena = useCallback(() => {
    engineRef.current?.startMultiplayer(netRef.current, pilot);
    setCoopPhase("live");
  }, [pilot]);

  const joinCoop = useCallback(
    (codeArg, asHost = false) => {
      const code = ((codeArg ?? room).trim() || "LOBBY").toUpperCase().slice(0, 8);
      setRoom(code);
      setHostMode(asHost);
      setCopied(false);
      setMode("coop");
      setCoopPhase("connecting");
      setNetStatus("connecting");
      const startedAt = Date.now();
      const net = new NetClient({
        onStatus: (s, reason) => {
          setNetStatus(s);
          if (s === "denied") {
            clearTimeout(joinTimer.current);
            setDenyReason(reason || "Unable to join this room.");
          }
        },
        onWelcome: (msg) => {
          const minWait = Math.max(0, 800 - (Date.now() - startedAt));
          clearTimeout(joinTimer.current);
          joinTimer.current = setTimeout(() => {
            setJoinedRoom(msg.room || code);
            setCoopPhase("joined");
            // host stays on the splash to copy/share the code, then taps
            // ENTER ARENA; joiners auto-advance into the game.
            if (!asHost) {
              joinTimer.current = setTimeout(() => {
                engineRef.current?.startMultiplayer(net, pilot);
                setCoopPhase("live");
              }, 1700);
            }
          }, minWait);
        },
        onSnap: (snap) => {
          engineRef.current?.applySnap(snap);
          setPlayerCount(snap.players.length);
          // only re-render the roster when it actually changes (snapshots are 30Hz)
          const roster = snap.players.map((pl) => ({
            id: pl.id,
            name: pl.name,
            country: pl.country,
            alive: pl.alive,
          }));
          const key = roster.map((r) => `${r.id}:${r.name}:${r.country}:${r.alive ? 1 : 0}`).join("|");
          if (key !== rosterKeyRef.current) {
            rosterKeyRef.current = key;
            setPlayers(roster);
          }
        },
      });
      netRef.current = net;
      net.connect({ name: pilot.username, country: pilot.country.code, room: code });
    },
    [room, pilot]
  );

  const createRoom = useCallback(() => {
    joinCoop(genRoomCode(), true);
  }, [joinCoop]);

  const copyCode = useCallback(() => {
    navigator.clipboard?.writeText(joinedRoom).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {}
    );
  }, [joinedRoom]);

  const leaveCoop = useCallback(() => {
    clearTimeout(joinTimer.current);
    netRef.current?.close();
    netRef.current = null;
    setNetStatus("idle");
    setCoopPhase("idle");
    setMode("solo");
    setPlayers([]);
    setDenyReason("");
    rosterKeyRef.current = "";
    engineRef.current?.leaveMultiplayer();
  }, []);

  const playAgain = useCallback(() => {
    if (mode === "coop") engineRef.current?.restartMultiplayer();
    else engineRef.current?.startGame(pilot);
  }, [mode, pilot]);

  const resume = useCallback(() => engineRef.current?.resume(), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);

  const registerPilot = useCallback((p) => {
    setPilot(p);
    localStorage.setItem(PILOT_KEY, JSON.stringify(p));
    setStatus("menu");
  }, []);
  const editPilot = useCallback(() => setStatus("intro"), []);

  // keyboard shortcuts
  useEffect(() => {
    if (status === "intro") return;
    const onKey = (e) => {
      if (e.key === "Enter" && status === "menu" && mode === "solo") startSolo();
      if ((e.key === "Escape" || e.key.toLowerCase() === "p") && mode === "solo") {
        if (status === "playing") pause();
        else if (status === "paused") resume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, mode, startSolo, pause, resume]);

  const playing = status === "playing";
  const coop = mode === "coop";

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />

      {/* Desktop auto-update */}
      <UpdateOverlay update={update} onDismiss={() => setUpdate(null)} />


      {/* HUD */}
      {(playing || status === "paused") && (
        <div className="hud" aria-hidden="true">
          <div className="hud-left">
            <span className="hud-label">{coop ? "TEAM SCORE" : "SCORE"}</span>
            <span className="hud-score">{String(score).padStart(6, "0")}</span>
            {coop ? (
              <div className="hud-roster">
                <span className="hud-label hud-roster-label">PILOTS · {players.length}</span>
                {players.map((pl) => (
                  <span
                    key={pl.id}
                    className={`hud-pilot${pl.alive ? "" : " dead"}${
                      pl.id === netRef.current?.id ? " me" : ""
                    }`}
                  >
                    <img src={flagUrl(pl.country, 20)} alt="" className="hud-flag" />
                    {pl.name}
                    {pl.id === netRef.current?.id && <span className="you-tag">YOU</span>}
                  </span>
                ))}
              </div>
            ) : (
              pilot && (
                <span className="hud-pilot">
                  <img src={flagUrl(pilot.country.code, 20)} alt="" className="hud-flag" />
                  {pilot.username}
                </span>
              )
            )}
          </div>
          <div className="hud-center">
            <span className="hud-label">WAVE</span>
            <span className="hud-wave">{wave}</span>
            {coop && (
              <span className="hud-room">
                ROOM {netRef.current?.room || room} · {playerCount}P
              </span>
            )}
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

      {playing && mode === "solo" && (
        <button className="pause-btn" onClick={pause} aria-label="Pause game">
          II
        </button>
      )}
      {playing && coop && (
        <button className="leave-btn" onClick={leaveCoop} aria-label="Leave co-op">
          LEAVE
        </button>
      )}

      {/* CO-OP: join denied (room full / at capacity) */}
      {coopPhase === "connecting" && netStatus === "denied" && (
        <Overlay>
          <h2 className="title-sm gameover">CAN'T JOIN</h2>
          <p className="subtitle">{denyReason}</p>
          <button className="btn btn-primary" onClick={leaveCoop}>
            BACK
          </button>
        </Overlay>
      )}

      {/* CO-OP: waiting to connect */}
      {coopPhase === "connecting" && netStatus !== "denied" && (
        <Overlay>
          <h2 className="title-sm wait-title">
            {netStatus === "reconnecting" ? "RECONNECTING" : "PLEASE WAIT"}
          </h2>
          <div className="loader" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="subtitle">Joining room {room.toUpperCase() || "LOBBY"}…</p>
          <button className="btn btn-ghost" onClick={leaveCoop}>
            CANCEL
          </button>
        </Overlay>
      )}

      {/* CO-OP: joined splash */}
      {coopPhase === "joined" && (
        <Overlay>
          <div className="join-splash">
            <p className="join-line">{hostMode ? "ROOM CREATED" : "YOU JOINED"}</p>
            <h2 className="join-room-name">ROOM {joinedRoom}</h2>
            {hostMode ? (
              <>
                <p className="join-share">Share this code with your friends</p>
                <button className="btn btn-ghost copy-btn" onClick={copyCode}>
                  {copied ? "COPIED!" : "COPY CODE"}
                </button>
                <button className="btn btn-primary" onClick={enterArena}>
                  ENTER ARENA
                </button>
              </>
            ) : (
              <p className="join-ready">GET READY…</p>
            )}
          </div>
        </Overlay>
      )}

      {/* CO-OP: lost connection mid-game */}
      {coopPhase === "live" && netStatus === "reconnecting" && (
        <Overlay>
          <h2 className="title-sm wait-title">RECONNECTING</h2>
          <div className="loader" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <button className="btn btn-ghost" onClick={leaveCoop}>
            LEAVE
          </button>
        </Overlay>
      )}

      {/* REGISTRATION */}
      {status === "intro" && <Registration initial={pilot} onComplete={registerPilot} />}

      {/* MENU */}
      {status === "menu" && coopPhase === "idle" && (
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
          <button className="btn btn-primary" onClick={startSolo}>
            SINGLE PLAYER
          </button>

          <div className="coop-box">
            <span className="coop-title">CO-OP — PLAY WITH FRIENDS</span>

            {/* Host: generate a fresh shareable code */}
            <button className="btn btn-coop coop-create" onClick={createRoom}>
              CREATE ROOM
            </button>
            <span className="coop-hint">Generates a code — share it with friends.</span>

            <div className="coop-divider">
              <span>OR JOIN A CODE</span>
            </div>

            {/* Friend: enter an existing code */}
            <div className="coop-row">
              <input
                className="reg-input coop-input"
                placeholder="ROOM CODE"
                value={room}
                maxLength={8}
                onChange={(e) => setRoom(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                aria-label="Room code"
              />
              <button className="btn btn-coop" onClick={() => joinCoop()} disabled={!room.trim()}>
                JOIN
              </button>
            </div>
          </div>

          <button className="btn-link" onClick={editPilot}>
            change pilot
          </button>
          {high > 0 && <p className="high">BEST {String(high).padStart(6, "0")}</p>}
          <Controls />
        </Overlay>
      )}

      {/* PAUSED (solo) */}
      {status === "paused" && (
        <Overlay>
          <h2 className="title-sm">PAUSED</h2>
          <button className="btn btn-primary" onClick={resume}>
            RESUME
          </button>
          <button className="btn btn-ghost" onClick={startSolo}>
            RESTART
          </button>
        </Overlay>
      )}

      {/* GAME OVER */}
      {status === "over" && (
        <Overlay>
          <h2 className="title-sm gameover">{coop ? "MISSION FAILED" : "GAME OVER"}</h2>
          <div className="score-final">
            <span className="hud-label">{coop ? "TEAM SCORE" : "FINAL SCORE"}</span>
            <span className="big-score">{String(score).padStart(6, "0")}</span>
            {mode === "solo" && score >= high && score > 0 && <span className="new-best">NEW BEST!</span>}
          </div>
          <button className="btn btn-primary" onClick={playAgain}>
            {coop ? "RESTART ROUND" : "PLAY AGAIN"}
          </button>
          {coop ? (
            <button className="btn btn-ghost" onClick={leaveCoop}>
              LEAVE CO-OP
            </button>
          ) : (
            high > 0 && <p className="high">BEST {String(high).padStart(6, "0")}</p>
          )}
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
            {filtered.length === 0 && <p className="country-empty">No countries match “{query}”.</p>}
          </div>
        </div>

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

function UpdateOverlay({ update, onDismiss }) {
  if (!update) return null;
  const { phase, percent = 0, version } = update;

  // only surface the meaningful phases
  if (phase === "available" || phase === "downloading") {
    return (
      <div className="overlay update-overlay">
        <div className="overlay-panel">
          <h2 className="title-sm">UPDATING</h2>
          <p className="subtitle">
            {version ? `New version ${version}` : "Downloading the latest version"}
          </p>
          <div className="progress-track" role="progressbar" aria-valuenow={percent}>
            <div className="progress-fill" style={{ width: `${phase === "downloading" ? percent : 6}%` }} />
          </div>
          <p className="update-pct">
            {phase === "downloading" ? `${percent}%` : "Starting…"}
          </p>
          <p className="update-note">Please wait — the game will be ready in a moment.</p>
        </div>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="overlay update-overlay">
        <div className="overlay-panel">
          <h2 className="title-sm">UPDATE READY</h2>
          <p className="subtitle">{version ? `Version ${version} installed` : "Update downloaded"}</p>
          <button className="btn btn-primary" onClick={() => window.voidUpdater?.restart()}>
            RESTART &amp; PLAY
          </button>
          <button className="btn-link" onClick={onDismiss}>
            later
          </button>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    // unsigned macOS builds can't auto-install — offer a manual download
    return (
      <div className="update-toast">
        <span>Update available</span>
        <button className="btn-link" onClick={() => window.voidUpdater?.openReleases()}>
          download
        </button>
        <button className="btn-link" onClick={onDismiss}>
          dismiss
        </button>
      </div>
    );
  }

  return null; // checking / none → silent
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
        <span>pause (solo)</span>
      </div>
      <div className="control-row">
        <span className="hint">or tap &amp; drag to fly + auto-fire</span>
      </div>
    </div>
  );
}
