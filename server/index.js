/* ════════════════════════════════════════════════════════════════════
   VOID RAIDER — authoritative co-op multiplayer server
   - Owns enemies, bullets, collisions, waves, shared team score.
   - Clients control only their own ship position + a "firing" flag;
     the server spawns their bullets and resolves all hits.
   - Serves the built client (dist/) and the WebSocket on the same port,
     so a single cloud service hosts the whole game.
   World is a fixed 1000×720 arena; clients letterbox it to their screen.
═══════════════════════════════════════════════════════════════════════ */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST = path.join(__dirname, "..", "dist");
const PORT = process.env.PORT || 8787;
const TICK = 1000 / 30; // 30 Hz authoritative sim
const SNAP_EVERY = 1; // broadcast every tick

const WORLD = { w: 1000, h: 720 };
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const d2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

// abuse / DoS limits
const MAX_PAYLOAD = 4096; // bytes per WS message (game messages are tiny)
const MAX_CONNECTIONS = 400; // total concurrent sockets
const MAX_ROOMS = 300; // total concurrent rooms
const MAX_PLAYERS_PER_ROOM = 12;
const MAX_MSG_PER_SEC = 150; // per-connection message rate cap

// sanitize untrusted client strings (defense-in-depth; clients are untrusted)
const cleanName = (v) => {
  const s = String(v ?? 'PILOT');
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 32 && c !== 127) out += ch; // drop control characters
  }
  return out.slice(0, 16).trim() || 'PILOT';
};
const cleanCountry = (v) =>
  (String(v ?? 'us').toLowerCase().match(/[a-z]/g) || ['u', 's']).join('').slice(0, 2) || 'us';

/* ── static file server (prod) ───────────────────────────────────────── */
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function createRequestHandler(DIST) {
  // CSP locks the app down to its own assets + the few known third parties
  // (Google Fonts, flag CDN, the game WebSocket). No inline/eval scripts.
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' https://flagcdn.com data:",
    "connect-src 'self' ws: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  return (req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200);
      return res.end("ok");
    }
    res.setHeader("Content-Security-Policy", CSP);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = path.join(DIST, urlPath);
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403);
      return res.end("forbidden");
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        // SPA fallback
        fs.readFile(path.join(DIST, "index.html"), (e2, html) => {
          if (e2) {
            res.writeHead(404);
            return res.end("not found (build the client: npm run build)");
          }
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(html);
        });
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  };
}

/* ── rooms ───────────────────────────────────────────────────────────── */
const rooms = new Map();

function getRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = {
      code,
      players: new Map(), // id -> player
      enemies: [],
      pbullets: [],
      ebullets: [],
      powerups: [],
      wave: 1,
      waveTimer: 0,
      spawnTimer: 0,
      teamScore: 0,
      over: false,
      enemyId: 1,
      nextRespawnCheck: 0,
    };
    rooms.set(code, room);
  }
  return room;
}

function resetRoom(room) {
  room.enemies = [];
  room.pbullets = [];
  room.ebullets = [];
  room.powerups = [];
  room.wave = 1;
  room.waveTimer = 0;
  room.spawnTimer = 0;
  room.teamScore = 0;
  room.over = false;
  for (const p of room.players.values()) {
    p.lives = 3;
    p.alive = true;
    p.invuln = 1;
    p.cooldown = 0;
    p.triple = 0;
    p.rapid = 0;
    p.shield = 0;
  }
}

/* ── sim ─────────────────────────────────────────────────────────────── */
function spawnEnemy(room) {
  const tier = Math.floor((room.wave - 1) / 3);
  const tough = Math.random() < clamp(0.12 + room.wave * 0.03, 0, 0.5);
  room.enemies.push({
    id: room.enemyId++,
    x: rand(40, WORLD.w - 40),
    y: -30,
    r: tough ? 20 : 14,
    vy: rand(50, 90) + room.wave * 5,
    sway: rand(20, 70),
    phase: rand(0, Math.PI * 2),
    hp: tough ? 3 : 1,
    maxHp: tough ? 3 : 1,
    canShoot: Math.random() < clamp(0.25 + tier * 0.15, 0, 0.9),
    fireCd: rand(0.8, 2.5),
    score: tough ? 50 : 20,
  });
}

function nearestAlive(room, x, y) {
  let best = null;
  let bd = Infinity;
  for (const p of room.players.values()) {
    if (!p.alive) continue;
    const dd = d2(x, y, p.x, p.y);
    if (dd < bd) {
      bd = dd;
      best = p;
    }
  }
  return best;
}

function tick(room, dt) {
  const anyPlayers = room.players.size > 0;
  if (!anyPlayers) return;

  const aliveCount = [...room.players.values()].filter((p) => p.alive).length;

  // difficulty steps up every 3 waves (a "tier")
  const tier = Math.floor((room.wave - 1) / 3);

  if (!room.over) {
    // spawning — denser each tier, with burst spawns
    room.spawnTimer -= dt;
    const interval = clamp(1.4 - tier * 0.22, 0.3, 1.4);
    if (room.spawnTimer <= 0 && aliveCount > 0) {
      room.spawnTimer = interval;
      spawnEnemy(room);
      for (let i = 0; i < Math.min(tier, 3); i++) {
        if (Math.random() < 0.5) spawnEnemy(room);
      }
      // more players → more pressure
      if (room.players.size > 1 && Math.random() < 0.4) spawnEnemy(room);
    }
    room.waveTimer += dt;
    if (room.waveTimer > 18) {
      room.waveTimer = 0;
      room.wave += 1;
    }
  }

  // players: firing → bullets
  for (const p of room.players.values()) {
    p.invuln = Math.max(0, p.invuln - dt);
    p.cooldown -= dt;
    p.triple = Math.max(0, p.triple - dt);
    p.rapid = Math.max(0, p.rapid - dt);
    p.shield = Math.max(0, p.shield - dt);
    if (!p.alive || room.over) continue;
    if (p.firing && p.cooldown <= 0) {
      const rate = p.rapid > 0 ? 0.18 * 0.45 : 0.18;
      p.cooldown = rate;
      const sp = 620;
      if (p.triple > 0) {
        room.pbullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -sp });
        room.pbullets.push({ x: p.x, y: p.y - 12, vx: -160, vy: -sp });
        room.pbullets.push({ x: p.x, y: p.y - 12, vx: 160, vy: -sp });
      } else {
        room.pbullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -sp });
      }
    }
  }

  // bullets
  room.pbullets = room.pbullets.filter((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    return b.y > -20 && b.x > -20 && b.x < WORLD.w + 20;
  });
  room.ebullets = room.ebullets.filter((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    return b.y < WORLD.h + 20 && b.y > -20 && b.x > -20 && b.x < WORLD.w + 20;
  });

  // enemy fire steps up each tier: faster bullets, shorter cooldown, one
  // extra bullet per shot (spread burst)
  const bulletSpeed = Math.min(220 + tier * 60, 560);
  const shots = Math.min(1 + tier, 5);
  const fireBase = clamp(2.4 - tier * 0.35, 0.5, 2.4);

  // enemies
  for (const e of room.enemies) {
    e.y += e.vy * dt;
    e.x = clamp(e.x + Math.sin(e.y * 0.02 + e.phase) * e.sway * dt, 16, WORLD.w - 16);
    if (e.canShoot && !room.over) {
      e.fireCd -= dt;
      if (e.fireCd <= 0 && e.y < WORLD.h * 0.7) {
        e.fireCd = rand(fireBase * 0.6, fireBase);
        const target = nearestAlive(room, e.x, e.y);
        if (target) {
          const ang = Math.atan2(target.y - e.y, target.x - e.x);
          for (let s = 0; s < shots; s++) {
            const a = ang + (s - (shots - 1) / 2) * 0.18;
            room.ebullets.push({ x: e.x, y: e.y + e.r, vx: Math.cos(a) * bulletSpeed, vy: Math.sin(a) * bulletSpeed });
          }
        }
      }
    }
  }

  // powerups fall + pickup
  room.powerups = room.powerups.filter((pw) => {
    pw.y += 90 * dt;
    for (const p of room.players.values()) {
      if (!p.alive) continue;
      if (d2(pw.x, pw.y, p.x, p.y) < (pw.r + 16) ** 2) {
        if (pw.type === "triple") p.triple = 8;
        else if (pw.type === "rapid") p.rapid = 8;
        else if (pw.type === "shield") p.shield = 10;
        return false;
      }
    }
    return pw.y < WORLD.h + 20;
  });

  // collisions: pbullets vs enemies
  for (const e of room.enemies) {
    for (const b of room.pbullets) {
      if (b.dead) continue;
      if (d2(b.x, b.y, e.x, e.y) < (e.r + 4) ** 2) {
        b.dead = true;
        e.hp -= 1;
        if (e.hp <= 0) {
          room.teamScore += e.score;
          e.dead = true;
          if (Math.random() < 0.12) {
            const types = ["triple", "rapid", "shield"];
            room.powerups.push({ x: e.x, y: e.y, r: 12, type: types[(Math.random() * 3) | 0] });
          }
          break;
        }
      }
    }
  }
  room.pbullets = room.pbullets.filter((b) => !b.dead);
  room.enemies = room.enemies.filter((e) => !e.dead && e.y < WORLD.h + 40);

  // collisions vs players
  for (const p of room.players.values()) {
    if (!p.alive || p.invuln > 0) continue;
    let hit = false;
    for (const b of room.ebullets) {
      if (b.dead) continue;
      if (d2(b.x, b.y, p.x, p.y) < (16 + 4) ** 2) {
        b.dead = true;
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (const e of room.enemies) {
        if (d2(e.x, e.y, p.x, p.y) < (e.r + 16) ** 2) {
          e.dead = true;
          hit = true;
          break;
        }
      }
    }
    if (hit) hitPlayer(p);
  }
  room.ebullets = room.ebullets.filter((b) => !b.dead);
  room.enemies = room.enemies.filter((e) => !e.dead);

  // round end: everyone dead
  if (!room.over && room.players.size > 0 && aliveCount === 0) {
    room.over = true;
  }
}

function hitPlayer(p) {
  if (p.shield > 0) {
    p.shield = 0;
    p.invuln = 1;
    return;
  }
  p.lives -= 1;
  p.invuln = 1.4;
  if (p.lives <= 0) {
    p.lives = 0;
    p.alive = false;
  }
}

/* ── snapshots ───────────────────────────────────────────────────────── */
function snapshot(room) {
  return {
    t: "snap",
    w: WORLD.w,
    h: WORLD.h,
    wave: room.wave,
    teamScore: room.teamScore,
    over: room.over,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      country: p.country,
      x: Math.round(p.x),
      y: Math.round(p.y),
      lives: p.lives,
      alive: p.alive,
      shield: p.shield > 0,
      invuln: p.invuln > 0,
    })),
    enemies: room.enemies.map((e) => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), r: e.r, hp: e.hp, mh: e.maxHp })),
    pb: room.pbullets.map((b) => [Math.round(b.x), Math.round(b.y)]),
    eb: room.ebullets.map((b) => [Math.round(b.x), Math.round(b.y)]),
    pw: room.powerups.map((p) => [Math.round(p.x), Math.round(p.y), p.type]),
  };
}

/* ── server bootstrap ────────────────────────────────────────────────── */
let pid = 1;

export function startServer({ port = PORT, distPath = DEFAULT_DIST } = {}) {
  const server = http.createServer(createRequestHandler(distPath));
  // small payload cap + no compression (deflate is a needless DoS surface here)
  const wss = new WebSocketServer({ server, maxPayload: MAX_PAYLOAD, perMessageDeflate: false });

  // remove a socket's player from its room (and drop the room if now empty)
  const leaveRoom = (ws) => {
    if (ws.room && ws.player) {
      ws.room.players.delete(ws.player.id);
      if (ws.room.players.size === 0) rooms.delete(ws.room.code);
    }
    ws.player = null;
    ws.room = null;
  };

  wss.on("connection", (ws) => {
    // cap total concurrent connections
    if (wss.clients.size > MAX_CONNECTIONS) {
      ws.close(1013, "server busy");
      return;
    }
    ws.isAlive = true;
    ws.player = null;
    ws.room = null;
    ws.msgCount = 0;
    ws.msgWindow = Date.now();
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (raw) => {
      // per-connection message rate limit
      const now = Date.now();
      if (now - ws.msgWindow >= 1000) {
        ws.msgWindow = now;
        ws.msgCount = 0;
      }
      if (++ws.msgCount > MAX_MSG_PER_SEC) return;

      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      if (msg.t === "join") {
        // one player per socket: drop any previous one (prevents join-spam leak)
        leaveRoom(ws);
        const code = String(msg.room || "lobby").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "LOBBY";
        // refuse to create a brand-new room past the global cap
        if (!rooms.has(code) && rooms.size >= MAX_ROOMS) {
          ws.send(JSON.stringify({ t: "denied", reason: "Server is at capacity. Try again later." }));
          return;
        }
        const room = getRoom(code);
        if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
          if (room.players.size === 0) rooms.delete(code);
          ws.send(JSON.stringify({ t: "denied", reason: "That room is full." }));
          return;
        }
        const player = {
          id: pid++,
          name: cleanName(msg.name),
          country: cleanCountry(msg.country),
          x: WORLD.w / 2 + rand(-80, 80),
          y: WORLD.h - 90,
          firing: false,
          lives: 3,
          alive: true,
          invuln: 1.5,
          cooldown: 0,
          triple: 0,
          rapid: 0,
          shield: 0,
          ws,
        };
        room.players.set(player.id, player);
        ws.player = player;
        ws.room = room;
        ws.send(JSON.stringify({ t: "welcome", id: player.id, room: code, w: WORLD.w, h: WORLD.h }));
      } else if (msg.t === "input" && ws.player) {
        const p = ws.player;
        if (Number.isFinite(msg.x)) p.x = clamp(msg.x, 18, WORLD.w - 18);
        if (Number.isFinite(msg.y)) p.y = clamp(msg.y, 50, WORLD.h - 30);
        p.firing = !!msg.firing;
      } else if (msg.t === "restart" && ws.room) {
        resetRoom(ws.room);
      }
    });

    ws.on("close", () => leaveRoom(ws));
    ws.on("error", () => leaveRoom(ws));
  });

  // heartbeat: drop dead sockets
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 15000);

  // authoritative main loop
  let last = Date.now();
  let tickCount = 0;
  const loop = setInterval(() => {
    const now = Date.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    tickCount++;
    for (const room of rooms.values()) {
      tick(room, dt);
      if (tickCount % SNAP_EVERY === 0 && room.players.size > 0) {
        const snap = JSON.stringify(snapshot(room));
        for (const p of room.players.values()) {
          if (p.ws.readyState === 1) p.ws.send(snap);
        }
      }
    }
  }, TICK);

  server.on("close", () => {
    clearInterval(heartbeat);
    clearInterval(loop);
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      const actual = server.address().port;
      console.log(`VOID RAIDER server on :${actual}  (ws + static dist/)`);
      resolve({ server, port: actual });
    });
  });
}

// run standalone when invoked directly (cloud deploy / `npm run server`)
const invokedDirectly = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  startServer();
}
