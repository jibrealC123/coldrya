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
// XP needed for the next level — mid-slow curve (kept in sync with the client)
const xpForLevel = (level) => 30 + (level - 1) * 20;
function addXp(p, n) {
  p.xp += n;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level += 1;
    p.xpNext = xpForLevel(p.level);
  }
}

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
const cleanChat = (v) => {
  const s = String(v ?? '');
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 32 && c !== 127) out += ch; // drop control characters
  }
  return out.trim().slice(0, 140);
};
const MAX_CHAT_HISTORY = 40;

/* ── global leaderboard (shared across all players) ──────────────────────
   Top scores live on the cloud server so everyone sees the same board.
   - If DATABASE_URL is set, scores persist in Postgres → permanent, they
     survive redeploys and cold starts.
   - Otherwise they fall back to a local JSON file (fine for dev / LAN, but
     ephemeral on a free host).
   An in-memory mirror is the source for GET responses (fast, no DB hit per
   request); it's loaded at startup and refreshed on every submit. */
const LB_MAX = 10; // entries shown on the board
const LB_KEEP = 200; // rows retained in the DB (bounded → table can't grow forever)
const LB_FILE = process.env.LEADERBOARD_FILE || path.join(__dirname, "leaderboard.json");
const MAX_SCORE = 5_000_000; // clamp absurd/forged values
const DATABASE_URL = process.env.DATABASE_URL;
let leaderboard = [];
let pgPool = null;

// Best-effort per-IP throttle for score submissions (the HTTP POST has no
// other limiter; behind the proxy we use the leftmost X-Forwarded-For).
const LB_POST_WINDOW = 10_000; // ms
const LB_POST_MAX = 6; // submissions per window per IP
const lbPostHits = new Map(); // ip -> [timestamps]
function lbRateLimited(ip) {
  const now = Date.now();
  let arr = lbPostHits.get(ip);
  if (!arr) {
    arr = [];
    lbPostHits.set(ip, arr);
  }
  while (arr.length && now - arr[0] > LB_POST_WINDOW) arr.shift();
  if (lbPostHits.size > 5000) {
    // opportunistic cleanup so the throttle map itself can't leak memory
    for (const [k, v] of lbPostHits) {
      while (v.length && now - v[0] > LB_POST_WINDOW) v.shift();
      if (!v.length) lbPostHits.delete(k);
    }
  }
  if (arr.length >= LB_POST_MAX) return true;
  arr.push(now);
  return false;
}
function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim().slice(0, 64);
  return (req.socket.remoteAddress || "unknown").slice(0, 64);
}

function pushToMirror(entry) {
  leaderboard.push(entry);
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, LB_MAX);
}

async function queryTopFromDb() {
  const r = await pgPool.query(
    "SELECT name, country, score, ts FROM scores ORDER BY score DESC, ts ASC LIMIT $1",
    [LB_MAX]
  );
  return r.rows.map((x) => ({ name: x.name, country: x.country, score: x.score, ts: Number(x.ts) }));
}

// Load the board at startup from Postgres (if configured) or the file.
async function initLeaderboard() {
  if (DATABASE_URL) {
    try {
      const { default: pg } = await import("pg");
      pgPool = new pg.Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // managed Postgres (Neon/Render) needs TLS
        max: 3,
      });
      await pgPool.query(
        `CREATE TABLE IF NOT EXISTS scores (
           id BIGSERIAL PRIMARY KEY,
           name TEXT NOT NULL,
           country TEXT NOT NULL,
           score INTEGER NOT NULL,
           ts BIGINT NOT NULL
         )`
      );
      await pgPool.query("CREATE INDEX IF NOT EXISTS scores_score_idx ON scores (score DESC)");
      leaderboard = await queryTopFromDb();
      console.log(`Leaderboard: Postgres (permanent) — ${leaderboard.length} scores loaded`);
      return;
    } catch (e) {
      pgPool = null;
      console.error("Leaderboard: Postgres init failed, falling back to file —", e.message);
    }
  }
  try {
    const raw = JSON.parse(fs.readFileSync(LB_FILE, "utf8"));
    if (Array.isArray(raw)) leaderboard = raw.filter((e) => e && typeof e.score === "number");
  } catch {
    /* no file yet */
  }
  console.log("Leaderboard: local file (ephemeral on free hosts)");
}

let lbSaveTimer = null;
function saveLeaderboardFile() {
  if (lbSaveTimer) return; // debounce disk writes
  lbSaveTimer = setTimeout(() => {
    lbSaveTimer = null;
    fs.writeFile(LB_FILE, JSON.stringify(leaderboard), () => {});
  }, 1000);
}

async function addLeaderboardScore(name, country, score) {
  const s = Math.floor(clamp(Number(score) || 0, 0, MAX_SCORE));
  if (s <= 0) return leaderboard;
  const entry = { name: cleanName(name), country: cleanCountry(country), score: s, ts: Date.now() };
  if (pgPool) {
    try {
      await pgPool.query("INSERT INTO scores (name, country, score, ts) VALUES ($1, $2, $3, $4)", [
        entry.name,
        entry.country,
        entry.score,
        entry.ts,
      ]);
      // prune to the top LB_KEEP so the table stays bounded forever
      await pgPool.query(
        "DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY score DESC, ts ASC LIMIT $1)",
        [LB_KEEP]
      );
      leaderboard = await queryTopFromDb();
      return leaderboard;
    } catch (e) {
      console.error("Leaderboard: DB write failed, mirroring in memory —", e.message);
      pushToMirror(entry); // keep serving something even if the DB hiccups
      return leaderboard;
    }
  }
  pushToMirror(entry);
  saveLeaderboardFile();
  return leaderboard;
}

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

// browser features the game never uses → disabled across the board
const PERMISSIONS_POLICY =
  "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";
function setCommonHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  // HSTS is ignored over plain http (the desktop app on localhost) and only
  // takes effect on the https cloud host — safe to send everywhere
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  res.setHeader("Permissions-Policy", PERMISSIONS_POLICY);
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
}

function createRequestHandler(DIST) {
  // CSP locks the app down to its own assets + the few known third parties
  // (Google Fonts, flag CDN, the game WebSocket). No inline/eval scripts.
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' https://flagcdn.com data:",
    // allow the cloud server too so the desktop app (served from localhost)
    // can reach the shared WebSocket + global-leaderboard API
    "connect-src 'self' ws: wss: https://void-raider.onrender.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  return (req, res) => {
    setCommonHeaders(res);
    if (req.url === "/healthz") {
      res.writeHead(200);
      return res.end("ok");
    }

    // ── global leaderboard API (public; CORS-open so the desktop app can read)
    const urlNoQuery = (req.url || "/").split("?")[0];
    if (urlNoQuery === "/api/leaderboard") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Cache-Control", "no-store"); // never cache live scores
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
      }
      if (req.method === "GET") {
        // benign health signal: permanent DB vs ephemeral file (no secrets)
        res.setHeader("X-Leaderboard-Store", pgPool ? "postgres" : "file");
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(leaderboard));
      }
      if (req.method === "POST") {
        if (lbRateLimited(clientIp(req))) {
          res.writeHead(429, { "Content-Type": "application/json" });
          return res.end(JSON.stringify(leaderboard));
        }
        let body = "";
        let tooBig = false;
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 1024) {
            tooBig = true;
            req.destroy();
          }
        });
        req.on("end", () => {
          if (tooBig) return;
          let msg;
          try {
            msg = JSON.parse(body);
          } catch {
            res.writeHead(400);
            return res.end("[]");
          }
          addLeaderboardScore(msg?.name, msg?.country, msg?.score)
            .then((board) => {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(board));
            })
            .catch(() => {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(leaderboard));
            });
        });
        return;
      }
      res.writeHead(405);
      return res.end();
    }

    res.setHeader("Content-Security-Policy", CSP);
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    // hashed build assets are immutable → cache hard; everything else
    // (index.html / SPA fallback) must revalidate so deploys are picked up
    res.setHeader(
      "Cache-Control",
      urlPath.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache"
    );
    const filePath = path.join(DIST, urlPath);
    // robust containment check: reject anything that resolves outside DIST
    // (path.relative avoids the startsWith() sibling-prefix pitfall)
    const rel = path.relative(DIST, filePath);
    if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) {
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
      started: false, // lobby until the host hits START
      startedAt: 0, // ms timestamp of START (drives the calm warm-up)
      hostId: null,
      chat: [], // recent chat messages (last LB-ish few, for late joiners)
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
    p.xp = 0;
    p.level = 1;
    p.xpNext = xpForLevel(1);
  }
}

// Host hits START: leave the lobby, wipe any prior round, begin play.
function startRoom(room) {
  resetRoom(room);
  room.started = true;
  room.startedAt = Date.now();
}

// Calm warm-up: the round eases in over the first CALM_SECS so friends can
// chat before the fast pace kicks in. Returns 0.35 (slow) → 1.0 (full).
const CALM_SECS = 180; // 3 minutes
function roundIntensity(room) {
  if (!room.startedAt) return 1;
  const elapsed = (Date.now() - room.startedAt) / 1000;
  if (elapsed >= CALM_SECS) return 1;
  return clamp(0.35 + 0.65 * (elapsed / CALM_SECS), 0.35, 1);
}

/* ── sim ─────────────────────────────────────────────────────────────── */
function spawnEnemy(room, intensity = 1) {
  const tier = Math.floor((room.wave - 1) / 3);
  const tough = Math.random() < clamp(0.16 + room.wave * 0.03, 0, 0.55);
  room.enemies.push({
    id: room.enemyId++,
    x: rand(40, WORLD.w - 40),
    y: -30,
    r: tough ? 20 : 14,
    vy: (rand(90, 150) + room.wave * 8) * (0.5 + 0.5 * intensity), // calm → slower descent
    sway: rand(30, 95),
    phase: rand(0, Math.PI * 2),
    hp: tough ? 3 : 1,
    maxHp: tough ? 3 : 1,
    canShoot: Math.random() < clamp((0.3 + tier * 0.15) * intensity, 0, 0.9), // calm → fewer shooters
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
  // lobby: no enemies/bullets until the host starts the round. Snapshots
  // still broadcast (the loop handles that) so the roster/ready list updates.
  if (!room.started) return;

  const aliveCount = [...room.players.values()].filter((p) => p.alive).length;

  // difficulty steps up every 3 waves (a "tier")
  const tier = Math.floor((room.wave - 1) / 3);
  // calm warm-up dampens everything for the first 3 min (1.0 = full pace)
  const intensity = roundIntensity(room);

  if (!room.over) {
    // spawning — dense from wave 1, denser each tier, with burst spawns
    room.spawnTimer -= dt;
    const interval = clamp(0.8 - tier * 0.16, 0.28, 0.8) / intensity; // calm → longer gaps
    if (room.spawnTimer <= 0 && aliveCount > 0) {
      room.spawnTimer = interval;
      spawnEnemy(room, intensity);
      for (let i = 0; i < 1 + tier; i++) {
        if (Math.random() < 0.5 * intensity) spawnEnemy(room, intensity);
      }
      // more players → more pressure
      if (room.players.size > 1 && Math.random() < 0.4 * intensity) spawnEnemy(room, intensity);
    }
    room.waveTimer += dt * intensity; // calm → waves advance slower
    if (room.waveTimer > 13) {
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
      const rate = p.rapid > 0 ? 0.12 * 0.45 : 0.12;
      p.cooldown = rate;
      const sp = 760;
      const o = p.id; // bullet owner → who earns the XP on hit
      if (p.triple > 0) {
        room.pbullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -sp, owner: o });
        room.pbullets.push({ x: p.x, y: p.y - 12, vx: -160, vy: -sp, owner: o });
        room.pbullets.push({ x: p.x, y: p.y - 12, vx: 160, vy: -sp, owner: o });
      } else {
        room.pbullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -sp, owner: o });
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
  const bulletSpeed = Math.min(340 + tier * 60, 640);
  const shots = Math.min(1 + tier, 5);
  const fireBase = clamp(1.7 - tier * 0.25, 0.45, 1.7) / intensity; // calm → longer between shots

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
        const shooter = room.players.get(b.owner);
        if (shooter) addXp(shooter, 1); // every hit feeds the shooter's level bar
        if (e.hp <= 0) {
          room.teamScore += e.score;
          if (shooter) addXp(shooter, 3); // kill bonus
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
    started: room.started,
    hostId: room.hostId,
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
      ready: !!p.ready,
      xp: p.xp,
      lvl: p.level,
      xn: p.xpNext,
    })),
    enemies: room.enemies.map((e) => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), r: e.r, hp: e.hp, mh: e.maxHp })),
    pb: room.pbullets.map((b) => [Math.round(b.x), Math.round(b.y)]),
    eb: room.ebullets.map((b) => [Math.round(b.x), Math.round(b.y)]),
    pw: room.powerups.map((p) => [Math.round(p.x), Math.round(p.y), p.type]),
  };
}

function broadcastToRoom(room, obj) {
  const data = JSON.stringify(obj);
  for (const p of room.players.values()) {
    if (p.ws.readyState === 1) p.ws.send(data);
  }
}

/* ── server bootstrap ────────────────────────────────────────────────── */
let pid = 1;

export function startServer({ port = PORT, distPath = DEFAULT_DIST } = {}) {
  initLeaderboard(); // load Postgres/file board (async; GET serves [] until ready)
  const server = http.createServer(createRequestHandler(distPath));
  // small payload cap + no compression (deflate is a needless DoS surface here)
  const wss = new WebSocketServer({ server, maxPayload: MAX_PAYLOAD, perMessageDeflate: false });

  // remove a socket's player from its room (and drop the room if now empty)
  const leaveRoom = (ws) => {
    if (ws.room && ws.player) {
      const room = ws.room;
      room.players.delete(ws.player.id);
      if (room.players.size === 0) {
        rooms.delete(room.code);
      } else if (room.hostId === ws.player.id) {
        // host left — hand the room to whoever's next
        room.hostId = room.players.keys().next().value;
      }
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
          ready: false,
          xp: 0,
          level: 1,
          xpNext: xpForLevel(1),
          ws,
        };
        room.players.set(player.id, player);
        if (room.hostId == null) room.hostId = player.id; // first in = host
        ws.player = player;
        ws.room = room;
        ws.send(JSON.stringify({ t: "welcome", id: player.id, room: code, w: WORLD.w, h: WORLD.h, host: room.hostId === player.id }));
        if (room.chat.length) ws.send(JSON.stringify({ t: "chatlog", messages: room.chat }));
      } else if (msg.t === "input" && ws.player) {
        const p = ws.player;
        if (Number.isFinite(msg.x)) p.x = clamp(msg.x, 18, WORLD.w - 18);
        if (Number.isFinite(msg.y)) p.y = clamp(msg.y, 50, WORLD.h - 30);
        p.firing = !!msg.firing;
      } else if (msg.t === "ready" && ws.player) {
        ws.player.ready = !!msg.ready;
      } else if (msg.t === "start" && ws.room && ws.player) {
        // only the host can launch the round
        if (ws.room.hostId === ws.player.id && !ws.room.started) startRoom(ws.room);
      } else if (msg.t === "restart" && ws.room && ws.room.over) {
        // only after the round actually ended — stops mid-game reset griefing
        resetRoom(ws.room);
      } else if (msg.t === "chat" && ws.player && ws.room) {
        // simple per-player throttle (≤ ~2 msgs/sec) on top of the global cap
        if (now - (ws.player.lastChatAt || 0) < 500) return;
        const text = cleanChat(msg.text);
        if (!text) return;
        ws.player.lastChatAt = now;
        const entry = {
          id: ws.player.id,
          name: ws.player.name,
          country: ws.player.country,
          text,
          ts: now,
        };
        ws.room.chat.push(entry);
        if (ws.room.chat.length > MAX_CHAT_HISTORY) ws.room.chat.shift();
        broadcastToRoom(ws.room, { t: "chat", msg: entry });
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
      console.log(`ColdRya server on :${actual}  (ws + static dist/)`);
      resolve({ server, port: actual });
    });
  });
}

// run standalone when invoked directly (cloud deploy / `npm run server`)
const invokedDirectly = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  startServer();
}
