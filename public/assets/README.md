# `public/assets/`

Game art, audio, and font assets sourced from third-party CC0 / open-licensed packs.

```
public/assets/
├── SOURCES.md           Master attribution list (read this!)
├── characters/          Player character sprite sheets (per-build)
├── enemies/             Enemy sprite sheets
├── tiles/               Dungeon / environment tilesets
│   ├── kenney-tiny-dungeon/      Kenney CC0 — Tiny Dungeon (16x16)
│   └── dungeon-crawl/            Dungeon Crawl 32x32 — CC0
├── ui/                  UI elements (panels, buttons, cursors)
│   └── kenney-pack/              Kenney CC0 — UI Pack
├── icons/               Standalone icon SVGs (Game-Icons / Lucide)
├── audio/
│   ├── music/                    Background music tracks (.ogg)
│   └── sfx/                      Sound effects
│       └── kenney-impact/        Kenney CC0 — Impact Sounds
└── fonts/               Self-hosted font files (current: Google Fonts via CDN)
```

Because `public/` is copied verbatim to `dist/` at build time, anything
here is reachable on the live site at `/DeathsGamble/assets/...`.

See [`SOURCES.md`](./SOURCES.md) for full attribution and recommended
additional sources for upcoming phases.
