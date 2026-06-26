# VOID RAIDER

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
- **Power-ups** drop from kills — fly into them to collect:
  - `T` — **Triple shot** (8s spread fire)
  - `R` — **Rapid fire** (8s faster cadence)
  - `S` — **Shield** (10s, absorbs one hit)
- 3 ships (lives). A hit costs a ship unless a shield is up. Game over at 0.
- High score is saved in `localStorage`.

## Tech

- **React 19** for the menu / HUD / overlay state machine
- **HTML5 Canvas** engine (`src/game/engine.js`) — game loop, entities,
  collision, particles, starfield, screen shake — all in plain JS
- **Vite** dev server + build
- **Tailwind v4** + custom CSS for the arcade UI
- Fonts: **Press Start 2P** (display) + **VT323** (terminal text)

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## Project structure

```
src/
  App.jsx          # menu / HUD / pause / game-over overlays + state
  game/engine.js   # canvas game engine (no React inside the loop)
  index.css        # arcade theme + overlay styling
  main.jsx         # React entry
```

The engine is decoupled from React: it reports `{ score, lives, wave, status }`
through an `onState` callback, so the UI layer stays declarative while the game
loop runs on `requestAnimationFrame`.
