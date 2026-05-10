import type { WheelSegment } from '../types';

// `apply(stats, mult)` — `mult` scales the magnitude (used for endless escalation
// and difficulty curse-mult). luckScore: higher = player-favorable (used by Luck stat
// to bias spin RNG — bigger boons / milder curses).

export const BUFF_SEGMENTS: WheelSegment[] = [
  { label: '+25 HP',      luckScore: 8,  color: '#4d8a52', apply: (s, m = 1) => { s.hp += 25 * m; s.hpMax += 25 * m; } },
  { label: '+5 DMG',      luckScore: 7,  color: '#69b070', apply: (s, m = 1) => { s.dmg += 5 * m; } },
  { label: '+3 DEF',      luckScore: 5,  color: '#4d8a52', apply: (s, m = 1) => { s.def += 3 * m; } },
  { label: '+1 SPD',      luckScore: 6,  color: '#69b070', apply: (s, m = 1) => { s.spd += 1 * m; } },
  { label: '+0.3 ATKSPD', luckScore: 7,  color: '#4d8a52', apply: (s, m = 1) => { s.atkspd += 0.3 * m; } },
  { label: '+50 RANGE',   luckScore: 6,  color: '#69b070', apply: (s, m = 1) => { s.range += 50 * m; } },
  { label: '+15% CRIT',   luckScore: 7,  color: '#4d8a52', apply: (s, m = 1) => { s.crit = Math.min(1, s.crit + 0.15 * m); } },
  { label: '+30 PICKUP',  luckScore: 4,  color: '#69b070', apply: (s, m = 1) => { s.pickup += 30 * m; } },
  // Was a duplicate "+25 HP" — replaced with lifesteal (uniquely impactful).
  { label: '+5% LIFESTEAL', luckScore: 7, color: '#4d8a52', apply: (s, m = 1) => { s.lifesteal += 0.05 * m; } },
  // Was a duplicate "+5 DMG" — replaced with +1 PIERCE (carries through enemies).
  { label: '+1 PIERCE',   luckScore: 6,  color: '#69b070', apply: (s, m = 1) => { s.pierce += 1 * m; } },
  // Was a duplicate "+1 SPD" — replaced with +20% damage multiplier (potent).
  { label: '+20% DMG',    luckScore: 7,  color: '#4d8a52', apply: (s, m = 1) => { s.dmgMult *= 1 + 0.20 * m; } },
  { label: 'JACKPOT',     luckScore: 12, color: '#e6c34a', apply: (s, m = 1) => { s.dmg += 10 * m; s.hp += 25 * m; s.hpMax += 25 * m; s.atkspd += 0.3 * m; } },
];

export const CURSE_SEGMENTS: WheelSegment[] = [
  { label: '-15 HP',         luckScore: 4, color: '#7a3030', apply: (s, m = 1) => { s.hp = Math.max(20, s.hp - 15 * m); s.hpMax = Math.max(20, s.hpMax - 15 * m); } },
  { label: '-3 DMG',         luckScore: 5, color: '#9a3030', apply: (s, m = 1) => { s.dmg = Math.max(1, s.dmg - 3 * m); } },
  { label: '-1 SPD',         luckScore: 5, color: '#7a3030', apply: (s, m = 1) => { s.spd = Math.max(1, s.spd - 1 * m); } },
  { label: '-0.2 ATKSPD',    luckScore: 5, color: '#9a3030', apply: (s, m = 1) => { s.atkspd = Math.max(0.3, s.atkspd - 0.2 * m); } },
  { label: 'ENEMY +20% HP',  luckScore: 5, color: '#7a3030', apply: (s, m = 1) => { s.enemyHpMult *= 1 + 0.2 * m; } },
  { label: 'ENEMY +25% SPD', luckScore: 4, color: '#9a3030', apply: (s, m = 1) => { s.enemySpdMult *= 1 + 0.25 * m; } },
  { label: '+30% SPAWNS',    luckScore: 4, color: '#7a3030', apply: (s, m = 1) => { s.enemySpawnMult *= 1 + 0.3 * m; } },
  { label: '-40 RANGE',      luckScore: 5, color: '#9a3030', apply: (s, m = 1) => { s.range = Math.max(80, s.range - 40 * m); } },
  { label: '-3 DEF',         luckScore: 5, color: '#7a3030', apply: (s, m = 1) => { s.def -= 3 * m; } },
  { label: '+2 ENEMY DMG',   luckScore: 4, color: '#9a3030', apply: (s, m = 1) => { s.enemyDmgBonus += 2 * m; } },
  { label: '-10% CRIT',      luckScore: 6, color: '#7a3030', apply: (s, m = 1) => { s.crit = Math.max(0, s.crit - 0.10 * m); } },
  { label: '-30 PICKUP',     luckScore: 5, color: '#9a3030', apply: (s, m = 1) => { s.pickup = Math.max(20, s.pickup - 30 * m); } },
];

export const SEG_COUNT = 12;
export const SEG_ANGLE = (Math.PI * 2) / SEG_COUNT;
