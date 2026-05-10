import { create } from 'zustand';
import { UNLOCKS_BY_ID } from '../data/unlocks';

// Souls store (#168) — separate persistent slot from the cash save bundle so
// it can evolve independently. Tracks the meta currency + the set of items
// the player has unlocked. localStorage-backed; survives reload.

const SOULS_KEY = 'deathsgamble_souls_v1';

interface SoulsSnapshot {
  souls: number;
  unlocked: string[];
  /** True after the player has completed at least one run — used to gate the
   *  first-run welcome toast (#173). */
  hasPlayed: boolean;
}

interface SoulsActions {
  /** Award souls (e.g. on death/win). Returns the new total. */
  addSouls(n: number): number;
  /** Try to unlock an item. Returns true if it succeeded (enough souls + not
   *  already owned), false otherwise. Persists on success. */
  unlock(id: string): boolean;
  /** Mark the player has played at least one run (hides first-run prompts). */
  markPlayed(): void;
  /** True if the player has purchased this unlock. */
  isUnlocked(id: string): boolean;
}

function loadSouls(): SoulsSnapshot {
  try {
    const raw = localStorage.getItem(SOULS_KEY);
    if (!raw) return { souls: 0, unlocked: [], hasPlayed: false };
    const data = JSON.parse(raw);
    return {
      souls: typeof data.souls === 'number' ? data.souls : 0,
      unlocked: Array.isArray(data.unlocked) ? data.unlocked : [],
      hasPlayed: !!data.hasPlayed,
    };
  } catch {
    return { souls: 0, unlocked: [], hasPlayed: false };
  }
}

function persistSouls(s: SoulsSnapshot): void {
  try {
    localStorage.setItem(SOULS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — ignore */
  }
}

export const useSoulsStore = create<SoulsSnapshot & SoulsActions>((set, get) => ({
  ...loadSouls(),
  addSouls(n) {
    const next = get().souls + n;
    set({ souls: next });
    persistSouls(snapshot(get()));
    return next;
  },
  unlock(id) {
    const def = UNLOCKS_BY_ID[id];
    if (!def) return false;
    const s = get();
    if (s.unlocked.includes(id)) return false;
    if (s.souls < def.cost) return false;
    const next = { souls: s.souls - def.cost, unlocked: [...s.unlocked, id] };
    set(next);
    persistSouls(snapshot(get()));
    return true;
  },
  markPlayed() {
    if (get().hasPlayed) return;
    set({ hasPlayed: true });
    persistSouls(snapshot(get()));
  },
  isUnlocked(id) {
    return get().unlocked.includes(id);
  },
}));

function snapshot(s: SoulsSnapshot): SoulsSnapshot {
  return { souls: s.souls, unlocked: s.unlocked, hasPlayed: s.hasPlayed };
}
