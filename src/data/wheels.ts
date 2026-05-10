import type { WheelSegment } from '../types';

// `apply(stats, mult)` — `mult` scales the magnitude (used for endless escalation
// and difficulty curse-mult). luckScore: higher = player-favorable.
//
// Labels are SHORT trait names (one word) so they fit on the pie slice / slot row.
// `formatGiftLabel(seg)` / `formatTollLabel(seg)` prepend "Death's Gift:" / "Toll:"
// for HUD chips + spin result display (#174/#175).

export const BUFF_SEGMENTS: WheelSegment[] = [
  { label: 'Vigor',     luckScore: 8,  color: '#4d8a52', apply: (s, m = 1) => { s.hp += 25 * m; s.hpMax += 25 * m; } },
  { label: 'Strength',  luckScore: 7,  color: '#69b070', apply: (s, m = 1) => { s.dmg += 5 * m; } },
  { label: 'Hardiness', luckScore: 5,  color: '#4d8a52', apply: (s, m = 1) => { s.def += 3 * m; } },
  { label: 'Swiftness', luckScore: 6,  color: '#69b070', apply: (s, m = 1) => { s.spd += 1 * m; } },
  { label: 'Alacrity',  luckScore: 7,  color: '#4d8a52', apply: (s, m = 1) => { s.atkspd += 0.3 * m; } },
  { label: 'Reach',     luckScore: 6,  color: '#69b070', apply: (s, m = 1) => { s.range += 50 * m; } },
  { label: 'Fortune',   luckScore: 7,  color: '#4d8a52', apply: (s, m = 1) => { s.crit = Math.min(1, s.crit + 0.15 * m); } },
  { label: 'Greed',     luckScore: 4,  color: '#69b070', apply: (s, m = 1) => { s.pickup += 30 * m; } },
  // Iter7: lifesteal nerfed +5% → +3% (was 1.1 HP/sec heal at Pistol DPS,
  // dwarfing the one-time +25 HP buff over a 60s round).
  { label: 'Hunger',    luckScore: 7,  color: '#4d8a52', apply: (s, m = 1) => { s.lifesteal += 0.03 * m; } },
  // Pierce: +1 doubles DPS in clusters. Keeping at +1 since it's the only
  // pierce source on the wheel, but lowered luckScore so it's less biased
  // toward by high-luck rolls.
  { label: 'Piercer',   luckScore: 5,  color: '#69b070', apply: (s, m = 1) => { s.pierce += 1 * m; } },
  // +20% DMG mult compounds with all other dmg sources — kept but lowered
  // to +15% so it doesn't dominate stacked builds (Strength + Overkill + this).
  { label: 'Wrath',     luckScore: 6,  color: '#4d8a52', apply: (s, m = 1) => { s.dmgMult *= 1 + 0.15 * m; } },
  { label: 'JACKPOT',   luckScore: 12, color: '#e6c34a', apply: (s, m = 1) => { s.dmg += 10 * m; s.hp += 25 * m; s.hpMax += 25 * m; s.atkspd += 0.3 * m; } },
];

export const CURSE_SEGMENTS: WheelSegment[] = [
  { label: 'Frailty',       luckScore: 4, color: '#7a3030', apply: (s, m = 1) => { s.hp = Math.max(20, s.hp - 15 * m); s.hpMax = Math.max(20, s.hpMax - 15 * m); } },
  { label: 'Weakness',      luckScore: 5, color: '#9a3030', apply: (s, m = 1) => { s.dmg = Math.max(1, s.dmg - 3 * m); } },
  { label: 'Lethargy',      luckScore: 5, color: '#7a3030', apply: (s, m = 1) => { s.spd = Math.max(1, s.spd - 1 * m); } },
  { label: 'Sluggishness',  luckScore: 5, color: '#9a3030', apply: (s, m = 1) => { s.atkspd = Math.max(0.3, s.atkspd - 0.2 * m); } },
  { label: 'Hardened Foes', luckScore: 5, color: '#7a3030', apply: (s, m = 1) => { s.enemyHpMult *= 1 + 0.2 * m; } },
  { label: 'Swift Foes',    luckScore: 4, color: '#9a3030', apply: (s, m = 1) => { s.enemySpdMult *= 1 + 0.25 * m; } },
  { label: 'Crowded',       luckScore: 4, color: '#7a3030', apply: (s, m = 1) => { s.enemySpawnMult *= 1 + 0.3 * m; } },
  { label: 'Myopia',        luckScore: 5, color: '#9a3030', apply: (s, m = 1) => { s.range = Math.max(80, s.range - 40 * m); } },
  { label: 'Glass',         luckScore: 5, color: '#7a3030', apply: (s, m = 1) => { s.def -= 3 * m; } },
  { label: 'Sharp Claws',   luckScore: 4, color: '#9a3030', apply: (s, m = 1) => { s.enemyDmgBonus += 2 * m; } },
  { label: 'Misfortune',    luckScore: 6, color: '#7a3030', apply: (s, m = 1) => { s.crit = Math.max(0, s.crit - 0.10 * m); } },
  // Iter7: was -30 PICKUP — barely felt in playtests. Replaced with a
  // multiplicative atkspd reduction that bites harder on rapid-fire builds.
  { label: 'Stiffness',     luckScore: 5, color: '#9a3030', apply: (s, m = 1) => { s.atkspdMult *= 1 - 0.15 * m; } },
];

export const SEG_COUNT = 12;
export const SEG_ANGLE = (Math.PI * 2) / SEG_COUNT;

/** Format a buff segment label for HUD chip / spin result ("Death's Gift: Vigor"). */
export function formatGiftLabel(label: string): string {
  return label === 'JACKPOT' ? 'JACKPOT' : `Death's Gift: ${label}`;
}

/** Format a curse segment label for HUD chip / spin result ("Death's Toll: Frailty"). */
export function formatTollLabel(label: string): string {
  return `Death's Toll: ${label}`;
}
