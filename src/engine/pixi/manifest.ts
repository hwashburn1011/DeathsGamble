// Asset manifest — declares which sprite paths the dungeon scene needs.
// Pixi's Assets system caches by URL string, so we keep the IDs identical
// to the relative URL paths.
//
// All asset paths are relative to import.meta.env.BASE_URL so the build works
// under the GitHub Pages '/DeathsGamble/' base path.

import type { BuildDef, EnemySprite } from '../../types';

const BASE = import.meta.env.BASE_URL;

// ----- Player base sprites (Dungeon Crawl, CC0) ------
// Picks intentionally bias toward distinct silhouettes so each build reads
// at a glance.
export const PLAYER_SPRITE_BY_BUILD: Record<string, string> = {
  gambler:  `${BASE}assets/tiles/dungeon-crawl/player/base/human_m.png`,
  duelist:  `${BASE}assets/tiles/dungeon-crawl/player/base/demigod_m.png`,
  brute:    `${BASE}assets/tiles/dungeon-crawl/player/base/ogre_m.png`,
  arcanist: `${BASE}assets/tiles/dungeon-crawl/player/base/deep_elf_m.png`,
  rogue:    `${BASE}assets/tiles/dungeon-crawl/player/base/halfling_m.png`,
  huntsman: `${BASE}assets/tiles/dungeon-crawl/player/base/centaur_brown_m.png`,
  witch:    `${BASE}assets/tiles/dungeon-crawl/player/base/spriggan_f.png`,
  soldier:  `${BASE}assets/tiles/dungeon-crawl/player/base/dwarf_m.png`,
};

// ----- Enemy sprites (Dungeon Crawl, CC0) -----
export const ENEMY_SPRITE_BY_TYPE: Record<EnemySprite, string> = {
  zombie:   `${BASE}assets/tiles/dungeon-crawl/dc-mon/undead/necrophage.png`,
  bat:      `${BASE}assets/tiles/dungeon-crawl/dc-mon/animals/giant_bat.png`,
  skeleton: `${BASE}assets/tiles/dungeon-crawl/dc-mon/undead/skeletal_warrior.png`,
  ghoul:    `${BASE}assets/tiles/dungeon-crawl/dc-mon/undead/ghoul.png`,
  wraith:   `${BASE}assets/tiles/dungeon-crawl/dc-mon/undead/wraith.png`,
  tank:     `${BASE}assets/tiles/dungeon-crawl/dc-mon/undead/bone_dragon.png`,
  imp:      `${BASE}assets/tiles/dungeon-crawl/dc-mon/demons/blue_devil.png`,
  reaper:   `${BASE}assets/tiles/dungeon-crawl/dc-mon/undead/ancient_lich.png`,
  boss:     `${BASE}assets/tiles/dungeon-crawl/dc-mon/undead/lich.png`,
};

// ----- Floor / wall tiles (Kenney Tiny Dungeon) -----
// We'll pick specific tile_NNNN.png in the renderer; manifest just lists
// the base path.
export const TINY_DUNGEON_BASE = `${BASE}assets/tiles/kenney-tiny-dungeon/tiles`;

// ----- Aggregate list for preloading -----
export function dungeonAssetsToLoad(build: BuildDef): string[] {
  const playerSprite = PLAYER_SPRITE_BY_BUILD[build.id] ?? PLAYER_SPRITE_BY_BUILD['gambler'];
  const enemySprites = Object.values(ENEMY_SPRITE_BY_TYPE);
  return [playerSprite, ...enemySprites];
}
