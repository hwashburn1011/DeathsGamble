# Death's Gamble — Asset Sources & Attribution

Every external asset shipped with the game lives under `public/assets/` and is
listed below with its source URL and license. CC0 assets do not require
attribution but are credited here as good practice.

This file is the source of truth — it is mirrored in code at
`src/data/credits.ts` and rendered on the in-game **Credits** screen.

---

## Currently shipped

### Tiles

| Pack | Path | Source | License | Author |
|---|---|---|---|---|
| Kenney — Tiny Dungeon | `tiles/kenney-tiny-dungeon/` | [kenney.nl/assets/tiny-dungeon](https://kenney.nl/assets/tiny-dungeon) | CC0 1.0 | Kenney |
| Dungeon Crawl 32×32 Tiles | `tiles/dungeon-crawl/` | [opengameart.org/content/dungeon-crawl-32x32-tiles](https://opengameart.org/content/dungeon-crawl-32x32-tiles) | CC0 1.0 | Various (Crawl Tiles project) |

### UI

| Pack | Path | Source | License | Author |
|---|---|---|---|---|
| Kenney — UI Pack | `ui/kenney-pack/` | [kenney.nl/assets/ui-pack](https://kenney.nl/assets/ui-pack) | CC0 1.0 | Kenney |

### Audio — SFX

| Pack | Path | Source | License | Author |
|---|---|---|---|---|
| Kenney — Impact Sounds | `audio/sfx/kenney-impact/` | [kenney.nl/assets/impact-sounds](https://kenney.nl/assets/impact-sounds) | CC0 1.0 | Kenney |

### Fonts

| Family | License | Author |
|---|---|---|
| Cinzel (display) — loaded via Google Fonts | OFL | Natanael Gama |
| Crimson Pro (body) — loaded via Google Fonts | OFL | Sebastian Kosch |

---

## Recommended additions (not yet imported)

These are confirmed CC0 / open-license sources we plan to bring in for
later phases. They require either an itch.io download flow (no direct URL)
or are large enough to warrant manual curation.

### Characters

- **Kenney — Tiny Town / Tiny Dungeon characters** (already in tiny-dungeon pack — use existing)
- **LPC Medieval Fantasy Character Sprites** — [opengameart.org/content/lpc-medieval-fantasy-character-sprites](https://opengameart.org/content/lpc-medieval-fantasy-character-sprites) — CC-BY-SA 3.0 — Wulax
- **Pixel RogueLite Asset Pack** — [moose-stache.itch.io/pixel-roguelite-asset-pack](https://moose-stache.itch.io/pixel-roguelite-asset-pack) — CC0 — Moose Stache (manual itch.io download)
- **Roguelite Survivor Asset — Free Pack** — [livingtheindie.itch.io/roguelite-survivor-asset-free-pack](https://livingtheindie.itch.io/roguelite-survivor-asset-free-pack) — CC-BY — DyLESTorm

### Death (grim reaper) sprite

- **SamuelLee — Reaper (Animated Pixel Art)** — [samuellee.itch.io/reaper-animated-pixel-art](https://samuellee.itch.io/reaper-animated-pixel-art) — Free use (manual itch.io download)
- **RGS_Dev — Animated Grim Reaper** — [rgsdev.itch.io](https://rgsdev.itch.io/animated-grim-reaper-enemy-for-2d-sidrescroller-platformer-game-rgsdev) — paid (~$1)

### Enemies

- **0x72 — 16×16 DungeonTileset II** — [0x72.itch.io/dungeontileset-ii](https://0x72.itch.io/dungeontileset-ii) — CC0 (manual itch.io download)
- The Dungeon Crawl pack we already have includes the `dc-mon/` subfolder with hundreds of monster sprites

### Weapons

- **Kenney — Weapon Pack** — [kenney.nl/assets/weapon-pack](https://kenney.nl/assets/weapon-pack) — CC0
- The Dungeon Crawl pack's `item/` subfolder has pixel weapons too

### UI iconography

- **Game-Icons.net** — [game-icons.net](https://game-icons.net) — CC-BY 3.0 — 4000+ icons. Bulk download:
  `https://game-icons.net/archives/svg/zip/000000/transparent/game-icons.net.svg.zip`
- **Lucide** — [lucide.dev](https://lucide.dev) — ISC — clean modern SVGs (npm install)

### Background music

- **OpenGameArt — Dark Ambience Soundscapes** — [opengameart.org/content/dark-ambience-soundscapes](https://opengameart.org/content/dark-ambience-soundscapes) — CC-BY-SA 3.0 — yewbic
- **Eric Matyas — Soundimage.org** — [soundimage.org](https://soundimage.org) — CC-BY 4.0 — wide gothic + industrial track library
- **Kevin MacLeod — Incompetech** — [incompetech.com](https://incompetech.com) — CC-BY 4.0

### More SFX

- **Kenney — RPG Audio** — [kenney.nl/assets/rpg-audio](https://kenney.nl/assets/rpg-audio) — CC0
- **Kenney — Casino Audio** — [kenney.nl/assets/casino-audio](https://kenney.nl/assets/casino-audio) — CC0 (great for wheel/slot SFX)
- **Freesound.org** — [freesound.org](https://freesound.org) — mixed CC0/CC-BY (login required to download)

---

## How to add a new asset pack

1. Drop the unzipped contents into the appropriate `public/assets/<category>/<source-name>/` folder.
2. Keep the original `LICENSE.txt` alongside.
3. Add a row to the table above.
4. Add a matching entry to `src/data/credits.ts` so it appears on the in-game Credits screen.
5. Don't include `.url`, `Patreon.url`, or marketing PNG previews — strip them.
