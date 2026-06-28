import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Engine } from "./game/engine";
import { NetClient, serverHttpBase } from "./net/NetClient";
import { COUNTRIES, flagUrl } from "./data/countries";
import "./index.css";

const HIGH_KEY = "voidraider_high";
const PILOT_KEY = "voidraider_pilot";
const MAX_LOBBY = 3; // lobby shows up to 3 pilot slots for now

// ── Leaderboard (top solo scores, persisted locally) ──────────────────
const LEADERBOARD_KEY = "coldrya_leaderboard";
const LEADERBOARD_MAX = 5;
function loadLeaderboard() {
  try {
    const raw = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");
    if (Array.isArray(raw)) {
      return raw
        .filter((e) => e && typeof e.score === "number")
        .sort((a, b) => b.score - a.score)
        .slice(0, LEADERBOARD_MAX);
    }
  } catch {
    /* ignore corrupt data */
  }
  return [];
}
function recordScore(entry) {
  const list = loadLeaderboard();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, LEADERBOARD_MAX);
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(top));
  } catch {
    /* ignore quota errors */
  }
  return top;
}

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

// Co-op side chat — a small panel where teammates type while the round eases
// in. Typing here doesn't steer the ship (the engine ignores keys from inputs).
function ChatPanel({ messages, onSend, myId }) {
  const [text, setText] = useState("");
  const listRef = useRef(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);
  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };
  return (
    <div className="chat-panel">
      <div className="chat-head">TEAM CHAT</div>
      <div className="chat-msgs" ref={listRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">Say hi to your squad…</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`chat-msg${m.id === myId ? " mine" : ""}`}>
              <Flag code={m.country} w={20} className="chat-flag" />
              <span className="chat-name">{m.name}</span>
              <span className="chat-text">{m.text}</span>
            </div>
          ))
        )}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input
          className="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={140}
          aria-label="Chat message"
        />
        <button className="chat-send" type="submit" aria-label="Send message">
          ▶
        </button>
      </form>
    </div>
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
  const [chat, setChat] = useState([]); // co-op chat messages
  const [intro, setIntro] = useState(false); // personalized welcome before play
  const [villain, setVillain] = useState(false); // Void King fades in + talks during play
  const pendingStartRef = useRef(null); // deferred game-start, fired on "OK!"
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
  const [storm, setStorm] = useState(null); // null | "intro" | "active" (lightning storm)
  const prevLevelRef = useRef(1);
  const [high, setHigh] = useState(() => Number(localStorage.getItem(HIGH_KEY) || 0));
  const [leaderboard, setLeaderboard] = useState(loadLeaderboard);
  const recordedRef = useRef(false);

  // build engine once
  useEffect(() => {
    const engine = new Engine(canvasRef.current, {
      onState: ({ score, lives, wave, status, level, xp, xpNext, storm }) => {
        setScore(score);
        setLives(lives);
        setWave(wave);
        setStatus(status);
        if (level != null) setLevel(level);
        if (xp != null) setXp(xp);
        if (xpNext != null) setXpNext(xpNext);
        setStorm(storm ?? null);
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

  // pull the global leaderboard on load (falls back to the local copy offline)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${serverHttpBase()}/api/leaderboard`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && Array.isArray(data)) setLeaderboard(data.slice(0, LEADERBOARD_MAX));
      } catch {
        /* offline → keep the local board */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // record a solo run once when the round ends: submit to the global board
  // (and keep a local copy so it still works offline)
  useEffect(() => {
    if (status === "playing") recordedRef.current = false;
    if (status === "over" && mode === "solo" && !recordedRef.current && score > 0 && pilot) {
      recordedRef.current = true;
      const entry = { name: pilot.username, country: pilot.country.code, score };
      setLeaderboard(recordScore(entry)); // instant local fallback
      (async () => {
        try {
          const res = await fetch(`${serverHttpBase()}/api/leaderboard`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry),
          });
          if (!res.ok) return;
          const data = await res.json();
          if (Array.isArray(data)) setLeaderboard(data.slice(0, LEADERBOARD_MAX));
        } catch {
          /* offline → local board already updated */
        }
      })();
    }
  }, [status, mode, score, pilot]);

  // "LEVEL n!" banner whenever the level goes up (ignores the reset to 1)
  useEffect(() => {
    if (level > prevLevelRef.current) {
      setLevelUp({ n: level, key: Date.now() });
    }
    prevLevelRef.current = level;
  }, [level]);

  const startSolo = useCallback(() => {
    setMode("solo");
    // show the personalized intro first; the round starts when they hit OK!
    pendingStartRef.current = () => engineRef.current?.startGame(pilot);
    setIntro(true);
  }, [pilot]);

  // welcome OK → start the round in a calm grace AND fade the devil in so he
  // taunts the pilot while they fly ("story while playing")
  const beginGame = useCallback(() => {
    setIntro(false);
    const start = pendingStartRef.current;
    pendingStartRef.current = null;
    start?.(); // ships appear, the pilot can fly immediately (calm pace)
    engineRef.current?.setGrace(true);
    setVillain(true); // devil materializes + talks over the live game
  }, []);

  // countdown hits "START!" → full battle begins
  const villainStart = useCallback(() => engineRef.current?.setGrace(false), []);
  // sequence fully done → unmount the devil
  const endVillain = useCallback(() => setVillain(false), []);

  // quit a solo run back to the menu
  const quitToMenu = useCallback(() => {
    setIntro(false);
    setVillain(false);
    pendingStartRef.current = null;
    engineRef.current?.quitToMenu();
  }, []);

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
          // host pressed START → all clients enter the arena together. Show
          // the personalized intro now (in-game entry, NOT the lobby); the
          // ship comes under control when the pilot hits OK!
          if (snap.started && !startedRef.current) {
            startedRef.current = true;
            clearTimeout(joinTimer.current);
            pendingStartRef.current = () => engineRef.current?.startMultiplayer(net, pilot);
            setCoopPhase("live");
            setIntro(true);
          }
          // only re-render the roster when it actually changes (snapshots are 30Hz)
          const roster = snap.players.map((pl) => ({
            id: pl.id,
            name: pl.name,
            country: pl.country,
            alive: pl.alive,
            ready: pl.ready,
            lvl: pl.lvl ?? 1,
          }));
          const key =
            `${snap.hostId}|` +
            roster
              .map((r) => `${r.id}:${r.name}:${r.country}:${r.alive ? 1 : 0}:${r.ready ? 1 : 0}:${r.lvl}`)
              .join("|");
          if (key !== rosterKeyRef.current) {
            rosterKeyRef.current = key;
            setPlayers(roster);
          }
        },
        onChat: ({ messages, replace }) => {
          setChat((prev) => (replace ? messages : [...prev, ...messages]).slice(-60));
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

  const sendChat = useCallback((text) => {
    netRef.current?.sendChat(text);
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
    setChat([]);
    setIntro(false);
    setVillain(false);
    pendingStartRef.current = null;
    setDenyReason("");
    rosterKeyRef.current = "";
    startedRef.current = false;
    engineRef.current?.leaveMultiplayer();
  }, []);

  // back out of the intro: solo → reveal the menu; co-op → leave the room
  const returnToLobby = useCallback(() => {
    setIntro(false);
    setVillain(false);
    pendingStartRef.current = null;
    if (mode === "coop") leaveCoop();
    else engineRef.current?.quitToMenu();
  }, [mode, leaveCoop]);

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

      {/* Personalized welcome — shown when gameplay starts (not the lobby) */}
      {intro && pilot && (
        <Intro name={pilot.username} mode={mode} onOk={beginGame} onReturn={returnToLobby} />
      )}

      {/* The devil fades in and taunts you mid-flight, then 3·2·1·START! */}
      {villain && <VillainSequence onStart={villainStart} onDone={endVillain} />}

      {/* Lightning-storm taunt caption (no orb) — plays before the bolts */}
      {storm === "intro" && playing && <StormCaption />}


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
                    <span className="pilot-lvl">LV{pl.lvl}</span>
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

      {/* CO-OP: side chat (lobby + live) */}
      {coop && (coopPhase === "joined" || coopPhase === "live") && (
        <ChatPanel messages={chat} onSend={sendChat} myId={netRef.current?.id} />
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
        <Overlay className="menu-overlay">
          <div className="menu-layout">
            <div className="menu-main">
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
            </div>

            {leaderboard.length > 0 && (
              <div className="leaderboard menu-board">
                <span className="lb-title">TOP PILOTS · GLOBAL</span>
                <ol className="lb-list">
                  {leaderboard.map((e, i) => (
                    <li key={i} className={`lb-row${i === 0 ? " top" : ""}`}>
                      <span className="lb-rank">{i + 1}</span>
                      <Flag code={e.country} w={40} className="lb-flag" />
                      <span className="lb-namewrap">
                        <span className="lb-name">{e.name}</span>
                        {i === 0 && <span className="lb-crown">THE HIGHEST SCORE</span>}
                      </span>
                      <span className="lb-score">{String(e.score).padStart(6, "0")}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
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
          <button className="btn btn-ghost" onClick={quitToMenu}>
            QUIT TO MENU
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
            <>
              <button className="btn btn-ghost" onClick={quitToMenu}>
                MENU
              </button>
              {high > 0 && <p className="high">BEST {String(high).padStart(6, "0")}</p>}
            </>
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
  // editing an existing pilot and picking a different callsign starts you over
  // on the leaderboard (scores are tied to the name)
  const nameChanged = !!initial?.username && !!cleanName && cleanName !== initial.username;

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

        {nameChanged && (
          <div className="reg-warning" role="alert">
            <span className="reg-warning-title">⚠ WARNING</span>
            Changing your callsign starts you over — your leaderboard scores stay under{" "}
            <strong>&ldquo;{initial.username}&rdquo;</strong> and won&rsquo;t follow{" "}
            <strong>&ldquo;{cleanName}&rdquo;</strong>. Only change it if you&rsquo;re willing to lose your
            standing.
          </div>
        )}

        <button type="submit" className={`btn ${nameChanged ? "btn-danger" : "btn-primary"}`} disabled={!valid}>
          {nameChanged ? "CHANGE CALLSIGN" : "LAUNCH"}
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

// Personalized welcome shown as gameplay begins — a slow "magic" fade-in over
// a drifting pixel field. The round is held until the pilot clicks OK!.
// Power-up legend shown in the intro — glyphs/colours match the in-game drops
// (see POWER_META in src/game/engine.js). The four below the rule are the new
// player-requested buffs.
const INTRO_BUFFS = [
  { g: "T", c: "#22C55E", name: "TRIPLE", desc: "3-way spread fire" },
  { g: "R", c: "#22C55E", name: "RAPID", desc: "Faster fire rate" },
  { g: "S", c: "#22C55E", name: "SHIELD", desc: "Blocks one hit" },
  { g: "+", c: "#ff5a8a", name: "HEAL", desc: "+1 ship (max 5)", isNew: true },
  { g: "N", c: "#ffd23f", name: "NUKE", desc: "Clears the screen", isNew: true },
  { g: "O", c: "#c77dff", name: "OMNI", desc: "Fire every direction", isNew: true },
  { g: "X", c: "#39e0ff", name: "OVERDRIVE", desc: "Invincible ram", isNew: true },
];

function BuffLegend() {
  return (
    <aside className="intro-buffs" aria-label="Power-up guide">
      <p className="intro-buffs-title">BUFFS</p>
      <ul className="intro-buffs-list">
        {INTRO_BUFFS.map((b) => (
          <li className={`buff-row${b.isNew ? " buff-row-new" : ""}`} key={b.g}>
            <span className="buff-chip" style={{ color: b.c, borderColor: b.c, textShadow: `0 0 8px ${b.c}` }}>
              {b.g}
            </span>
            <span className="buff-text">
              <span className="buff-name" style={{ color: b.c }}>
                {b.name}
                {b.isNew && <span className="buff-new">NEW</span>}
              </span>
              <span className="buff-desc">{b.desc}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Intro({ name, mode, onOk, onReturn }) {
  return (
    <div className="overlay intro-overlay">
      <BuffLegend />
      <div className="intro-content">
        <p className="intro-welcome">WELCOME TO</p>
        <h1 className="intro-title">
          COLD<span className="title-accent">RYA</span>&rsquo;S SPACE WAR!
        </h1>
        <p className="intro-pilot">
          PILOT <span className="intro-name">{name}</span>
        </p>
        <div className="intro-controls">
          <p>
            <span className="ik">MOVE</span> — Arrow keys or <span className="ik">W A S D</span>
          </p>
          <p>
            <span className="ik">FIRE</span> — Hold <span className="ik">SPACE</span> (or tap &amp; drag)
          </p>
          {mode === "solo" && (
            <p>
              <span className="ik">PAUSE</span> — <span className="ik">P</span> / <span className="ik">ESC</span>
            </p>
          )}
          {mode === "coop" && <p className="intro-coop">Survive the waves together — good luck, pilot!</p>}
        </div>
        <div className="intro-actions">
          <button className="btn btn-primary intro-ok" onClick={onOk} autoFocus>
            OK!
          </button>
          <button className="btn btn-ghost intro-back" onClick={onReturn}>
            RETURN TO LOBBY
          </button>
        </div>
      </div>
    </div>
  );
}

// ── The villain — an animated ball-devil ──────────────────────────────
const VILLAIN_NAME = "THE GUS";
const VILLAIN_LINES = [
  "So… a new spark dares to flicker in MY void.",
  "These dead stars are my throne, little ship.",
  "Hehe… you may see me once again after some waves….",
];

// A round devil drawn on its own canvas with a real animation loop — it
// floats, breathes, its lighting aura + embers pulse, and its eyes glow.
function BallDevil() {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 240;
    const H = 240;
    cvs.width = W * dpr;
    cvs.height = H * dpr;
    ctx.scale(dpr, dpr);
    const embers = Array.from({ length: 16 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 58 + Math.random() * 42,
      sp: 0.2 + Math.random() * 0.6,
      sz: 1 + Math.random() * 2,
      ph: Math.random() * Math.PI * 2,
    }));
    const t0 = performance.now();
    let raf = 0;
    const draw = (now) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2 + Math.sin(t * 1.6) * 8; // float
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);

      // lighting aura
      const auraR = 78 + pulse * 18;
      const ag = ctx.createRadialGradient(cx, cy, 10, cx, cy, auraR);
      ag.addColorStop(0, `rgba(255,70,50,${0.34 + pulse * 0.2})`);
      ag.addColorStop(0.5, "rgba(180,20,60,0.16)");
      ag.addColorStop(1, "rgba(120,0,40,0)");
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
      ctx.fill();

      // orbiting embers
      for (const e of embers) {
        const ang = e.a + t * e.sp;
        const rr = e.r + Math.sin(t * 1.5 + e.ph) * 6;
        ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(t * 3 + e.ph));
        ctx.fillStyle = "#ff9a3c";
        ctx.fillRect(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.85, e.sz, e.sz);
      }
      ctx.globalAlpha = 1;

      // ── pixel-art orb body (flat shading, blocky — 2D pixel look) ──
      const PS = 6; // pixel cell size
      const Rp = 9; // radius in cells
      const ox = Math.round(cx);
      const oy = Math.round(cy);
      // pixel horns
      ctx.fillStyle = "#240810";
      const horns = [
        [-7, -7], [-7, -8], [-6, -9], [-6, -10], [-5, -11],
        [7, -7], [7, -8], [6, -9], [6, -10], [5, -11],
      ];
      for (const [hx, hy] of horns) ctx.fillRect(ox + hx * PS, oy + hy * PS, PS, PS);
      // body cells, lit from the top-left
      for (let py = -Rp; py <= Rp; py++) {
        for (let px = -Rp; px <= Rp; px++) {
          const dd = px * px + py * py;
          if (dd > Rp * Rp) continue;
          const lit = (-px - py) / (Rp * 1.4);
          let c;
          if (dd > (Rp - 1) * (Rp - 1)) c = "#3a0010"; // rim
          else if (lit > 0.5) c = "#ff8a6a"; // highlight
          else if (lit > 0.05) c = "#e23a3a"; // light
          else if (lit > -0.45) c = "#b3122e"; // mid
          else c = "#6e0420"; // shadow
          ctx.fillStyle = c;
          ctx.fillRect(ox + px * PS, oy + py * PS, PS, PS);
        }
      }
      // pulsing molten core (a flat bright cluster, not a smooth gradient)
      if (pulse > 0.35) {
        ctx.fillStyle = pulse > 0.7 ? "#ffd27a" : "#ff9a3c";
        for (const [px, py] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]])
          ctx.fillRect(ox + px * PS, oy + py * PS, PS, PS);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="balldevil-canvas" aria-hidden="true" />;
}

// Over the LIVE (calm) game: the devil fades in, taunts via auto-advancing
// subtitles, then a 3·2·1·START! countdown kicks off the full battle.
// The Gus's taunt before a lightning storm — just the caption, no orb.
const STORM_TAUNT = "Wow, you reached this already? Sure, I assume you're prepared for some of my power? Hehe…";
function StormCaption() {
  const [chars, setChars] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setChars((c) => (c >= STORM_TAUNT.length ? c : c + 1)), 42);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="villain-sub storm-cap" aria-hidden="true">
      <span className="villain-sub-name">THE GUS</span>
      <span className="villain-sub-text">{STORM_TAUNT.slice(0, chars)}</span>
    </div>
  );
}

function VillainSequence({ onStart, onDone }) {
  const [phase, setPhase] = useState("talk"); // talk | count | go
  const [line, setLine] = useState(0);
  const [chars, setChars] = useState(0);
  const [count, setCount] = useState(3);
  const text = VILLAIN_LINES[line];

  // typewriter for the current line
  useEffect(() => {
    if (phase !== "talk") return;
    setChars(0);
    const id = setInterval(() => setChars((c) => (c >= text.length ? c : c + 1)), 42);
    return () => clearInterval(id);
  }, [line, text, phase]);

  // auto-advance lines, then move into the countdown
  useEffect(() => {
    if (phase !== "talk" || chars < text.length) return;
    const hold = setTimeout(() => {
      if (line < VILLAIN_LINES.length - 1) setLine((l) => l + 1);
      else {
        setPhase("count");
        setCount(3);
      }
    }, 2200);
    return () => clearTimeout(hold);
  }, [chars, text, line, phase]);

  // 3 · 2 · 1 → START!
  useEffect(() => {
    if (phase !== "count") return;
    if (count > 1) {
      const id = setTimeout(() => setCount((c) => c - 1), 850);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setPhase("go"), 850);
    return () => clearTimeout(id);
  }, [phase, count]);

  // "go": full battle begins, then unmount after the orb flies up & away
  useEffect(() => {
    if (phase !== "go") return;
    onStart();
    const id = setTimeout(onDone, 1350);
    return () => clearTimeout(id);
  }, [phase, onStart, onDone]);

  return (
    <div className={`villain-seq${phase === "go" ? " out" : ""}`} aria-hidden="true">
      <div className="balldevil-wrap">
        <BallDevil />
      </div>
      {phase === "talk" && (
        <div className="villain-sub">
          <span className="villain-sub-name">{VILLAIN_NAME}</span>
          <span className="villain-sub-text">{text.slice(0, chars)}</span>
        </div>
      )}
      {phase === "count" && (
        <div key={count} className="villain-count">
          {count}
        </div>
      )}
      {phase === "go" && <div className="villain-count go">START!</div>}
    </div>
  );
}

