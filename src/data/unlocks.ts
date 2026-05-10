// Unlock tree (#170) — persistent meta-progression. Souls are the meta
// currency earned per run; unlocks gate access to extra builds. Three core
// builds (one per archetype) are free at start so a first-time player has
// real choices without grinding.

export interface UnlockDef {
  id: string;
  /** What kind of thing this unlocks — for grouping in the modal. */
  kind: 'build';
  /** Display name shown in the modal + toast. */
  name: string;
  /** Build/segment id this row controls — must match the data def. */
  refId: string;
  /** Souls cost. */
  cost: number;
  /** Short flavor / hook line under the cost. */
  desc: string;
}

/** Build IDs unlocked from the start — first-time player can pick any. */
export const STARTER_BUILDS = ['gambler', 'brute', 'witch'];

/** Items that must be purchased with souls to unlock. */
export const UNLOCKS: UnlockDef[] = [
  { id: 'unlock_soldier',  kind: 'build', name: 'The Soldier',  refId: 'soldier',  cost: 30,  desc: 'Reliable rifle. The all-rounder.' },
  { id: 'unlock_duelist',  kind: 'build', name: 'The Duelist',  refId: 'duelist',  cost: 50,  desc: 'Sword + crit. Riposte for ×5 burst.' },
  { id: 'unlock_huntsman', kind: 'build', name: 'The Huntsman', refId: 'huntsman', cost: 60,  desc: 'Long range. Reach grows on kills.' },
  { id: 'unlock_arcanist', kind: 'build', name: 'The Arcanist', refId: 'arcanist', cost: 80,  desc: 'Piercing arcane bolts. Glass cannon.' },
  { id: 'unlock_rogue',    kind: 'build', name: 'The Rogue',    refId: 'rogue',    cost: 100, desc: 'Fastest movement. Smoke Bomb invuln.' },
];

export const UNLOCKS_BY_ID: Record<string, UnlockDef> = Object.fromEntries(
  UNLOCKS.map((u) => [u.id, u])
);

/** True if the build id is freely playable — either a starter or purchased. */
export function isBuildUnlocked(buildId: string, purchased: string[]): boolean {
  if (STARTER_BUILDS.includes(buildId)) return true;
  return UNLOCKS.some((u) => u.kind === 'build' && u.refId === buildId && purchased.includes(u.id));
}

/**
 * Souls awarded per run. Encourages playing through more rooms / clearing
 * raids / beating the boss. Generous on early deaths so first-time players
 * see progress quickly.
 */
export interface SoulsAward {
  base: number;        // for surviving at all
  perRaid: number;     // each cleared raid
  perKill: number;     // every X kills = 1 soul (denominator)
  bossWin: number;     // bonus for beating Death itself
}

export const SOULS_AWARD: SoulsAward = {
  base: 5,
  perRaid: 10,
  perKill: 25,        // 1 soul per 25 kills
  bossWin: 75,
};

/** Compute souls for a single completed run. */
export function calcSoulsForRun(args: { kills: number; raidsCleared: number; bossDefeated: boolean }): number {
  const a = SOULS_AWARD;
  return a.base
    + args.raidsCleared * a.perRaid
    + Math.floor(args.kills / a.perKill)
    + (args.bossDefeated ? a.bossWin : 0);
}
