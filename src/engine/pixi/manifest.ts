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

// ----- Per-weapon projectile sprites -----
// Map weapon.id → projectile sprite path. `null` = use the legacy
// Pixi.Graphics slash arc (melee weapons that don't have a flying
// projectile to depict).
export const PROJECTILE_BY_WEAPON: Record<string, string | null> = {
  // Melee — keep the slash arc
  fists:  null,
  club:   null,
  sword:  null,
  axe:    null,
  spear:  null,
  scythe: null,
  // Bullets (Dungeon Crawl bolts)
  pistol:  `${BASE}assets/tiles/dungeon-crawl/effect/bolt2.png`,
  shotgun: `${BASE}assets/tiles/dungeon-crawl/effect/bolt0.png`,
  smg:     `${BASE}assets/tiles/dungeon-crawl/effect/bolt1.png`,
  sniper:  `${BASE}assets/tiles/dungeon-crawl/effect/bolt5.png`,
  rifle:   `${BASE}assets/tiles/dungeon-crawl/effect/bolt3.png`,
  minigun: `${BASE}assets/tiles/dungeon-crawl/effect/bolt0.png`,
  // Bow / crossbow / thrown
  bow:      `${BASE}assets/tiles/dungeon-crawl/effect/arrow0.png`,
  crossbow: `${BASE}assets/tiles/dungeon-crawl/effect/arrow1.png`,
  knives:   `${BASE}assets/tiles/dungeon-crawl/effect/arrow2.png`,
  // Magic
  staff: `${BASE}assets/tiles/dungeon-crawl/effect/cloud_magic_trail0.png`,
  wand:  `${BASE}assets/tiles/dungeon-crawl/effect/cloud_magic_trail1.png`,
  orb:   `${BASE}assets/tiles/dungeon-crawl/effect/cloud_magic_trail2.png`,
  // Heavy
  flamer: `${BASE}assets/tiles/dungeon-crawl/dc-misc/flame.png`,
  rocket: `${BASE}assets/tiles/dungeon-crawl/effect/cloud_fire1.png`,
};

// ----- Floor / wall tiles (Kenney Tiny Dungeon) -----
// We'll pick specific tile_NNNN.png in the renderer; manifest just lists
// the base path.
export const TINY_DUNGEON_BASE = `${BASE}assets/tiles/kenney-tiny-dungeon/tiles`;

// ----- Dungeon themes (per-raid environments) -----
// Each theme picks a single floor texture (used as a TilingSprite base) plus
// a list of decoration sprites that get scattered randomly across the floor.
export type ThemeKey = 'crypt' | 'catacomb' | 'hellscape' | 'cavern';

const DC = `${BASE}assets/tiles/dungeon-crawl`;

export interface ThemeDef {
  floor: string;
  /** Decoration sprite paths. Picked at random for each scatter slot. */
  decorations: string[];
  /** Tint applied to the floor TilingSprite (multiplicative). */
  floorTint: number;
}

export const THEMES: Record<ThemeKey, ThemeDef> = {
  // Raid 1 — crypt (basic dungeon, dry stone)
  crypt: {
    floor: `${DC}/dc-dngn/floor/grey_dirt0.png`,
    decorations: [
      `${DC}/dc-dngn/crumbled_column.png`,
      `${DC}/dc-dngn/granite_statue.png`,
      `${DC}/dc-dngn/granite_stump.png`,
      `${DC}/dc-dngn/dngn_dry_fountain.png`,
      `${DC}/dc-dngn/elephant_statue.png`,
    ],
    floorTint: 0xa8a89c,
  },
  // Raid 2 — catacomb (tomb stone, mausoleum)
  catacomb: {
    floor: `${DC}/dc-dngn/floor/tomb0.png`,
    decorations: [
      `${DC}/dc-dngn/granite_stump.png`,
      `${DC}/dc-dngn/dngn_blue_fountain.png`,
      `${DC}/dc-dngn/crumbled_column.png`,
      `${DC}/dc-dngn/granite_statue.png`,
      `${DC}/dc-dngn/dngn_orcish_idol.png`,
    ],
    floorTint: 0x9090a0,
  },
  // Raid 3+ / boss — hellscape (bloody cobble, demonic accents)
  hellscape: {
    floor: `${DC}/dc-dngn/floor/cobble_blood1.png`,
    decorations: [
      `${DC}/dc-dngn/dngn_blood_fountain.png`,
      `${DC}/dc-misc/blood_red1.png`,
      `${DC}/dc-misc/blood_red2.png`,
      `${DC}/dc-misc/blood_red3.png`,
      `${DC}/dc-dngn/dngn_orcish_idol.png`,
      `${DC}/dc-dngn/crumbled_column.png`,
    ],
    floorTint: 0xc06060,
  },
  // Endless variant — cavern (sandstone)
  cavern: {
    floor: `${DC}/dc-dngn/floor/sandstone_floor0.png`,
    decorations: [
      `${DC}/dc-dngn/crumbled_column.png`,
      `${DC}/dc-dngn/granite_stump.png`,
      `${DC}/dc-dngn/dngn_dry_fountain.png`,
    ],
    floorTint: 0xb0a080,
  },
};

/** Resolve a theme for the current run state. */
export function themeFor(opts: {
  mode: 'story' | 'infinite';
  raid: number;
  totalRaids: number;
  endlessRound: number;
  isBossRaid: boolean;
}): ThemeKey {
  if (opts.isBossRaid) return 'hellscape';
  if (opts.mode === 'story') {
    if (opts.raid <= 1) return 'crypt';
    if (opts.raid === 2) return 'catacomb';
    return 'hellscape';
  }
  // Infinite — rotate
  const cycle: ThemeKey[] = ['crypt', 'catacomb', 'cavern', 'hellscape'];
  return cycle[opts.endlessRound % cycle.length];
}

// ----- Aggregate list for preloading -----
export function dungeonAssetsToLoad(build: BuildDef, theme: ThemeKey): string[] {
  const playerSprite = PLAYER_SPRITE_BY_BUILD[build.id] ?? PLAYER_SPRITE_BY_BUILD['gambler'];
  const enemySprites = Object.values(ENEMY_SPRITE_BY_TYPE);
  const t = THEMES[theme];
  return [playerSprite, ...enemySprites, t.floor, ...t.decorations];
}
