import type { WheelSegment } from '../types';

// `apply(stats, mult)` — `mult` scales the magnitude (used for endless escalation
// and difficulty curse-mult). luckScore: higher = player-favorable.
//
// Labels are SHORT trait names (one word) so they fit on the pie slice / slot row.
// `formatGiftLabel(seg)` / `formatTollLabel(seg)` prepend "Death's Gift:" / "Toll:"
// for HUD chips + spin result display (#174/#175).

// Symmetry pass (#159) — every player-stat buff has an opposite-and-equal
// curse counterpart. Magnitudes equalized so a Gift+Toll pair cancels out:
//
//   Vigor +20 hp/hpMax   ↔  Frailty       -20 hp/hpMax    (20/80 = 25%, under the 30% rule)
//   Strength +5 dmg      ↔  Weakness      -5 dmg
//   Hardiness +3 def     ↔  Glass         -3 def
//   Swiftness +1 spd     ↔  Lethargy      -1 spd
//   Alacrity +0.3 atkspd ↔  Sluggishness  -0.3 atkspd
//   Reach +50 range      ↔  Myopia        -50 range
//   Fortune +15% crit    ↔  Misfortune    -15% crit
//   Wrath ×1.15 dmgMult  ↔  Stiffness     ×0.85 atkspdMult (cross-stat, equal magnitude)
//   Frail Foes ×0.85 hp  ↔  Hardened Foes ×1.15 hp
//   Slow Foes ×0.80 spd  ↔  Swift Foes    ×1.20 spd
//   Sparse ×0.85 spawn   ↔  Crowded       ×1.15 spawn
//   Soft Claws -2 dmg    ↔  Sharp Claws   +2 enemy dmg
//
// Greed/Hunger/Piercer dropped from BUFF wheel to make room for the new
// enemy-debuff buffs (kept available via the JACKPOT mega-buff).
// CURSE_JACKPOT (#160) opens a sub-wheel of 6-8 mild stat curses.

export const BUFF_SEGMENTS: WheelSegment[] = [
  { label: 'Vigor',       luckScore: 7,  color: '#4d8a52', apply: (s, m = 1) => { s.hp += 20 * m; s.hpMax += 20 * m; } },
  { label: 'Strength',    luckScore: 6,  color: '#69b070', apply: (s, m = 1) => { s.dmg += 5 * m; } },
  { label: 'Hardiness',   luckScore: 5,  color: '#4d8a52', apply: (s, m = 1) => { s.def += 3 * m; } },
  { label: 'Swiftness',   luckScore: 6,  color: '#69b070', apply: (s, m = 1) => { s.spd += 1 * m; } },
  { label: 'Alacrity',    luckScore: 7,  color: '#4d8a52', apply: (s, m = 1) => { s.atkspd += 0.3 * m; } },
  { label: 'Reach',       luckScore: 6,  color: '#69b070', apply: (s, m = 1) => { s.range += 50 * m; } },
  { label: 'Fortune',     luckScore: 7,  color: '#4d8a52', apply: (s, m = 1) => { s.crit = Math.min(1, s.crit + 0.15 * m); } },
  { label: 'Wrath',       luckScore: 6,  color: '#69b070', apply: (s, m = 1) => { s.dmgMult *= 1 + 0.15 * m; } },
  // Enemy-debuff buffs (#159) — mirror the four enemy-buff curses.
  { label: 'Frail Foes',  luckScore: 5,  color: '#4d8a52', apply: (s, m = 1) => { s.enemyHpMult *= 1 - 0.15 * m; } },
  { label: 'Slow Foes',   luckScore: 6,  color: '#69b070', apply: (s, m = 1) => { s.enemySpdMult *= 1 - 0.20 * m; } },
  { label: 'Soft Claws',  luckScore: 5,  color: '#4d8a52', apply: (s, m = 1) => { s.enemyDmgBonus -= 2 * m; } },
  { label: 'JACKPOT',     luckScore: 12, color: '#e6c34a', apply: (s, m = 1) => { s.dmg += 10 * m; s.hp += 20 * m; s.hpMax += 20 * m; s.atkspd += 0.3 * m; s.lifesteal += 0.03 * m; } },
];

export const CURSE_SEGMENTS: WheelSegment[] = [
  { label: 'Frailty',       luckScore: 5, color: '#7a3030', apply: (s, m = 1) => { s.hp = Math.max(20, s.hp - 20 * m); s.hpMax = Math.max(20, s.hpMax - 20 * m); } },
  { label: 'Weakness',      luckScore: 5, color: '#9a3030', apply: (s, m = 1) => { s.dmg = Math.max(1, s.dmg - 5 * m); } },
  { label: 'Glass',         luckScore: 5, color: '#7a3030', apply: (s, m = 1) => { s.def -= 3 * m; } },
  { label: 'Lethargy',      luckScore: 5, color: '#9a3030', apply: (s, m = 1) => { s.spd = Math.max(1, s.spd - 1 * m); } },
  { label: 'Sluggishness',  luckScore: 5, color: '#7a3030', apply: (s, m = 1) => { s.atkspd = Math.max(0.3, s.atkspd - 0.3 * m); } },
  { label: 'Myopia',        luckScore: 5, color: '#9a3030', apply: (s, m = 1) => { s.range = Math.max(80, s.range - 50 * m); } },
  { label: 'Misfortune',    luckScore: 5, color: '#7a3030', apply: (s, m = 1) => { s.crit = Math.max(0, s.crit - 0.15 * m); } },
  { label: 'Stiffness',     luckScore: 5, color: '#9a3030', apply: (s, m = 1) => { s.atkspdMult *= 1 - 0.15 * m; } },
  { label: 'Hardened Foes', luckScore: 5, color: '#7a3030', apply: (s, m = 1) => { s.enemyHpMult *= 1 + 0.15 * m; } },
  { label: 'Swift Foes',    luckScore: 4, color: '#9a3030', apply: (s, m = 1) => { s.enemySpdMult *= 1 + 0.20 * m; } },
  { label: 'Sharp Claws',   luckScore: 4, color: '#7a3030', apply: (s, m = 1) => { s.enemyDmgBonus += 2 * m; } },
  // CURSE_JACKPOT (#160) — opens a sub-wheel of 6-8 small stat curses.
  // The `apply` here is a no-op because the engine intercepts this segment
  // via its label and triggers the sub-wheel flow instead of applying.
  { label: 'CURSE_JACKPOT', luckScore: 6, color: '#a02060', apply: () => { /* handled by sub-wheel */ } },
];

/**
 * Sub-wheel rolled when the main curse wheel lands on CURSE_JACKPOT (#160).
 * Each segment is a SMALL stat reduction so the player feels chipped, not
 * gutted. 8 entries — fits the user's "6-8 choices" target.
 *
 * Last two are mild "behavior" curses (#161) — themed double-stat dings
 * that change the FEEL of play (off-balance, distracted) without bleeding-
 * tier punishment.
 */
export const CURSE_JACKPOT_SEGMENTS: WheelSegment[] = [
  { label: 'Pinprick',    luckScore: 6, color: '#a02060', apply: (s, m = 1) => { s.hp = Math.max(20, s.hp - 5 * m); s.hpMax = Math.max(20, s.hpMax - 5 * m); } },
  { label: 'Dull Edge',   luckScore: 6, color: '#a02060', apply: (s, m = 1) => { s.dmg = Math.max(1, s.dmg - 1 * m); } },
  { label: 'Tin Skin',    luckScore: 6, color: '#a02060', apply: (s, m = 1) => { s.def -= 1 * m; } },
  { label: 'Dragfoot',    luckScore: 6, color: '#a02060', apply: (s, m = 1) => { s.spd = Math.max(1, s.spd - 0.3 * m); } },
  { label: 'Fumble',      luckScore: 6, color: '#a02060', apply: (s, m = 1) => { s.atkspd = Math.max(0.3, s.atkspd - 0.1 * m); } },
  { label: 'Squint',      luckScore: 6, color: '#a02060', apply: (s, m = 1) => { s.range = Math.max(80, s.range - 15 * m); } },
  // Behavior-themed mild curses (#161) — double-stat dings, no continuous
  // damage. Recoverable within a single dungeon room.
  { label: 'Off-Balance', luckScore: 6, color: '#a02060', apply: (s, m = 1) => { s.spd = Math.max(1, s.spd - 0.5 * m); s.atkspd = Math.max(0.3, s.atkspd - 0.05 * m); } },
  { label: 'Distracted',  luckScore: 6, color: '#a02060', apply: (s, m = 1) => { s.range = Math.max(80, s.range - 15 * m); s.dmg = Math.max(1, s.dmg - 2 * m); } },
];

export const SEG_COUNT = 12;
export const SEG_ANGLE = (Math.PI * 2) / SEG_COUNT;

/** Format a buff segment label for HUD chip / spin result ("Death's Gift: Vigor"). */
export function formatGiftLabel(label: string): string {
  return label === 'JACKPOT' ? 'JACKPOT' : `Death's Gift: ${label}`;
}

/** Format a curse segment label for HUD chip / spin result ("Death's Toll: Frailty"). */
export function formatTollLabel(label: string): string {
  if (label === 'CURSE_JACKPOT') return "Death's Toll: JACKPOT";
  return `Death's Toll: ${label}`;
}
