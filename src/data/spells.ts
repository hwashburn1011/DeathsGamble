import type { SpellDef } from '../types';

export const SPELLS: SpellDef[] = [
  { id: 'overkill',  name: 'Overkill',  desc: '+50% weapon damage',           effect: { dmgMult: 1.5 } },
  { id: 'lifesteal', name: 'Lifesteal', desc: 'Heal 8% of damage dealt',      effect: { lifesteal: 0.08 } },
  { id: 'tank',      name: 'Tank',      desc: '+40 Max HP',                   effect: { hpBonus: 40 } },
  { id: 'crit',      name: 'Critical',  desc: '+20% crit chance',             effect: { critBonus: 0.20 } },
  { id: 'pierce',    name: 'Pierce',    desc: 'Projectiles hit 2 extra foes', effect: { pierce: 2 } },
  { id: 'haste',     name: 'Haste',     desc: '+30% attack speed',            effect: { atkspdMult: 1.3 } },
  { id: 'reach',     name: 'Far Reach', desc: '+50 weapon range',             effect: { rangeBonus: 50 } },
];

export const SPELLS_BY_ID: Record<string, SpellDef> = Object.fromEntries(
  SPELLS.map((s) => [s.id, s])
);
