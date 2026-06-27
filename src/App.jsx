import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Engine } from "./game/engine";
import { NetClient } from "./net/NetClient";
import { COUNTRIES, flagUrl } from "./data/countries";
import "./index.css";

const HIGH_KEY = "voidraider_high";
const PILOT_KEY = "voidraider_pilot";
const MAX_LOBBY = 3; // lobby shows up to 3 pilot slots for now

// readable codes: no ambiguous chars (no O/0, I/1)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genRoomCode(len = 4) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

// Mk-I Interceptor silhouette — used for the SHIPS life pips so the HUD
// matches the in-game ship.
function ShipPip() {
  return (
    <svg className="life-pip" viewBox="0 0 24 26" aria-hidden="true">
      <polygon
        points="12,0 13,8 22,17 22,19 14,21 14,25 10,25 10,21 2,19 2,17 11,8"
        fill="var(--c-blue)"
      />
      <rect x="10" y="3" width="4" height="7" rx="1.5" fill="#20d8ff" />
      <rect x="2" y="17" width="1.6" height="1.6" fill="#ff2020" />
      <rect x="20.4" y="17" width="1.6" height="1.6" fill="#20ff66" />
    </svg>
  );
}

// Country flag that survives flaky networks: a transient load failure is
// retried a few times (remounting the <img>) before giving up; on a new
// country it starts fresh. If it ultimately can't load, it shows the 2-letter
// country code in a neutral box instead of a broken-image icon.
function Flag({ code, w = 40, className }) {
  const [tries, setTries] = useState(0);
  useEffect(() => {
    setTries(0); // new country / size → fresh attempts
  }, [code, w]);
  const cc = String(code || "").toUpperCase().slice(0, 2);
  if (tries >= 3) {
    return (
      <span className={`flag-fallback ${className || ""}`.trim()} aria-hidden="true">
        {cc}
      </span>
    );
  }
  return (
    <img
      key={tries}
      src={flagUrl(code, w)}
      alt=""
      className={className}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setTimeout(() => setTries((t) => t + 1), 400)}
    />
  );
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
  const [players, setPlayers] = useState([]); // room roster: {id,name,country,alive,ready}
  const [hostId, setHostId] = useState(null); // current room host's player id
  const [update, setUpdate] = useState(null); // {phase, percent, version, message}
  const joinTimer = useRef(null);
  const rosterKeyRef = useRef("");
  const startedRef = useRef(false); // guards the one-time lobby→arena transition

  // desktop auto-update events (only present in the Electron app)
  useEffect(() => {
    if (!window.voidUpdater) return;
    return window.voidUpdater.onStatus((data) => setUpdate(data));
  }, []);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [xpNext, setXpNext] = useState(30);
  const [levelUp, setLevelUp] = useState(null); // {n, key} → triggers the banner
  const prevLevelRef = useRef(1);
  const [high, setHigh] = useState(() => Number(localStorage.getItem(HIGH_KEY) || 0));

  // build engine once
  useEffect(() => {
    const engine = new Engine(canvasRef.current, {
      onState: ({ score, lives, wave, status, level, xp, xpNext }) => {
        setScore(score);
        setLives(lives);
        setWave(wave);
        setStatus(status);
        if (level != null) setLevel(level);
        if (xp != null) setXp(xp);
        if (xpNext != null) setXpNext(xpNext);
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

  // "LEVEL n!" banner whenever the level goes up (ignores the reset to 1)
  useEffect(() => {
    if (level > prevLevelRef.current) {
      setLevelUp({ n: level, key: Date.now() });
    }
    prevLevelRef.current = level;
  }, [level]);

  const startSolo = useCallback(() => {
    setMode("solo");
    engineRef.current?.startGame(pilot);
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
      startedRef.current = false;
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
            // everyone lands in the lobby; the host starts the round
            setCoopPhase("joined");
          }, minWait);
        },
        onSnap: (snap) => {
          engineRef.current?.applySnap(snap);
          setPlayerCount(snap.players.length);
          setHostId(snap.hostId);
          // host pressed START → all clients enter the arena together
          if (snap.started && !startedRef.current) {
            startedRef.current = true;
            clearTimeout(joinTimer.current);
            engineRef.current?.startMultiplayer(net, pilot);
            setCoopPhase("live");
          }
          // only re-render the roster when it actually changes (snapshots are 30Hz)
          const roster = snap.players.map((pl) => ({
            id: pl.id,
            name: pl.name,
            country: pl.country,
            alive: pl.alive,
            ready: pl.ready,
          }));
          const key =
            `${snap.hostId}|` +
            roster.map((r) => `${r.id}:${r.name}:${r.country}:${r.alive ? 1 : 0}:${r.ready ? 1 : 0}`).join("|");
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

  const toggleReady = useCallback(() => {
    const me = players.find((p) => p.id === netRef.current?.id);
    netRef.current?.setReady(!me?.ready);
  }, [players]);

  const hostStart = useCallback(() => {
    netRef.current?.startGame();
  }, []);

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
    setHostId(null);
    setDenyReason("");
    rosterKeyRef.current = "";
    startedRef.current = false;
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
            <div className="level-box">
              <span className="hud-label level-label">LV {level}</span>
              <div className="level-bar">
                <div
                  className="level-fill"
                  style={{ width: `${Math.min(100, Math.round((xp / Math.max(1, xpNext)) * 100))}%` }}
                />
              </div>
            </div>
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
                    <Flag code={pl.country} w={20} className="hud-flag" />
                    {pl.name}
                    {pl.id === netRef.current?.id && <span className="you-tag">YOU</span>}
                  </span>
                ))}
              </div>
            ) : (
              pilot && (
                <span className="hud-pilot">
                  <Flag code={pilot.country.code} w={20} className="hud-flag" />
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
                <ShipPip key={i} />
              ))}
            </span>
          </div>
        </div>
      )}

      {/* Level-up banner */}
      {levelUp && playing && (
        <div
          key={levelUp.key}
          className="level-up-banner"
          onAnimationEnd={() => setLevelUp(null)}
          aria-hidden="true"
        >
          LEVEL {levelUp.n}!
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
      {coopPhase === "joined" && (() => {
        const myId = netRef.current?.id;
        const isHost = hostId != null ? hostId === myId : hostMode;
        const me = players.find((p) => p.id === myId);
        const others = players.filter((p) => p.id !== hostId);
        const canStart = others.length === 0 || others.every((p) => p.ready);
        const slots = [...players];
        while (slots.length < MAX_LOBBY) slots.push(null);
        return (
          <Overlay>
            <div className="lobby">
              <p className="join-line">{isHost ? "ROOM CREATED" : "YOU JOINED"}</p>
              <h2 className="join-room-name">ROOM {joinedRoom}</h2>
              {isHost && (
                <div className="lobby-share">
                  <span className="join-share">Share this code with your friends</span>
                  <button className="btn btn-ghost copy-btn" onClick={copyCode}>
                    {copied ? "COPIED!" : "COPY CODE"}
                  </button>
                </div>
              )}

              <div className="lobby-list">
                {slots.map((pl, i) =>
                  pl ? (
                    <div key={pl.id} className={`lobby-slot${pl.ready || pl.id === hostId ? " on" : ""}`}>
                      <Flag code={pl.country} w={40} className="lobby-flag" />
                      <span className="lobby-name">{pl.name}</span>
                      {pl.id === myId && <span className="lobby-tag you">YOU</span>}
                      <span className={`lobby-status${pl.id === hostId ? " host" : pl.ready ? " ready" : ""}`}>
                        {pl.id === hostId ? "HOST" : pl.ready ? "READY" : "NOT READY"}
                      </span>
                    </div>
                  ) : (
                    <div key={`empty-${i}`} className="lobby-slot empty">
                      <span className="lobby-name">Waiting for a pilot…</span>
                    </div>
                  )
                )}
              </div>

              {isHost ? (
                <>
                  <button className="btn btn-primary" onClick={hostStart} disabled={!canStart}>
                    START GAME
                  </button>
                  {!canStart && <p className="lobby-hint">Waiting for everyone to ready up…</p>}
                </>
              ) : (
                <button
                  className={`btn btn-ready${me?.ready ? " on" : ""}`}
                  onClick={toggleReady}
                >
                  {me?.ready ? "READY ✓ — TAP TO CANCEL" : "READY!"}
                </button>
              )}
              <button className="btn btn-ghost lobby-leave" onClick={leaveCoop}>
                LEAVE
              </button>
            </div>
          </Overlay>
        );
      })()}

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
            COLD<span className="title-accent">RYA</span>
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
        <Overlay className={coop ? "" : "death"}>
          <h2 className={coop ? "title-sm gameover" : "title-sm you-died"}>
            {coop ? "MISSION FAILED" : "YOU DIED!"}
          </h2>
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

function Overlay({ children, className = "" }) {
  return (
    <div className={`overlay ${className}`.trim()}>
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
