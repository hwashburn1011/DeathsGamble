import { create } from 'zustand';
import type {
  BuildDef,
  GameMode,
  PersistentUpgrades,
  PlayerStats,
  RunState,
  SceneName,
  WeaponDef,
  WheelSegment,
} from '../types';
import { DIFFICULTY } from '../data/difficulty';
import { useSettingsStore } from './settingsStore';
import { useStatsStore } from './statsStore';
import { baseStats } from '../engine/stats';
import { spinMagnitude } from '../engine/luck';
import { beginDailyMode, endDailyMode } from '../engine/dailySeed';
import { formatGiftLabel, formatTollLabel } from '../data/wheels';
import { BARGAINS_BY_ID } from '../data/bargains';

interface GameActions {
  showScene(name: SceneName): void;
  startNewRun(): void;
  selectMode(mode: GameMode): void;
  pickBuild(build: BuildDef, weapon: WeaponDef): void;
  setRaid(raid: number): void;
  setEndlessRound(round: number): void;
  addCashEarned(amt: number): void;
  addCashToRun(amt: number): void;            // cash earned this run, available to spend
  spendRunCash(amt: number): boolean;
  buyRunUpgrade(id: keyof PersistentUpgrades): void;
  addKills(n: number): void;
  resetRun(): void;

  // Stats / wheel flow
  initStatsForRaid(): void;
  applyWheelSegment(side: 'buff' | 'curse', segment: WheelSegment): number;
  /** Apply a bargain (#167) — mutates current PlayerStats + records the
   *  bargain id so it won't be offered again this raid. */
  applyBargain(bargainId: string): void;
  buyPotion(cost: number): boolean;
  /** Record post-death summary fields from a DungeonRunSummary (#180-#182). */
  setLastRunSummary(s: { lastDamageSource: string; biggestHit: number; favoriteKill: string; timeAlive: number; soulsEarned?: number }): void;

  // Round/raid progression
  isBossRaid(): boolean;
  nextRound(): void;             // story: next raid OR boss; infinite: next round
  continueAfterShop(): void;     // shop "Continue" → wheels for the next round
  triggerWin(): void;
  /** Quick retry: re-run the same build + weapon + mode from raid 1 / round 1. */
  retrySameBuild(): void;

  setPaused(p: boolean): void;
}

interface GameStoreState {
  scene: SceneName;
  run: RunState;
  stats: PlayerStats | null;
  /** True while a modal (settings, pause, etc.) is open — DungeonGame uses this to pause its ticker. */
  paused: boolean;
}

const blankRun = (): RunState => ({
  mode: 'story',
  raid: 1,
  totalRaids: 3,
  endlessRound: 0,
  build: null,
  weapon: null,
  spells: [],
  cashEarned: 0,
  killsTotal: 0,
  cash: 0,
  upgrades: { hp: 0, dmg: 0, atkspd: 0, spd: 0, def: 0, crit: 0, luck: 0, cash: 0 },
  activeBuff: null,
  activeCurse: null,
  pendingPotions: 0,
  lastRunSummary: null,
  bargainsTaken: [],
});

export const useGameStore = create<GameStoreState & GameActions>((set, get) => ({
  scene: 'title',
  run: blankRun(),
  stats: null,
  paused: false,

  showScene(name) {
    set({ scene: name });
  },

  startNewRun() {
    endDailyMode(); // restore native RNG until the player picks a mode
    set({ scene: 'modeselect', run: blankRun(), stats: null });
  },

  selectMode(mode) {
    const diff = useSettingsStore.getState().difficulty;
    // Daily mode locks the RNG so every player gets the same seed.
    // Story / infinite use the native Math.random.
    if (mode === 'daily') beginDailyMode();
    else endDailyMode();
    set({
      scene: 'buildpicker',
      run: {
        ...blankRun(),
        mode,
        totalRaids: DIFFICULTY[diff].storyRaids,
      },
      stats: null,
    });
  },

  pickBuild(build, weapon) {
    set({
      scene: 'wheels',
      run: {
        ...get().run,
        build,
        weapon,
        spells: [...build.spells],
      },
    });
    get().initStatsForRaid();
    // Lifetime stats — record one run per build pick.
    useStatsStore.getState().recordRunStart(build.id);
  },

  setRaid(raid) {
    set({ run: { ...get().run, raid } });
  },

  setEndlessRound(round) {
    set({ run: { ...get().run, endlessRound: round } });
  },

  addCashEarned(amt) {
    set({ run: { ...get().run, cashEarned: get().run.cashEarned + amt } });
  },

  addCashToRun(amt) {
    const r = get().run;
    set({ run: { ...r, cash: r.cash + amt, cashEarned: r.cashEarned + amt } });
  },

  spendRunCash(amt) {
    const r = get().run;
    if (r.cash < amt) return false;
    set({ run: { ...r, cash: r.cash - amt } });
    return true;
  },

  buyRunUpgrade(id) {
    const r = get().run;
    const u = { ...r.upgrades };
    u[id] = (u[id] ?? 0) + 1;
    set({ run: { ...r, upgrades: u } });
  },

  addKills(n) {
    set({ run: { ...get().run, killsTotal: get().run.killsTotal + n } });
  },

  resetRun() {
    set({ run: blankRun(), stats: null });
  },

  initStatsForRaid() {
    const { build, weapon, spells, upgrades, pendingPotions } = get().run;
    if (!build || !weapon) return;
    const diff = useSettingsStore.getState().difficulty;
    const stats = baseStats(build, weapon, spells, diff, upgrades);
    if (pendingPotions > 0) {
      // Each potion grants +50 starting HP and +10 to max HP for the raid.
      stats.hpMax += 60 * pendingPotions;
      stats.hp = stats.hpMax;
    }
    set({ stats, run: { ...get().run, pendingPotions: 0, bargainsTaken: [] } });
  },

  buyPotion(cost) {
    const r = get().run;
    if (r.cash < cost) return false;
    set({ run: { ...r, cash: r.cash - cost, pendingPotions: r.pendingPotions + 1 } });
    return true;
  },

  setLastRunSummary(s) {
    set({ run: { ...get().run, lastRunSummary: s } });
  },

  applyWheelSegment(side, segment) {
    const { stats, run } = get();
    if (!stats) return 1;
    const diff = useSettingsStore.getState().difficulty;
    const m = spinMagnitude(side, run.mode, diff, run.endlessRound);
    // Mutate a copy, then store
    const next = { ...stats };
    segment.apply(next, m);
    // Track which segment landed for HUD display in the dungeon.
    // Apply thematic prefix per side (#174/#175 Death's Gift / Death's Toll).
    const themed = side === 'buff' ? formatGiftLabel(segment.label) : formatTollLabel(segment.label);
    const label = m !== 1 ? `${themed} ×${m.toFixed(1)}` : themed;
    const runPatch = side === 'buff'
      ? { ...run, activeBuff: label }
      : { ...run, activeCurse: label };
    set({ stats: next, run: runPatch });
    if (segment.label === 'JACKPOT') useStatsStore.getState().recordJackpot();
    return m;
  },

  applyBargain(bargainId) {
    const { stats, run } = get();
    if (!stats) return;
    const bargain = BARGAINS_BY_ID[bargainId];
    if (!bargain) return;
    const next = { ...stats };
    bargain.apply(next);
    set({
      stats: next,
      run: { ...run, bargainsTaken: [...run.bargainsTaken, bargainId] },
    });
  },

  isBossRaid() {
    const r = get().run;
    // Both story and daily modes culminate in a final boss raid.
    return (r.mode === 'story' || r.mode === 'daily') && r.raid >= r.totalRaids;
  },

  nextRound() {
    const { run } = get();
    if (run.mode === 'story' || run.mode === 'daily') {
      const nextRaid = Math.min(run.totalRaids, run.raid + 1);
      set({ run: { ...run, raid: nextRaid } });
    } else {
      set({ run: { ...run, endlessRound: run.endlessRound + 1 } });
    }
    // Stop in the shop first — player can spend cash before the next bargain.
    set({ scene: 'shop' });
  },

  continueAfterShop() {
    // Reset stats now (with any newly-purchased upgrades applied) and route
    // to wheels for the next round's bargain.
    get().initStatsForRaid();
    set({ scene: 'wheels' });
  },

  triggerWin() {
    set({ scene: 'win' });
  },

  retrySameBuild() {
    const prev = get().run;
    if (!prev.build || !prev.weapon) {
      // No prior build — fall back to a normal new-run flow.
      get().startNewRun();
      return;
    }
    const diff = useSettingsStore.getState().difficulty;
    set({
      scene: 'wheels',
      run: {
        ...blankRun(),
        mode: prev.mode,
        totalRaids: DIFFICULTY[diff].storyRaids,
        build: prev.build,
        weapon: prev.weapon,
        spells: [...prev.build.spells],
      },
      stats: null,
    });
    get().initStatsForRaid();
  },

  setPaused(p) {
    set({ paused: p });
  },
}));
