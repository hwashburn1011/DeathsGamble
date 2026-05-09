# Death's Gamble — Style Guide

A reference for the visual language. Lives at `docs/style-guide.md` and
is the source of truth for new scenes, UI components, and asset choices.

## North star

Gothic + industrial dark. Think Vampire Survivors meets Slay the Spire
under a Cult of the Lamb sky. The art is pixel-art roguelite; the UI
is liquid-glass dark. Whenever those collide (e.g. a glass HUD over a
pixel dungeon), the glass is the frame and the pixels are the painting.

## Colors

Source of truth: `src/styles/theme.ts` + `src/styles/globals.css`
(CSS vars).

### Backgrounds

| Token | Hex | Use |
|---|---|---|
| `--void-black` | `#040406` | Deepest backdrop, end-of-stop in gradients |
| `--shadow`     | `#07070a` | App body baseline |
| `--hood`       | `#0d0d12` | Death's cloak baseline |
| `--charcoal`   | `#15151a` | Card / panel base before glass blur |
| `--edge`       | `#2a2a32` | Borders, dividers |

### Ink

| Token | Hex | Use |
|---|---|---|
| `--ink`        | `#e9e6df` | Primary copy |
| `--ink-muted`  | `#a09a8a` | Secondary copy, italic flavor |
| `--ink-dim`    | `#6f6a5e` | Tertiary copy, labels |

### Accents

| Token | Hex | Use |
|---|---|---|
| `--gold`         | `#c9a227` | Primary action, "wager" / boon highlight |
| `--gold-bright`  | `#f0c84a` | Hover states, glow centers, stat-up indicators |
| `--candle`       | `#ffd070` | Torch / level-up flares |

### Status

| Token | Hex | Use |
|---|---|---|
| `--blood` / `--blood-bright`   | `#b03030` / `#e04848` | Damage, danger, curse, player hurt |
| `--moss` / `--moss-bright`     | `#4d8a52` / `#69b070` | Heal, boon, XP, stat-up green |
| `--arcane` / `--arcane-bright` | `#5a8af0` / `#80b0ff` | Magic projectiles, spell labels |

### Don't

- Don't introduce new accent colors without updating tokens. Pick
  variants from the existing palette.
- Don't use pure white (#fff) for body text. Use `--ink`. Pure white
  is reserved for highlight gradients, sprite hit-flashes, and crit
  text strokes.

## Typography

| Family | License | Use |
|---|---|---|
| **Cinzel** | OFL | Display headings (`display` class), button labels, stat labels, all-caps treatments |
| **Crimson Pro** | OFL | Body text, descriptions, narrative copy |

Both loaded via Google Fonts in `index.html`. Locked weights kept small
to keep the bundle tight.

Scale (fluid via `clamp`):

- Display H1: `clamp(48px, 9vw, 130px)`
- Display H2: `clamp(28px, 5vw, 56px)`
- Section heading: `18-22px`, letter-spacing `0.18-0.28em`, uppercase
- Body: `14-16px`, line-height `1.5-1.6`
- Stat label: `11px`, letter-spacing `0.18em`, uppercase, `--ink-dim`

## Glass

The signature surface. Every menu card, modal, HUD panel, dungeon
overlay uses `<GlassPanel>` from `src/ui/GlassPanel.tsx`.

- `backdrop-filter: blur(20px) saturate(140%)` (16/8 for mid/light)
- Fill: `rgba(13,13,22,0.55)` (default)
- Border: `1px solid rgba(255,255,255,0.08)` (mid: brighter on hover)
- Inner top highlight: 1px gradient bar — gives the "wet glass" feel
- Optional `glow` modifier pulses gold when an action is ready

Performance note: backdrop-filter is GPU-heavy. Limit visible glass
panels per scene to ~6-8 at once. Don't animate them.

## Motion

| Curve | Duration | Use |
|---|---|---|
| `--m-swift` | 150ms | Hover states, segmented selections, tooltips |
| `--m-smooth` | 300ms | Cards mounting, GlassPanel transitions |
| `--m-ease` | 500ms | Scene fades, large layout shifts |

All motion respects `motionIntensity` setting (`off` / `low` / `normal`
/ `high`). Default honors `prefers-reduced-motion`. Engine-side juice
(shake, hit-stop, flash, zoom) all multiply by `MOTION_MULT`.

## Sprite art

Pixel art. CC0 packs only (Kenney + Dungeon Crawl 32×32). All sources
listed at `public/assets/SOURCES.md` and rendered on the in-game
Credits screen.

- Player builds: `public/assets/tiles/dungeon-crawl/player/base/*` —
  one per build, mapped in `src/engine/pixi/manifest.ts`
- Enemies: `public/assets/tiles/dungeon-crawl/dc-mon/**` — one per
  enemy type
- Death (wheels scene): currently rendered procedurally with Pixi.Graphics
  in `src/engine/wheels/WheelsGame.ts` — replace with hand-illustrated
  pixel sprite when sourced

Don't mix art styles. If a new sprite doesn't fit Dungeon Crawl's 32×32
palette, either re-tint it or pick a different source.

## Liquid Glass icons

Stat icons use Unicode glyphs (`♥`, `⚔`, `🛡`, `👟`, `⚡`, `🎯`, `✦`, `☘`)
for now. Replace with SVGs from Game-Icons.net (CC-BY 3.0) or Lucide
(ISC) when the design needs more granular control.

## Audio

Gothic + industrial dark. SFX from Kenney Impact Sounds (CC0). Music
not yet sourced — recommended pools at `public/assets/SOURCES.md`.

Volume mix: master 70% / SFX 70% / music 50% by default. SFX uses
per-event cooldowns (25-200ms) so combat doesn't mush.

## Scenes

Every scene component lives in `src/scenes/*.tsx` and follows the
`<div className="scene <foo>-scene">` pattern. The App router wraps
each in a `.scene-transition` div for crossfades.

Glass overlays sit at `z-index: 10` on top of any PixiJS canvas.
`.atmosphere` div sits at `z-index: 0` as a global gradient backdrop.
The settings gear is `z-index: 50`; modals are `z-index: 200`.

## File organization

- **Engine**: `src/engine/` — no React imports. Pixi-based rendering
  and game logic. Reads from settings/state stores indirectly via
  callbacks or globals.
- **State**: `src/state/` — Zustand stores. `gameStore` (per-run),
  `persistentStore` (cash/upgrades, localStorage), `settingsStore`
  (preferences, localStorage).
- **Data**: `src/data/` — typed game data (BUILDS, WEAPONS, etc.). No
  logic, no rendering.
- **UI**: `src/ui/` — reusable React components (GlassPanel,
  GlassButton, SettingsModal). Design system primitives only.
- **Scenes**: `src/scenes/` — top-level React scenes. Each owns its
  own CSS file.
- **Styles**: `src/styles/` — globals + theme tokens.
