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
import { baseStats } from '../engine/stats';
import { spinMagnitude } from '../engine/luck';

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

  // Round/raid progression
  isBossRaid(): boolean;
  nextRound(): void;             // story: next raid OR boss; infinite: next round
  continueAfterShop(): void;     // shop "Continue" → wheels for the next round
  triggerWin(): void;
}

interface GameStoreState {
  scene: SceneName;
  run: RunState;
  stats: PlayerStats | null;
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
  upgrades: { hp: 0, dmg: 0, spd: 0, def: 0, crit: 0, luck: 0, cash: 0 },
});

export const useGameStore = create<GameStoreState & GameActions>((set, get) => ({
  scene: 'title',
  run: blankRun(),
  stats: null,

  showScene(name) {
    set({ scene: name });
  },

  startNewRun() {
    set({ scene: 'modeselect', run: blankRun(), stats: null });
  },

  selectMode(mode) {
    const diff = useSettingsStore.getState().difficulty;
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
    const { build, weapon, spells, upgrades } = get().run;
    if (!build || !weapon) return;
    const diff = useSettingsStore.getState().difficulty;
    set({ stats: baseStats(build, weapon, spells, diff, upgrades) });
  },

  applyWheelSegment(side, segment) {
    const { stats, run } = get();
    if (!stats) return 1;
    const diff = useSettingsStore.getState().difficulty;
    const m = spinMagnitude(side, run.mode, diff, run.endlessRound);
    // Mutate a copy, then store
    const next = { ...stats };
    segment.apply(next, m);
    set({ stats: next });
    return m;
  },

  isBossRaid() {
    const r = get().run;
    return r.mode === 'story' && r.raid >= r.totalRaids;
  },

  nextRound() {
    const { run } = get();
    if (run.mode === 'story') {
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
}));
