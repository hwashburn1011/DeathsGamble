import type { PlayerStats } from '../types';

// Bargains (#165) — Death offers between cleared rooms. All player-positive,
// no harsh costs (per design constraint). Each raid the player gets a chance
// to take one of three random options after a non-final, non-mini-boss room
// clears. Effects apply to the current PlayerStats in-place (same shape as
// wheel segments).

export interface BargainDef {
  id: string;
  name: string;
  desc: string;
  /** Quoted dialogue line spoken in Death's voice when offered. */
  flavor: string;
  apply: (s: PlayerStats) => void;
}

export const BARGAINS: BargainDef[] = [
  {
    id: 'iron_heart',
    name: 'Iron Heart',
    desc: '+30 max HP (heals to full).',
    flavor: '"Take more flesh. You will need it."',
    apply: (s) => { s.hpMax += 30; s.hp = s.hpMax; },
  },
  {
    id: 'whisper',
    name: "Death's Whisper",
    desc: '+25% critical chance for the raid.',
    flavor: '"I will tell you where to strike."',
    apply: (s) => { s.crit = Math.min(1, s.crit + 0.25); },
  },
  {
    id: 'reapers_step',
    name: "Reaper's Step",
    desc: '+1 movement speed.',
    flavor: '"Walk as I do — between heartbeats."',
    apply: (s) => { s.spd += 1; },
  },
  {
    id: 'soul_mark',
    name: 'Soul Mark',
    desc: '+0.4 attack speed.',
    flavor: '"Strike often. I am patient."',
    apply: (s) => { s.atkspd += 0.4; },
  },
  {
    id: 'echoing_strike',
    name: 'Echoing Strike',
    desc: '+25% damage multiplier.',
    flavor: '"Every blow you land — I land twice."',
    apply: (s) => { s.dmgMult *= 1.25; },
  },
  {
    id: 'bloodlust',
    name: 'Bloodlust',
    desc: '+5% lifesteal.',
    flavor: '"Drink. The dead need nothing."',
    apply: (s) => { s.lifesteal += 0.05; },
  },
  {
    id: 'rangers_sight',
    name: "Ranger's Sight",
    desc: '+75 attack range.',
    flavor: '"See further than they expect."',
    apply: (s) => { s.range += 75; },
  },
  {
    id: 'iron_skin',
    name: 'Iron Skin',
    desc: '+4 defense.',
    flavor: '"Their teeth will dull on you."',
    apply: (s) => { s.def += 4; },
  },
];

export const BARGAINS_BY_ID: Record<string, BargainDef> = Object.fromEntries(
  BARGAINS.map((b) => [b.id, b])
);

/**
 * Pick 3 random bargains the player hasn't taken yet, weighted uniformly.
 * Returns fewer if the player has already taken most of them this raid.
 */
export function rollBargainChoices(taken: string[]): BargainDef[] {
  const available = BARGAINS.filter((b) => !taken.includes(b.id));
  // Shuffle (Fisher-Yates) and take first 3.
  const arr = [...available];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 3);
}
