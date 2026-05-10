import type { SpellDef } from '../types';

// Spells (#157/#158) — playstyle conditionals, not flat stat sticks.
// Each spell triggers on a specific gameplay moment, so picking a spell
// shapes HOW you fight, not just your stat sheet.

export const SPELLS: SpellDef[] = [
  // Overkill — opener punisher. First strike on a fresh enemy lands like a truck.
  {
    id: 'overkill',
    name: 'Overkill',
    desc: 'First hit on a full-HP enemy deals 3× damage.',
    effect: { fullHpHitMult: 3 },
  },
  // Lifesteal — sustain spell. Smaller per-hit + big on-kill burst.
  {
    id: 'lifesteal',
    name: 'Lifesteal',
    desc: 'Heal 4% of damage dealt + 5% of max HP on kill.',
    effect: { lifesteal: 0.04, killHealPct: 0.05 },
  },
  // Tank — comeback spell. Defense surges when you're nearly dead.
  {
    id: 'tank',
    name: 'Last Stand',
    desc: '+40 max HP. Defense doubles when below 30% HP.',
    effect: { hpBonus: 40, defLowHpMult: 2.0 },
  },
  // Crit — chain spell. Crits ricochet for follow-up damage.
  {
    id: 'crit',
    name: 'Critical Chain',
    desc: '+15% crit. Crits chain to a nearby enemy for 50% damage.',
    effect: { critBonus: 0.15, critChainPct: 0.5 },
  },
  // Pierce — kill-streak spell. Bullets cut through after a kill.
  {
    id: 'pierce',
    name: 'Momentum',
    desc: 'After a kill, your shots pierce 3 extra enemies for 0.6 seconds.',
    effect: { killStreakPierce: 3 },
  },
  // Haste — sustained-fire spell. Ramps with continuous attacking.
  {
    id: 'haste',
    name: 'Haste',
    desc: 'Attack speed ramps up to +50% from sustained fire. Resets when you stop.',
    effect: { sustainedFireRamp: 0.5 },
  },
  // Reach — patient kiter spell. Range grows on each kill, resets on damage taken.
  {
    id: 'reach',
    name: 'Far Reach',
    desc: '+50 range. Each kill extends range +10 (cap +200). Resets on damage taken.',
    effect: { rangeBonus: 50, killStreakRange: 10 },
  },
];

export const SPELLS_BY_ID: Record<string, SpellDef> = Object.fromEntries(
  SPELLS.map((s) => [s.id, s])
);
