import { create } from 'zustand';
import { useStatsStore, type LifetimeStats } from './statsStore';

const KEY = 'dg_achievements_v1';

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  /** True if the criterion is met given the current lifetime stats. */
  check: (s: LifetimeStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood',  name: 'First Blood',     desc: 'Kill your first enemy',                check: (s) => s.totalKills >= 1 },
  { id: 'first_win',    name: 'Debt Paid',       desc: 'Survive a full run',                   check: (s) => s.wins >= 1 },
  { id: 'first_jackpot',name: 'Lucky',           desc: 'Land your first JACKPOT',              check: (s) => s.jackpots >= 1 },
  { id: 'jackpot_5',    name: 'House Always Wins',desc: 'Land 5 JACKPOTs lifetime',            check: (s) => s.jackpots >= 5 },
  { id: 'kills_100',    name: 'Hundred Souls',   desc: 'Reap 100 enemies',                     check: (s) => s.totalKills >= 100 },
  { id: 'kills_1000',   name: 'Reaper',          desc: 'Reap 1,000 enemies',                   check: (s) => s.totalKills >= 1000 },
  { id: 'cash_1000',    name: 'Hoarder',         desc: 'Earn $1,000 across all runs',          check: (s) => s.totalCash >= 1000 },
  { id: 'cash_10000',   name: 'Tycoon',          desc: 'Earn $10,000 across all runs',         check: (s) => s.totalCash >= 10000 },
  { id: 'wins_5',       name: 'Repeat Offender', desc: 'Survive 5 runs',                       check: (s) => s.wins >= 5 },
  { id: 'wins_25',      name: 'Death\'s Bane',   desc: 'Survive 25 runs',                      check: (s) => s.wins >= 25 },
  { id: 'endless_5',    name: 'Endless 5',       desc: 'Reach round 5 in Infinite mode',       check: (s) => s.bestEndlessRound >= 5 },
  { id: 'endless_15',   name: 'Endless 15',      desc: 'Reach round 15 in Infinite mode',      check: (s) => s.bestEndlessRound >= 15 },
  { id: 'all_builds',   name: 'Polymath',        desc: 'Play every build at least once',       check: (s) => Object.keys(s.buildPlays).length >= 8 },
];

interface State {
  unlocked: Set<string>;
  /** Achievements that just unlocked, queued for popup display. */
  pendingPopups: Achievement[];
}

interface Actions {
  /** Re-evaluate all achievements against current stats; queue popups for newly-met ones. */
  reevaluate(): void;
  consumePopup(): void;
  reset(): void;
}

function loadUnlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveUnlocked(s: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(s)));
  } catch { /* unavailable */ }
}

export const useAchievementsStore = create<State & Actions>((set, get) => ({
  unlocked: loadUnlocked(),
  pendingPopups: [],

  reevaluate() {
    const stats = useStatsStore.getState();
    const cur = get().unlocked;
    const newlyUnlocked: Achievement[] = [];
    let dirty = false;
    const next = new Set(cur);
    for (const a of ACHIEVEMENTS) {
      if (cur.has(a.id)) continue;
      if (a.check(stats)) {
        next.add(a.id);
        newlyUnlocked.push(a);
        dirty = true;
      }
    }
    if (dirty) {
      saveUnlocked(next);
      set({
        unlocked: next,
        pendingPopups: [...get().pendingPopups, ...newlyUnlocked],
      });
    }
  },

  consumePopup() {
    const [, ...rest] = get().pendingPopups;
    set({ pendingPopups: rest });
  },

  reset() {
    saveUnlocked(new Set());
    set({ unlocked: new Set(), pendingPopups: [] });
  },
}));

// Subscribe to stats changes — every stat update re-evaluates achievements.
useStatsStore.subscribe(() => {
  useAchievementsStore.getState().reevaluate();
});
