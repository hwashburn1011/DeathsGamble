import type { SpellDef } from '../types';

// Iter8: spell power compression. Overkill (+50% DPS) was strictly best,
// Reach (+10% range marginal) was strictly worst. Targets all spells at
// +25-35% effective combat value so build choice = playstyle, not min-max.
export const SPELLS: SpellDef[] = [
  // Overkill: was +50% (dominant) → tried +35% but Hard ranged builds
  // started dying. Settled on +40% — still strongest single-buff DPS but
  // not so dominant that other spells feel pointless.
  { id: 'overkill',  name: 'Overkill',  desc: '+40% weapon damage',           effect: { dmgMult: 1.40 } },
  // Lifesteal: kept 8% — strongest sustain after iter7 wheel nerf.
  { id: 'lifesteal', name: 'Lifesteal', desc: 'Heal 8% of damage dealt',      effect: { lifesteal: 0.08 } },
  // Tank: was +40 → +60 (Brute now 240 base HP, more "Unkillable").
  { id: 'tank',      name: 'Tank',      desc: '+60 Max HP',                   effect: { hpBonus: 60 } },
  // Crit: was +20% → +25% (slight bump to compete with Overkill).
  { id: 'crit',      name: 'Critical',  desc: '+25% crit chance',             effect: { critBonus: 0.25 } },
  // Pierce: kept +2 (already strong in clusters; no change).
  { id: 'pierce',    name: 'Pierce',    desc: 'Projectiles hit 2 extra foes', effect: { pierce: 2 } },
  // Haste: was +30% → kept (matches Overkill DPS-equivalent now).
  { id: 'haste',     name: 'Haste',     desc: '+30% attack speed',            effect: { atkspdMult: 1.3 } },
  // Reach: was +50 range only → +80 range AND +10% atkspd (was strictly
  // worst spell — now gives sniper builds two synergistic layers).
  { id: 'reach',     name: 'Far Reach', desc: '+80 range, +10% attack speed', effect: { rangeBonus: 80, atkspdMult: 1.10 } },
];

export const SPELLS_BY_ID: Record<string, SpellDef> = Object.fromEntries(
  SPELLS.map((s) => [s.id, s])
);
