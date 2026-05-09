# Death's Gamble

A browser-based roguelite. Make your bargain with Death — spin a **boon** wheel and a **curse** wheel — then descend into a Vampire-Survivors-style dungeon and see how long you last.

**Live:** https://hwashburn1011.github.io/DeathsGamble/

## Status

**v0.6 — architecture migration in progress.** Migrating from the monolithic `index.html` to a modular Vite + TypeScript + PixiJS + React project.

The fully-playable previous build is preserved at [`/legacy/v0.5.html`](public/legacy/v0.5.html) (also reachable from the new title screen via the placeholder bridge).

## Stack

- **Vite** — dev server + build
- **TypeScript** — type safety as the project grows
- **React 18** — menu / HUD layer (declarative state, easy glass styling)
- **PixiJS** — game canvas rendering (sprite batching, filters, particles) — *coming in next iteration*
- **Zustand** — game state store
- **Cinzel + Crimson Pro** (Google Fonts) — gothic display typography

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173 (Vite picks the port and opens it).

To build:

```bash
npm run build      # → dist/
npm run preview    # serve the built bundle
```

## Project structure

```
src/
├── main.tsx            React entry
├── App.tsx             Scene router
├── data/               Typed game data (builds, weapons, spells, enemies, wheels, shop, difficulty)
├── types/              TypeScript interfaces
├── state/              Zustand stores (game, settings, persistent + localStorage save)
├── ui/                 Design system: GlassPanel, GlassButton, SettingsModal
├── scenes/             Scene components (Title, ModeSelect, BuildPicker, …)
├── engine/             Game logic + canvas drawing (charSprites, …)
└── styles/             Theme tokens + globals.css
```

## How to play (v0.5)

Open https://hwashburn1011.github.io/DeathsGamble/legacy/v0.5.html.

1. Hit **Start Game** → pick **Story** or **Infinite**.
2. Pick from 3 random character builds.
3. Spin both wheels (boon + curse), then **Enter Dungeon**.
4. WASD/arrows to move. Auto-attacks fire on cooldown. Pick up green gems for XP.
5. Survive the round. Story = 2/3/5 raids → final boss. Infinite = endless rounds with escalating wheel values.

## Migration plan

Tasks tracked via the agent's task system. Phases:

1. ✅ **Foundation** — Vite + React + TS + design system + scaffolding
2. **Asset sourcing** — pixel-art character/enemy/tile/weapon packs (Kenney, OpenGameArt, itch.io CC0)
3. **Sprite-based rendering** — replace canvas-drawn characters/enemies/Death with animated sprite sheets
4. **Environment & atmosphere** — tile-based dungeons, particles, dynamic lighting, camera juice
5. **Liquid Glass UI overhaul** — every menu/HUD card uses the GlassPanel design system
6. **Audio** — gothic + industrial soundtrack and SFX
7. **Polish** — damage popups, hit-stop, screen flash, death animation, level-up burst
8. **Performance** — sprite atlasing, object pooling, asset preloader

## Credits / asset sources

(To be populated as assets are added — see `/CREDITS.md` once available.)
