/* ════════════════════════════════════════════════════════════════════
   ColdRya — 2D arcade space shooter engine
   Plain-JS canvas engine. React owns the menu/HUD; this owns the play.
   Palette: neon blue player, red enemies, green pickups, dark space bg.
═══════════════════════════════════════════════════════════════════════ */

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

const COLORS = {
  player: "#2563EB",
  playerGlow: "#60a5fa",
  bullet: "#a5f3fc",
  enemy: "#DC2626",
  enemyGlow: "#f87171",
  enemyBullet: "#fb923c",
  power: "#22C55E",
};

/* ── Mk-I Interceptor — pixel-art player ship ──────────────────────────
   24×25 pixel sprite, nose up. Left half is authored (cols 0–11) and
   mirrored to the right (mx = 23 - x). Baked once to an offscreen canvas
   then drawn scaled with smoothing off for crisp pixels. The engine flame
   is rendered procedurally each frame so it flickers. */
const SHIP_PALETTE = {
  B: "#0e1e34", K: "#0c1826", D: "#0e2040", d: "#183560", n: "#204882",
  m: "#2a5ca8", L: "#3878d0", l: "#5090e8", H: "#6ab0ff", h: "#90d0ff",
  c: "#005888", C: "#0090e0", S: "#20d8ff", W: "#c0f4ff",
  E: "#ff3000", O: "#ff9000", G: "#ffe020", w: "#fff8a0",
  F: "#08121e", g: "#142235", f: "#1c3858",
  A: "#1e2028", a: "#2c2e3c", e: "#4a4e62",
};
// Left-half pixels [col, colorKey] per row (y = row index, 0 = nose).
const SHIP_BODY = [
  [[10, "B"], [11, "D"]],
  [[9, "B"], [10, "n"], [11, "n"]],
  [[9, "B"], [10, "c"], [11, "S"]],
  [[8, "B"], [9, "c"], [10, "S"], [11, "W"]],
  [[8, "B"], [9, "n"], [10, "S"], [11, "S"]],
  [[8, "B"], [9, "n"], [10, "C"], [11, "C"]],
  [[8, "B"], [9, "d"], [10, "C"], [11, "c"]],
  [[7, "B"], [8, "D"], [9, "d"], [10, "m"], [11, "n"]],
  [[7, "B"], [8, "D"], [9, "d"], [10, "n"], [11, "m"]],
  [[7, "e"], [8, "D"], [9, "d"], [10, "n"], [11, "m"]],
  [[5, "e"], [6, "A"], [7, "a"], [8, "B"], [9, "d"], [10, "m"], [11, "L"]],
  [[4, "e"], [5, "A"], [6, "A"], [7, "a"], [8, "B"], [9, "m"], [10, "L"], [11, "l"]],
  [[3, "e"], [4, "A"], [5, "A"], [6, "A"], [7, "a"], [8, "B"], [9, "l"], [10, "H"], [11, "H"]],
  [[2, "e"], [3, "A"], [4, "A"], [5, "A"], [6, "a"], [7, "a"], [8, "B"], [9, "g"], [10, "F"], [11, "F"]],
  [[2, "e"], [3, "A"], [4, "A"], [5, "A"], [6, "a"], [7, "a"], [8, "B"], [9, "g"], [10, "F"], [11, "F"]],
  [[2, "e"], [3, "A"], [4, "A"], [5, "A"], [6, "a"], [7, "a"], [8, "B"], [9, "g"], [10, "F"], [11, "F"]],
  [[2, "e"], [3, "A"], [4, "A"], [5, "A"], [6, "a"], [7, "a"], [8, "B"], [9, "g"], [10, "F"], [11, "F"]],
  [[2, "e"], [3, "A"], [4, "A"], [5, "A"], [6, "a"], [7, "a"], [8, "B"], [9, "g"], [10, "F"], [11, "F"]],
  [[3, "e"], [4, "A"], [5, "A"], [6, "A"], [7, "a"], [8, "B"], [9, "l"], [10, "H"], [11, "h"]],
  [[4, "e"], [5, "A"], [6, "A"], [7, "a"], [8, "B"], [9, "m"], [10, "L"], [11, "l"]],
  [[5, "e"], [6, "A"], [7, "a"], [8, "B"], [9, "n"], [10, "m"], [11, "L"]],
  [[8, "B"], [9, "D"], [10, "d"], [11, "n"]],
  [[10, "E"], [11, "E"]],
  [[10, "E"], [11, "O"]],
  [[11, "O"]],
];
// Wing-tip nav lights (red port / green starboard), sit on row 16.
const SHIP_NAV = [
  { x: 2, y: 16, c: "#ff2020" },
  { x: 21, y: 16, c: "#20ff66" },
];
const SHIP_W = 24;
const SHIP_H = SHIP_BODY.length; // 25
const ENGINE_ROW = SHIP_BODY.length - 2; // y of nozzle exit (flame origin)

// Bake a left-half-authored, mirrored pixel sprite to an offscreen canvas.
function bakePixels(palette, rows, width, extras) {
  const cv = document.createElement("canvas");
  cv.width = width;
  cv.height = rows.length;
  const c = cv.getContext("2d");
  rows.forEach((row, y) => {
    for (const [x, k] of row) {
      const col = palette[k];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(x, y, 1, 1);
      const mx = width - 1 - x;
      if (mx !== x) c.fillRect(mx, y, 1, 1);
    }
  });
  if (extras) for (const e of extras) { c.fillStyle = e.c; c.fillRect(e.x, e.y, 1, 1); }
  return cv;
}

function buildShipSprite(tintFilter) {
  const cv = bakePixels(SHIP_PALETTE, SHIP_BODY, SHIP_W, SHIP_NAV);
  if (!tintFilter) return cv;
  // Remote allies: recolor blue → green via hue-rotate on a copy.
  const out = document.createElement("canvas");
  out.width = cv.width;
  out.height = cv.height;
  const oc = out.getContext("2d");
  oc.filter = tintFilter;
  oc.drawImage(cv, 0, 0);
  return out;
}

/* ── Enemy raiders — pixel-art, same hand as the player ship but nose
   DOWN (toward the player) and in the red hostile palette. Two classes:
   a fast "Stinger" drone (1 HP) and an armored "Hex Cruiser" (3 HP). */
const ENEMY_PALETTE = {
  R: "#DC2626", r: "#991b1b", o: "#f87171", e: "#7a2a2a",
  H: "#3a0a0a", h: "#5a1515", K: "#1a0606",
  C: "#fb923c", Y: "#fde047",
};
// Stinger drone — 16 wide, nose at bottom.
const ENEMY_BASIC = [
  [[6, "r"], [7, "R"]],
  [[6, "R"], [7, "o"]],
  [[3, "e"], [5, "r"], [6, "R"], [7, "R"]],
  [[2, "e"], [3, "r"], [4, "r"], [5, "R"], [6, "R"], [7, "o"]],
  [[1, "e"], [2, "r"], [3, "R"], [4, "R"], [5, "R"], [6, "C"], [7, "C"]],
  [[0, "e"], [1, "r"], [2, "R"], [3, "R"], [4, "R"], [5, "R"], [6, "Y"], [7, "Y"]],
  [[1, "e"], [2, "r"], [3, "R"], [4, "R"], [5, "R"], [6, "C"], [7, "C"]],
  [[3, "r"], [4, "R"], [5, "R"], [6, "R"], [7, "R"]],
  [[5, "r"], [6, "R"], [7, "R"]],
  [[6, "r"], [7, "R"]],
  [[6, "r"], [7, "R"]],
  [[7, "R"]],
  [[7, "r"]],
];
const ENEMY_BASIC_W = 16;
// Hex Cruiser — 20 wide, armored diamond with a glowing core.
const ENEMY_TOUGH = [
  [[8, "r"], [9, "R"]],
  [[7, "r"], [8, "R"], [9, "R"]],
  [[6, "e"], [7, "r"], [8, "R"], [9, "o"]],
  [[5, "e"], [6, "r"], [7, "R"], [8, "R"], [9, "R"]],
  [[4, "e"], [5, "r"], [6, "R"], [7, "R"], [8, "R"], [9, "R"]],
  [[3, "e"], [4, "r"], [5, "R"], [6, "R"], [7, "H"], [8, "H"], [9, "R"]],
  [[2, "e"], [3, "r"], [4, "R"], [5, "R"], [6, "H"], [7, "C"], [8, "C"], [9, "R"]],
  [[1, "e"], [2, "r"], [3, "R"], [4, "R"], [5, "H"], [6, "C"], [7, "Y"], [8, "Y"], [9, "o"]],
  [[0, "e"], [1, "r"], [2, "R"], [3, "R"], [4, "H"], [5, "C"], [6, "Y"], [7, "Y"], [8, "C"], [9, "R"]],
  [[1, "e"], [2, "r"], [3, "R"], [4, "R"], [5, "H"], [6, "C"], [7, "Y"], [8, "Y"], [9, "o"]],
  [[2, "e"], [3, "r"], [4, "R"], [5, "R"], [6, "H"], [7, "C"], [8, "C"], [9, "R"]],
  [[3, "e"], [4, "r"], [5, "R"], [6, "R"], [7, "H"], [8, "H"], [9, "R"]],
  [[4, "e"], [5, "r"], [6, "R"], [7, "R"], [8, "R"], [9, "R"]],
  [[5, "e"], [6, "r"], [7, "R"], [8, "R"], [9, "R"]],
  [[6, "e"], [7, "r"], [8, "R"], [9, "o"]],
  [[7, "r"], [8, "R"], [9, "R"]],
  [[8, "r"], [9, "R"]],
  [[9, "R"]],
];
const ENEMY_TOUGH_W = 20;

export class Engine {
  constructor(canvas, { onState }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onState = onState || (() => {});
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.keys = new Set();
    this.pointer = { x: null, y: null, active: false };
    this.running = false;
    this.rafId = null;
    this.hurt = 0; // red "zap" flash timer
    this.freeze = 0; // hitstop timer

    // multiplayer (co-op)
    this.mp = false;
    this.net = null;
    this.world = { w: 1000, h: 720 };
    this.view = { scale: 1, ox: 0, oy: 0 };
    this.snap = null;
    this.remote = new Map(); // smoothed remote player positions, id -> {x,y}
    this.enemyView = new Map(); // smoothed enemy positions, id -> {x,y}
    this.prevEnemies = new Map();
    this.prevAlive = new Map();
    this.flagImgs = new Map();
    this._sendAccum = 0;
    this.lastTs = 0;

    this._bind();
    this.resize();
    this._initStars();
  }

  /* ── lifecycle ─────────────────────────────────────────────────── */
  startGame(pilot = null) {
    // pilot = { username, country: { code, name } } — kept for the ship
    // model / flag that gets attached later.
    this.pilot = pilot;
    this.player = {
      x: this.W / 2,
      y: this.H - 90,
      r: 16,
      speed: 480,
      cooldown: 0,
      fireRate: 0.12,
      invuln: 0,
      triple: 0,
      rapid: 0,
      shield: 0,
    };
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.particles = [];
    this.powerups = [];
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.shake = 0;
    this.status = "playing";
    this._emit();

    this.running = true;
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this._loop);
  }

  /* ── multiplayer (co-op) ───────────────────────────────────────── */
  startMultiplayer(net, pilot) {
    this.mp = true;
    this.net = net;
    this.pilot = pilot;
    this.snap = null;
    this.remote.clear();
    this.enemyView.clear();
    this.prevEnemies.clear();
    this.prevAlive.clear();
    this.particles = [];
    this.shake = 0;
    this.hurt = 0;
    this.freeze = 0;
    this.prevMyLives = null;
    // my locally-predicted ship, in WORLD coordinates
    this.me = { x: this.world.w / 2, y: this.world.h - 90, r: 16, speed: 480 };
    this.status = "playing";
    this._computeView();
    this._emit();
    this.running = true;
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this._loop);
  }

  applySnap(snap) {
    if (!this.mp) return;
    if (snap.w) this.world.w = snap.w;
    if (snap.h) this.world.h = snap.h;
    this.snap = snap;

    // spawn explosion particles for enemies that vanished since last snap
    const nowIds = new Set(snap.enemies.map((e) => e.id));
    for (const [id, e] of this.prevEnemies) {
      if (!nowIds.has(id)) this._explode(e.x, e.y, e.r || 14);
    }
    this.prevEnemies = new Map(snap.enemies.map((e) => [e.id, { x: e.x, y: e.y, r: e.r }]));

    // explosion when a player just died
    for (const p of snap.players) {
      const was = this.prevAlive.get(p.id);
      if (was === true && p.alive === false) {
        this._explode(p.x, p.y, 18);
        this.shake = 0.3;
      }
      this.prevAlive.set(p.id, p.alive);
    }

    // HUD state from the shared world
    const me = snap.players.find((p) => p.id === this.net?.id);
    // hurt feedback when MY ship loses a life
    if (me) {
      if (this.prevMyLives != null && me.lives < this.prevMyLives) {
        this.hurt = 0.5;
        this.freeze = 0.12;
        this.shake = 0.32;
      }
      this.prevMyLives = me.lives;
    }
    const nextStatus = snap.over ? "over" : "playing";
    const changed =
      this.score !== snap.teamScore ||
      this.wave !== snap.wave ||
      this.lives !== (me ? me.lives : 0) ||
      this.status !== nextStatus;
    this.score = snap.teamScore;
    this.wave = snap.wave;
    this.lives = me ? me.lives : 0;
    this.status = nextStatus;
    if (changed) this._emit();
  }

  restartMultiplayer() {
    this.net?.restart();
  }

  leaveMultiplayer() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.mp = false;
    this.net = null;
    this.snap = null;
    this.status = "menu";
    this._emit();
  }

  _computeView() {
    const s = Math.min(this.W / this.world.w, this.H / this.world.h);
    this.view.scale = s;
    this.view.ox = (this.W - this.world.w * s) / 2;
    this.view.oy = (this.H - this.world.h * s) / 2;
  }

  _flag(code) {
    if (!code) return null;
    let img = this.flagImgs.get(code);
    if (!img) {
      img = new Image();
      img.src = `https://flagcdn.com/w40/${code}.png`;
      this.flagImgs.set(code, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  pause() {
    if (this.status !== "playing") return;
    this.running = false;
    this.status = "paused";
    cancelAnimationFrame(this.rafId);
    this._emit();
  }

  resume() {
    if (this.status !== "paused") return;
    this.running = true;
    this.status = "playing";
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this._loop);
    this._emit();
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this._unbind();
  }

  /* ── sizing ────────────────────────────────────────────────────── */
  resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    this.W = rect.width;
    this.H = rect.height;
    this.canvas.width = Math.floor(rect.width * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.player) {
      this.player.x = clamp(this.player.x, 20, this.W - 20);
      this.player.y = clamp(this.player.y, 40, this.H - 40);
    }
    if (this.mp) this._computeView();
  };

  _initStars() {
    const make = (count, speed, size, alpha) =>
      Array.from({ length: count }, () => ({
        x: rand(0, this.W || 600),
        y: rand(0, this.H || 800),
        speed,
        size,
        alpha,
      }));
    this.starsFar = make(60, 18, 1, 0.4);
    this.starsNear = make(35, 55, 2, 0.85);
  }

  /* ── input ─────────────────────────────────────────────────────── */
  _bind() {
    this._onKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
        e.preventDefault();
      this.keys.add(e.key.toLowerCase());
    };
    this._onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
    this._onPointerMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - rect.left;
      this.pointer.y = e.clientY - rect.top;
    };
    this._onPointerDown = (e) => {
      this.pointer.active = true;
      this._onPointerMove(e);
    };
    this._onPointerUp = () => {
      this.pointer.active = false;
    };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("resize", this.resize);
    this.canvas.addEventListener("pointermove", this._onPointerMove);
    this.canvas.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("pointerup", this._onPointerUp);
  }

  _unbind() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("resize", this.resize);
    this.canvas.removeEventListener("pointermove", this._onPointerMove);
    this.canvas.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("pointerup", this._onPointerUp);
  }

  _emit() {
    this.onState({
      score: this.score,
      lives: this.lives,
      wave: this.wave,
      status: this.status,
    });
  }

  /* ── main loop ─────────────────────────────────────────────────── */
  _loop = (ts) => {
    if (!this.running) return;
    const dt = Math.min((ts - this.lastTs) / 1000, 0.05);
    this.lastTs = ts;
    // hurt flash always fades on real time
    this.hurt = Math.max(0, (this.hurt || 0) - dt);
    if (this.freeze > 0) {
      // brief hitstop — world frozen, but still render the frame + flash
      this.freeze -= dt;
      this._render();
    } else {
      this._update(dt);
      this._render();
    }
    this.rafId = requestAnimationFrame(this._loop);
  };

  /* ── update ────────────────────────────────────────────────────── */
  _update(dt) {
    if (this.mp) return this._updateMp(dt);
    const p = this.player;

    // starfield scroll
    for (const layer of [this.starsFar, this.starsNear]) {
      for (const s of layer) {
        s.y += s.speed * dt;
        if (s.y > this.H) {
          s.y = 0;
          s.x = rand(0, this.W);
        }
      }
    }

    // movement — keyboard
    let dx = 0;
    let dy = 0;
    if (this.keys.has("arrowleft") || this.keys.has("a")) dx -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) dx += 1;
    if (this.keys.has("arrowup") || this.keys.has("w")) dy -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) dy += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      p.x += (dx / len) * p.speed * dt;
      p.y += (dy / len) * p.speed * dt;
    }
    // movement — pointer (follow when active / hovering)
    if (this.pointer.x != null && (this.pointer.active || this.pointer.y != null)) {
      if (this.pointer.active) {
        p.x += (this.pointer.x - p.x) * Math.min(1, dt * 12);
        p.y += (this.pointer.y - p.y) * Math.min(1, dt * 12);
      }
    }
    p.x = clamp(p.x, 18, this.W - 18);
    p.y = clamp(p.y, 50, this.H - 30);

    // timers
    p.cooldown -= dt;
    p.invuln = Math.max(0, p.invuln - dt);
    p.triple = Math.max(0, p.triple - dt);
    p.rapid = Math.max(0, p.rapid - dt);
    p.shield = Math.max(0, p.shield - dt);
    this.shake = Math.max(0, this.shake - dt);

    // firing
    const firing = this.keys.has(" ") || this.pointer.active;
    const rate = p.rapid > 0 ? p.fireRate * 0.45 : p.fireRate;
    if (firing && p.cooldown <= 0) {
      p.cooldown = rate;
      const speed = 760;
      if (p.triple > 0) {
        this.bullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -speed, r: 4 });
        this.bullets.push({ x: p.x, y: p.y - 12, vx: -160, vy: -speed, r: 4 });
        this.bullets.push({ x: p.x, y: p.y - 12, vx: 160, vy: -speed, r: 4 });
      } else {
        this.bullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -speed, r: 4 });
      }
    }

    // bullets
    this.bullets = this.bullets.filter((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      return b.y > -20 && b.x > -20 && b.x < this.W + 20;
    });
    this.enemyBullets = this.enemyBullets.filter((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      return b.y < this.H + 20 && b.y > -20 && b.x > -20 && b.x < this.W + 20;
    });

    // difficulty steps up every 3 waves (a "tier")
    const tier = Math.floor((this.wave - 1) / 3);

    // wave / spawning — dense from wave 1, denser each tier, burst spawns
    this.spawnTimer -= dt;
    const spawnInterval = clamp(0.8 - tier * 0.16, 0.28, 0.8);
    if (this.spawnTimer <= 0) {
      this.spawnTimer = spawnInterval;
      this._spawnEnemy();
      for (let i = 0; i < 2 + tier; i++) {
        if (Math.random() < 0.5) this._spawnEnemy();
      }
    }
    this.waveTimer += dt;
    if (this.waveTimer > 13) {
      this.waveTimer = 0;
      this.wave += 1;
      this._emit();
    }

    // enemy fire steps up each tier: faster bullets, shorter cooldown, one
    // extra bullet per shot (spread burst)
    const bulletSpeed = Math.min(340 + tier * 60, 640);
    const shots = Math.min(1 + tier, 5);
    const fireBase = clamp(1.35 - tier * 0.25, 0.4, 1.35);

    // enemies
    for (const e of this.enemies) {
      e.y += e.vy * dt;
      e.x += Math.sin(e.y * 0.02 + e.phase) * e.sway * dt;
      e.x = clamp(e.x, 16, this.W - 16);
      if (e.canShoot) {
        e.fireCd -= dt;
        if (e.fireCd <= 0 && e.y < this.H * 0.7) {
          e.fireCd = rand(fireBase * 0.6, fireBase);
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          for (let s = 0; s < shots; s++) {
            const a = ang + (s - (shots - 1) / 2) * 0.18;
            this.enemyBullets.push({
              x: e.x,
              y: e.y + e.r,
              vx: Math.cos(a) * bulletSpeed,
              vy: Math.sin(a) * bulletSpeed,
              r: 4,
            });
          }
        }
      }
    }

    // particles
    this.particles = this.particles.filter((pt) => {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
      pt.life -= dt;
      return pt.life > 0;
    });

    // powerups fall
    this.powerups = this.powerups.filter((pw) => {
      pw.y += 90 * dt;
      pw.spin += dt * 4;
      if (dist2(pw.x, pw.y, p.x, p.y) < (pw.r + p.r) ** 2) {
        this._applyPower(pw.type);
        return false;
      }
      return pw.y < this.H + 20;
    });

    this._collisions();

    // cull off-screen enemies (player loses nothing, they just leave)
    this.enemies = this.enemies.filter((e) => e.y < this.H + 40 && e.hp > 0);
  }

  _spawnEnemy() {
    const tier = Math.floor((this.wave - 1) / 3);
    const tough = Math.random() < clamp(0.16 + this.wave * 0.03, 0, 0.55);
    this.enemies.push({
      x: rand(30, this.W - 30),
      y: -30,
      r: tough ? 20 : 14,
      vy: rand(90, 150) + this.wave * 8,
      sway: rand(30, 95),
      phase: rand(0, Math.PI * 2),
      hp: tough ? 3 : 1,
      maxHp: tough ? 3 : 1,
      canShoot: Math.random() < clamp(0.45 + tier * 0.15, 0, 0.95),
      fireCd: rand(0.8, 2.5),
      score: tough ? 50 : 20,
    });
  }

  _collisions() {
    const p = this.player;
    // player bullets vs enemies
    for (const e of this.enemies) {
      for (const b of this.bullets) {
        if (b.dead) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (e.r + b.r) ** 2) {
          b.dead = true;
          e.hp -= 1;
          this._spark(b.x, b.y, COLORS.enemyGlow, 4);
          if (e.hp <= 0) {
            this.score += e.score;
            this._explode(e.x, e.y, e.r);
            this.shake = 0.12;
            if (Math.random() < 0.12) this._dropPower(e.x, e.y);
            this._emit();
          }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);

    // enemy bullets vs player
    if (p.invuln <= 0) {
      for (const b of this.enemyBullets) {
        if (dist2(b.x, b.y, p.x, p.y) < (p.r + b.r) ** 2) {
          b.dead = true;
          this._hitPlayer();
          break;
        }
      }
      this.enemyBullets = this.enemyBullets.filter((b) => !b.dead);
      // enemy bodies vs player
      for (const e of this.enemies) {
        if (dist2(e.x, e.y, p.x, p.y) < (p.r + e.r) ** 2) {
          e.hp = 0;
          this._explode(e.x, e.y, e.r);
          this._hitPlayer();
          break;
        }
      }
    }
  }

  _hitPlayer() {
    const p = this.player;
    if (p.shield > 0) {
      p.shield = 0;
      p.invuln = 1;
      this.shake = 0.18;
      this.hurt = 0.25; // light cyan zap on a shield block
      this._spark(p.x, p.y, COLORS.power, 14);
      return;
    }
    this.lives -= 1;
    p.invuln = 1.4;
    this.shake = 0.32;
    this.hurt = 0.5; // red zap flash
    this.freeze = 0.12; // brief hitstop
    this._explode(p.x, p.y, p.r);
    this._emit();
    if (this.lives <= 0) {
      this.status = "over";
      this.running = false;
      cancelAnimationFrame(this.rafId);
      this._emit();
    }
  }

  _dropPower(x, y) {
    const types = ["triple", "rapid", "shield"];
    this.powerups.push({
      x,
      y,
      r: 12,
      spin: 0,
      type: types[Math.floor(Math.random() * types.length)],
    });
  }

  _applyPower(type) {
    const p = this.player;
    if (type === "triple") p.triple = 8;
    if (type === "rapid") p.rapid = 8;
    if (type === "shield") p.shield = 10;
    this._spark(p.x, p.y, COLORS.power, 16);
  }

  _spark(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 220);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.25, 0.6),
        maxLife: 0.6,
        size: rand(1.5, 3.5),
        color,
      });
    }
  }

  _explode(x, y, r) {
    const n = Math.floor(r * 1.4);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 320);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.3, 0.8),
        maxLife: 0.8,
        size: rand(2, 5),
        color: Math.random() < 0.5 ? COLORS.enemy : COLORS.enemyBullet,
      });
    }
  }

  /* ── render ────────────────────────────────────────────────────── */
  _render() {
    if (this.mp) return this._renderMp();
    const ctx = this.ctx;
    let ox = 0;
    let oy = 0;
    if (this.shake > 0) {
      ox = rand(-1, 1) * this.shake * 18;
      oy = rand(-1, 1) * this.shake * 18;
    }
    ctx.save();
    ctx.translate(ox, oy);

    // background
    ctx.fillStyle = "#0F172A";
    ctx.fillRect(-20, -20, this.W + 40, this.H + 40);

    // stars
    for (const s of this.starsFar) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = "#93c5fd";
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    for (const s of this.starsNear) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = "#e0e7ff";
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // particles
    for (const pt of this.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // powerups
    for (const pw of this.powerups) {
      ctx.save();
      ctx.translate(pw.x, pw.y);
      ctx.rotate(pw.spin);
      ctx.shadowBlur = 14;
      ctx.shadowColor = COLORS.power;
      ctx.strokeStyle = COLORS.power;
      ctx.lineWidth = 2;
      ctx.strokeRect(-pw.r / 1.4, -pw.r / 1.4, pw.r * 1.4, pw.r * 1.4);
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.power;
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      const letter = pw.type === "triple" ? "T" : pw.type === "rapid" ? "R" : "S";
      ctx.fillText(letter, pw.x, pw.y + 4);
    }

    // player bullets
    ctx.shadowBlur = 8;
    ctx.shadowColor = COLORS.bullet;
    ctx.fillStyle = COLORS.bullet;
    for (const b of this.bullets) {
      ctx.fillRect(b.x - b.r / 2, b.y - b.r * 1.6, b.r, b.r * 3.2);
    }
    // enemy bullets
    ctx.shadowColor = COLORS.enemyBullet;
    ctx.fillStyle = COLORS.enemyBullet;
    for (const b of this.enemyBullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // enemies
    for (const e of this.enemies) {
      this._drawEnemy(e);
    }

    // player
    if (this.player) this._drawPlayer();

    ctx.restore();
    this._drawHurt();
  }

  _drawPlayer() {
    const ctx = this.ctx;
    const p = this.player;
    const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
    if (blink) return;

    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.shield > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, p.r + 9, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.power;
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(performance.now() / 120);
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = COLORS.power;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    this._drawShip(false);
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  /* Lazily-built, cached ship sprites (blue = you, green = allies). */
  _ship(remote) {
    if (remote) {
      if (!this._shipR) this._shipR = buildShipSprite("hue-rotate(105deg) saturate(1.15)");
      return this._shipR;
    }
    if (!this._shipB) this._shipB = buildShipSprite(null);
    return this._shipB;
  }

  // Draws the Mk-I Interceptor centered at the current origin (nose up),
  // plus a flickering engine flame. scale = native-px → world-px.
  _drawShip(remote, scale = 1.5) {
    const ctx = this.ctx;
    const sprite = this._ship(remote);
    const w = SHIP_W * scale;
    const h = SHIP_H * scale;
    const ox = -w / 2;
    const oy = -h / 2;

    // engine flame — procedural flicker trailing the nozzle
    const flameX = ox + 12 * scale; // centered on the 2px nozzle (cols 11/12)
    const flameY = oy + ENGINE_ROW * scale;
    const len = (4 + Math.random() * 4) * scale;
    const grad = ctx.createLinearGradient(0, flameY, 0, flameY + len);
    grad.addColorStop(0, "#ff9000");
    grad.addColorStop(0.4, "#ffe020");
    grad.addColorStop(1, "rgba(255,248,160,0)");
    ctx.save();
    ctx.globalAlpha = 0.7 + Math.random() * 0.3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ff9000";
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(flameX - scale, flameY);
    ctx.lineTo(flameX, flameY + len);
    ctx.lineTo(flameX + scale, flameY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ship body (crisp pixels)
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.shadowBlur = 14;
    ctx.shadowColor = remote ? "#4ade80" : COLORS.playerGlow;
    ctx.drawImage(sprite, ox, oy, w, h);
    ctx.shadowBlur = 0;
    ctx.imageSmoothingEnabled = smooth;
  }

  /* Cached enemy sprites (built lazily on first draw). */
  _enemySprite(tough) {
    if (tough) {
      if (!this._enemyT) this._enemyT = bakePixels(ENEMY_PALETTE, ENEMY_TOUGH, ENEMY_TOUGH_W);
      return this._enemyT;
    }
    if (!this._enemyB) this._enemyB = bakePixels(ENEMY_PALETTE, ENEMY_BASIC, ENEMY_BASIC_W);
    return this._enemyB;
  }

  _drawEnemy(e) {
    const ctx = this.ctx;
    const tough = e.maxHp >= 3;
    const sprite = this._enemySprite(tough);
    // sprite scaled so its width ≈ the hitbox diameter
    const scale = (e.r * 2) / sprite.width;
    const w = sprite.width * scale;
    const h = sprite.height * scale;
    ctx.save();
    ctx.translate(e.x, e.y);

    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.shadowBlur = 14;
    ctx.shadowColor = COLORS.enemyGlow;
    // hit flash: tint white briefly while damaged
    if (e.hp < e.maxHp) ctx.globalAlpha = 0.85 + 0.15 * Math.sin(performance.now() / 60);
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.imageSmoothingEnabled = smooth;
    ctx.restore();
  }

  /* ── multiplayer update / render ───────────────────────────────── */
  _updateMp(dt) {
    const me = this.me;

    // local prediction of my own ship (world coords)
    let dx = 0;
    let dy = 0;
    if (this.keys.has("arrowleft") || this.keys.has("a")) dx -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) dx += 1;
    if (this.keys.has("arrowup") || this.keys.has("w")) dy -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) dy += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      me.x += (dx / len) * me.speed * dt;
      me.y += (dy / len) * me.speed * dt;
    }
    if (this.pointer.active && this.pointer.x != null) {
      const wx = (this.pointer.x - this.view.ox) / this.view.scale;
      const wy = (this.pointer.y - this.view.oy) / this.view.scale;
      me.x += (wx - me.x) * Math.min(1, dt * 12);
      me.y += (wy - me.y) * Math.min(1, dt * 12);
    }
    me.x = clamp(me.x, 18, this.world.w - 18);
    me.y = clamp(me.y, 50, this.world.h - 30);

    const firing = this.keys.has(" ") || this.pointer.active;
    // throttle input to ~30 Hz
    this._sendAccum += dt;
    if (this._sendAccum >= 1 / 30) {
      this._sendAccum = 0;
      this.net?.sendInput(Math.round(me.x), Math.round(me.y), firing);
    }

    // starfield (world-space scroll)
    for (const layer of [this.starsFar, this.starsNear]) {
      for (const s of layer) {
        s.y += s.speed * dt;
        if (s.y > this.H) {
          s.y = 0;
          s.x = rand(0, this.W);
        }
      }
    }

    // smooth remote players + enemies toward latest snapshot
    if (this.snap) {
      const k = Math.min(1, dt * 14);
      for (const p of this.snap.players) {
        if (p.id === this.net?.id) continue;
        let r = this.remote.get(p.id);
        if (!r) {
          r = { x: p.x, y: p.y };
          this.remote.set(p.id, r);
        }
        r.x += (p.x - r.x) * k;
        r.y += (p.y - r.y) * k;
        r.name = p.name;
        r.country = p.country;
        r.alive = p.alive;
        r.shield = p.shield;
        r.invuln = p.invuln;
      }
      const liveIds = new Set(this.snap.players.map((p) => p.id));
      for (const id of this.remote.keys()) if (!liveIds.has(id)) this.remote.delete(id);

      for (const e of this.snap.enemies) {
        let v = this.enemyView.get(e.id);
        if (!v) {
          v = { x: e.x, y: e.y };
          this.enemyView.set(e.id, v);
        }
        v.x += (e.x - v.x) * k;
        v.y += (e.y - v.y) * k;
      }
      const eIds = new Set(this.snap.enemies.map((e) => e.id));
      for (const id of this.enemyView.keys()) if (!eIds.has(id)) this.enemyView.delete(id);
    }

    this.shake = Math.max(0, this.shake - dt);

    // particles
    this.particles = this.particles.filter((pt) => {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
      pt.life -= dt;
      return pt.life > 0;
    });
  }

  _renderMp() {
    const ctx = this.ctx;
    ctx.save();
    // background fills the whole canvas (letterbox stays dark)
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, this.W, this.H);

    // starfield in screen space
    for (const s of this.starsFar) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = "#93c5fd";
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    for (const s of this.starsNear) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = "#e0e7ff";
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // enter world transform (with shake)
    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      sx = rand(-1, 1) * this.shake * 16;
      sy = rand(-1, 1) * this.shake * 16;
    }
    ctx.translate(this.view.ox + sx, this.view.oy + sy);
    ctx.scale(this.view.scale, this.view.scale);

    // arena border
    ctx.strokeStyle = "rgba(96,165,250,0.18)";
    ctx.lineWidth = 2 / this.view.scale;
    ctx.strokeRect(0, 0, this.world.w, this.world.h);

    const snap = this.snap;
    if (snap) {
      // powerups
      for (const [px, py, type] of snap.pw) {
        ctx.save();
        ctx.translate(px, py);
        ctx.shadowBlur = 14;
        ctx.shadowColor = COLORS.power;
        ctx.strokeStyle = COLORS.power;
        ctx.lineWidth = 2;
        ctx.strokeRect(-9, -9, 18, 18);
        ctx.restore();
        ctx.shadowBlur = 0;
        ctx.fillStyle = COLORS.power;
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(type === "triple" ? "T" : type === "rapid" ? "R" : "S", px, py + 4);
      }

      // particles (world space)
      for (const pt of this.particles) {
        ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      // player bullets
      ctx.shadowBlur = 8;
      ctx.shadowColor = COLORS.bullet;
      ctx.fillStyle = COLORS.bullet;
      for (const [bx, by] of snap.pb) ctx.fillRect(bx - 2, by - 6, 4, 12);
      // enemy bullets
      ctx.shadowColor = COLORS.enemyBullet;
      ctx.fillStyle = COLORS.enemyBullet;
      for (const [bx, by] of snap.eb) {
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // enemies (smoothed)
      for (const e of snap.enemies) {
        const v = this.enemyView.get(e.id) || e;
        this._drawEnemy({ x: v.x, y: v.y, r: e.r, hp: e.hp, maxHp: e.mh });
      }

      // remote players
      for (const [id, r] of this.remote) {
        if (id === this.net?.id) continue;
        if (r.alive) this._drawNetShip(r.x, r.y, r.name, r.country, { remote: true, shield: r.shield, invuln: r.invuln });
      }

      // me (locally predicted)
      const meSnap = snap.players.find((p) => p.id === this.net?.id);
      if (!meSnap || meSnap.alive) {
        this._drawNetShip(this.me.x, this.me.y, this.pilot?.username || "YOU", this.pilot?.country?.code, {
          remote: false,
          shield: meSnap?.shield,
          invuln: meSnap?.invuln,
        });
      }
    }

    ctx.restore();
    this._drawHurt();
  }

  /* ── damage feedback: red zap + frost vignette over the screen ───── */
  _drawHurt() {
    if (this.hurt <= 0) return;
    const ctx = this.ctx;
    const k = Math.min(1, this.hurt / 0.5); // 1 → 0
    ctx.save();
    // red zap flash
    ctx.fillStyle = `rgba(220,38,38,${0.42 * k})`;
    ctx.fillRect(0, 0, this.W, this.H);
    // frost vignette (the "frozen" feel)
    const g = ctx.createRadialGradient(
      this.W / 2,
      this.H / 2,
      Math.min(this.W, this.H) * 0.28,
      this.W / 2,
      this.H / 2,
      Math.max(this.W, this.H) * 0.72
    );
    g.addColorStop(0, "rgba(125,211,252,0)");
    g.addColorStop(1, `rgba(125,211,252,${0.55 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
  }

  _drawNetShip(x, y, name, country, { remote, shield, invuln }) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    if (invuln && Math.floor(performance.now() / 80) % 2 === 0) ctx.globalAlpha = 0.4;

    if (shield) {
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.power;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = COLORS.power;
      ctx.stroke();
    }

    this._drawShip(!!remote);
    ctx.globalAlpha = 1;

    // flag + name tag above ship (placeholder until ship art arrives)
    const flag = this._flag(country);
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    const label = (name || "").toUpperCase();
    const tw = ctx.measureText(label).width;
    const fw = flag ? 16 : 0;
    const totalW = fw + (fw ? 4 : 0) + tw;
    const startX = -totalW / 2;
    if (flag) {
      ctx.drawImage(flag, startX, -34, 16, 11);
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(startX, -34, 16, 11);
    }
    ctx.fillStyle = remote ? "#4ade80" : "#bfdbfe";
    ctx.fillText(label, startX + fw + (fw ? 4 : 0), -25);

    ctx.restore();
  }
}
