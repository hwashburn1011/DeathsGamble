// Asset manifest — declares which sprite paths the dungeon scene needs.
// Pixi's Assets system caches by URL string, so we keep the IDs identical
// to the relative URL paths.
//
// All asset paths are relative to import.meta.env.BASE_URL so the build works
// under the GitHub Pages '/DeathsGamble/' base path.

import type { BuildDef, EnemySprite } from '../../types';

const BASE = import.meta.env.BASE_URL;

// ----- Per-build character sprites (Dungeon Crawl, CC0) ------
// Use the more thematic clothed/equipped monster sprites instead of the
// bare player BASE sprites — those are designed to be composited under
// gear overlays and look "naked" alone.
export const PLAYER_SPRITE_BY_BUILD: Record<string, string> = {
  gambler:  `${BASE}assets/tiles/dungeon-crawl/dc-mon/human.png`,         // clothed humanoid
  duelist:  `${BASE}assets/tiles/dungeon-crawl/dc-mon/halfling.png`,      // cloaked, weapon-bearing
  brute:    `${BASE}assets/tiles/dungeon-crawl/dc-mon/ogre.png`,          // bulky, imposing
  arcanist: `${BASE}assets/tiles/dungeon-crawl/dc-mon/wizard.png`,        // purple wizard hat
  rogue:    `${BASE}assets/tiles/dungeon-crawl/player/base/halfling_m.png`, // small + stealthy base
  huntsman: `${BASE}assets/tiles/dungeon-crawl/player/base/centaur_brown_m.png`, // mounted ranger
  witch:    `${BASE}assets/tiles/dungeon-crawl/dc-mon/necromancer.png`,   // hooded dark figure
  soldier:  `${BASE}assets/tiles/dungeon-crawl/dc-mon/orc_warrior.png`,   // armored warrior
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
// Map weapon.id → projectile sprite path. `null` = use the Graphics
// fallback in DungeonGame.fireProjectile (small bullet for guns, slash
// arc for melee). The Dungeon Crawl bolt sprites all read as long
// arrows/bones at game scale, so guns just use a tight bright dot
// — a real "bullet" is too tiny to depict and the dot reads better.
export const PROJECTILE_BY_WEAPON: Record<string, string | null> = {
  // Melee — slash arc
  fists:  null,
  club:   null,
  sword:  null,
  axe:    null,
  spear:  null,
  scythe: null,
  // Guns — small bright bullet dot
  pistol:  null,
  shotgun: null,
  smg:     null,
  sniper:  null,
  rifle:   null,
  minigun: null,
  // Bow / crossbow / thrown — real arrow sprites that rotate to direction
  bow:      `${BASE}assets/tiles/dungeon-crawl/effect/arrow0.png`,
  crossbow: `${BASE}assets/tiles/dungeon-crawl/effect/arrow0.png`,
  knives:   `${BASE}assets/tiles/dungeon-crawl/effect/arrow2.png`,
  // Magic — glyph clouds tinted with weapon color
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
const KTD = `${BASE}assets/tiles/kenney-tiny-dungeon/tiles`;

export interface ThemeDef {
  floor: string;
  /** Decoration sprite paths. Picked at random for each scatter slot. */
  decorations: string[];
  /** Tint applied to the floor TilingSprite (multiplicative). */
  floorTint: number;
}

export const THEMES: Record<ThemeKey, ThemeDef> = {
  // Raid 1 — crypt (light tan stone)
  crypt: {
    floor: `${KTD}/tile_0048.png`,    // Kenney — clean light tan stone
    decorations: [
      `${DC}/dc-dngn/crumbled_column.png`,
      `${DC}/dc-dngn/dngn_granite_statue.png`,
      `${DC}/dc-dngn/granite_stump.png`,
      `${DC}/dc-dngn/dngn_dry_fountain.png`,
      `${DC}/dc-dngn/elephant_statue.png`,
    ],
    floorTint: 0xffffff,
  },
  // Raid 2 — catacomb (tan sandstone)
  catacomb: {
    floor: `${KTD}/tile_0048.png`,    // Kenney — light tan stone
    decorations: [
      `${DC}/dc-dngn/granite_stump.png`,
      `${DC}/dc-dngn/dngn_blue_fountain.png`,
      `${DC}/dc-dngn/crumbled_column.png`,
      `${DC}/dc-dngn/dngn_granite_statue.png`,
      `${DC}/dc-dngn/dngn_orcish_idol.png`,
    ],
    floorTint: 0xe8d8b8,
  },
  // Raid 3+ / boss — hellscape (red-tinted floor + bloody decorations)
  hellscape: {
    floor: `${KTD}/tile_0040.png`,    // Same cobble, tinted red for hellfire
    decorations: [
      `${DC}/dc-dngn/dngn_blood_fountain.png`,
      `${DC}/dc-misc/blood_red1.png`,
      `${DC}/dc-misc/blood_red2.png`,
      `${DC}/dc-misc/blood_red3.png`,
      `${DC}/dc-dngn/dngn_orcish_idol.png`,
      `${DC}/dc-dngn/crumbled_column.png`,
    ],
    floorTint: 0xc04848,
  },
  // Endless variant — cavern (warm tan)
  cavern: {
    floor: `${KTD}/tile_0050.png`,    // Kenney — slightly darker tan
    decorations: [
      `${DC}/dc-dngn/crumbled_column.png`,
      `${DC}/dc-dngn/granite_stump.png`,
      `${DC}/dc-dngn/dngn_dry_fountain.png`,
    ],
    floorTint: 0xeed8b8,
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
  // Infinite — start atmospheric (crypt), then rotate. Cavern gets a back
  // seat since the sandstone tile reads as a flat desert; it still appears
  // every 4th round but isn't the first thing the player sees.
  const cycle: ThemeKey[] = ['crypt', 'hellscape', 'catacomb', 'cavern'];
  return cycle[opts.endlessRound % cycle.length];
}

// ----- Aggregate list for preloading -----
export function dungeonAssetsToLoad(build: BuildDef, theme: ThemeKey): string[] {
  const playerSprite = PLAYER_SPRITE_BY_BUILD[build.id] ?? PLAYER_SPRITE_BY_BUILD['gambler'];
  const enemySprites = Object.values(ENEMY_SPRITE_BY_TYPE);
  const t = THEMES[theme];
  return [playerSprite, ...enemySprites, t.floor, ...t.decorations];
}
