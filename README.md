# ColdRya

A 2D arcade space shooter built with React + Vite + HTML5 Canvas. Clear the
swarm, survive escalating waves, grab power-ups, and chase the high score.

![arcade neon space shooter](https://img.shields.io/badge/style-pixel%20arcade-2563eb)

## Controls

| Action | Keys |
| ------ | ---- |
| Move   | `W A S D` or arrow keys |
| Fire   | `SPACE` (hold) |
| Pause  | `P` or `ESC` |
| Start / Restart | `ENTER` |

On touch / mouse: **tap and drag** to fly — the ship auto-fires while held.

## Gameplay

- **Waves** ramp every ~18s: faster spawns, tougher enemies, more enemy fire.
- **Enemies**: red triangles (1 HP) and red hexes (3 HP, tougher).
- **Power-ups** drop from kills — fly into them to collect. The three commons
  drop often; the four special buffs are rarer treats:
  - `T` — **Triple shot** (8s spread fire)
  - `R` — **Rapid fire** (8s faster cadence)
  - `S` — **Shield** (10s, absorbs one hit)
  - `+` — **Heal** — restores one ship (up to a max of 5)
  - `N` — **Nuke** — vaporises every enemy on screen and wipes incoming fire
  - `O` — **Omni-fire** (8s) — fire a 16-way barrage in *every* direction
  - `X` — **Overdrive** (4s) — full invincibility + speed boost; ram straight
    through enemies to destroy them
- 3 ships (lives), up to 5 with heals. A hit costs a ship unless a shield is
  up. Game over at 0.
- High score is saved in `localStorage`.

## Multiplayer (co-op)

Up to a roomful of pilots share one arena and fight the enemy waves together
with a **shared team score**. The server is **authoritative**: it owns the
enemies, bullets, collisions, waves, and scoring. Each client controls only
its own ship (movement is predicted locally so it never feels laggy) and sends
its position + a "firing" flag; the server spawns bullets and resolves all hits,
then broadcasts 30 snapshots/second to everyone in the room.

- From the menu, enter a **room code** and hit **JOIN** — friends who type the
  same code land in the same arena.
- Every ship shows the pilot's **flag + callsign** above it.
- When everyone is down, anyone can **restart the round**.

The shared world is a fixed 1000×720 arena that each client letterboxes to its
own screen, so players on different resolutions see the same thing.

## Run locally

```bash
npm install
npm run dev:all   # client (Vite :5173) + co-op server (:8787) together
# or separately:
npm run dev       # client only — http://localhost:5173
npm run server    # co-op server only — ws://localhost:8787
npm run build     # production build to dist/
```

In dev the client connects to `ws://localhost:8787`. You can point it elsewhere
with `VITE_SERVER_URL=wss://your-host` at build time.

## Deploy (one service hosts client + server)

The server (`server/index.js`) serves the built `dist/` **and** the WebSocket on
the same port, so a single free web service runs the whole game.

**Render** (recommended for WebSockets, free tier):

1. Push this repo to GitHub.
2. render.com → **New → Blueprint** → pick the repo (uses `render.yaml`).
3. It runs `npm install && npm run build`, then `npm start`. Share the URL.

**Railway / Fly / any Node host:** build command `npm install && npm run build`,
start command `npm start`. The host's `$PORT` is used automatically.

## Desktop app (Mac / Windows)

The game ships as a native desktop app via **Electron**. The app bundles the
client **and** the co-op server, so it's fully self-contained — single player
runs offline and the app hosts co-op locally with zero setup.

```bash
npm run app        # build + launch the desktop app locally
npm run dist:mac   # build a macOS .dmg + .zip   -> release/
npm run dist:win   # build a Windows .exe        -> release/  (run on Windows)
```

A Windows `.exe` can't be reliably cross-built from a Mac, so the repo includes
a GitHub Actions workflow (`.github/workflows/desktop.yml`) that builds **both**
Mac and Windows installers in CI: open the repo's **Actions** tab → **Build
desktop apps** → **Run workflow**, then download the artifacts. (Pushing a
`vX.Y.Z` tag triggers it too.)

**Online co-op from the desktop app:** by default the app hosts co-op on your
own machine (great for single player / LAN). To play with remote friends
through your deployed cloud server, point the app at it once from the devtools
console:

```js
localStorage.setItem("voidraider_server", "https://your-app.onrender.com")
```

(Unsigned builds: macOS may warn "unidentified developer" — right-click the app
→ Open the first time. Windows SmartScreen → More info → Run anyway.)

## Tech

- **React 19** for the menu / HUD / overlay state machine
- **HTML5 Canvas** engine (`src/game/engine.js`) — game loop, entities,
  collision, particles, starfield, screen shake — all in plain JS; has a
  server-driven co-op render path alongside the solo simulation
- **Node + ws** authoritative co-op server (`server/index.js`)
- **Vite** dev server + build, **Tailwind v4** + custom CSS for the arcade UI
- Fonts: **Press Start 2P** (display) + **VT323** (terminal text)

## Project structure

```
src/
  App.jsx          # menu / HUD / co-op / pause / game-over + state
  game/engine.js   # canvas engine: solo sim + co-op snapshot renderer
  net/NetClient.js # WebSocket client (join, input, snapshots, reconnect)
  data/countries.js# flags + names for pilot registration
  index.css        # arcade theme + overlay styling
  main.jsx         # React entry
server/
  index.js         # authoritative co-op server + static host for dist/
```

The engine is decoupled from React: it reports `{ score, lives, wave, status }`
through an `onState` callback, so the UI layer stays declarative while the game
loop runs on `requestAnimationFrame`.
