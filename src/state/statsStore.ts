import { create } from 'zustand';

const KEY = 'dg_lifetime_stats_v1';

export interface LifetimeStats {
  totalRuns: number;
  wins: number;
  deaths: number;
  totalKills: number;
  totalCash: number;
  bestEndlessRound: number;
  jackpots: number;
  /** Build id → run count, lets the UI surface a "favorite". */
  buildPlays: Record<string, number>;
}

const blank = (): LifetimeStats => ({
  totalRuns: 0,
  wins: 0,
  deaths: 0,
  totalKills: 0,
  totalCash: 0,
  bestEndlessRound: 0,
  jackpots: 0,
  buildPlays: {},
});

function load(): LifetimeStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    return { ...blank(), ...JSON.parse(raw) };
  } catch {
    return blank();
  }
}

function save(s: LifetimeStats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* storage unavailable */ }
}

interface Actions {
  recordRunStart(buildId: string | null): void;
  recordWin(kills: number, cashEarned: number): void;
  recordDeath(kills: number, cashEarned: number): void;
  recordEndlessRound(round: number): void;
  recordJackpot(): void;
  reset(): void;
}

export const useStatsStore = create<LifetimeStats & Actions>((set, get) => ({
  ...load(),

  recordRunStart(buildId) {
    const s = get();
    const next: LifetimeStats = {
      ...s,
      totalRuns: s.totalRuns + 1,
      buildPlays: buildId
        ? { ...s.buildPlays, [buildId]: (s.buildPlays[buildId] ?? 0) + 1 }
        : s.buildPlays,
    };
    set(next);
    save(next);
  },

  recordWin(kills, cashEarned) {
    const s = get();
    const next: LifetimeStats = {
      ...s,
      wins: s.wins + 1,
      totalKills: s.totalKills + kills,
      totalCash: s.totalCash + cashEarned,
    };
    set(next);
    save(next);
  },

  recordDeath(kills, cashEarned) {
    const s = get();
    const next: LifetimeStats = {
      ...s,
      deaths: s.deaths + 1,
      totalKills: s.totalKills + kills,
      totalCash: s.totalCash + cashEarned,
    };
    set(next);
    save(next);
  },

  recordEndlessRound(round) {
    const s = get();
    if (round <= s.bestEndlessRound) return;
    const next = { ...s, bestEndlessRound: round };
    set(next);
    save(next);
  },

  recordJackpot() {
    const s = get();
    const next = { ...s, jackpots: s.jackpots + 1 };
    set(next);
    save(next);
  },

  reset() {
    const next = blank();
    set(next);
    save(next);
  },
}));

/** Returns a build id with the highest play count, or null. */
export function favoriteBuildId(s: LifetimeStats): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of Object.entries(s.buildPlays)) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}
