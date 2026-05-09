import { create } from 'zustand';
import type {
  BuildDef,
  GameMode,
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
  addKills(n: number): void;
  resetRun(): void;

  // Stats / wheel flow
  initStatsForRaid(): void;
  applyWheelSegment(side: 'buff' | 'curse', segment: WheelSegment): number;
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

  addKills(n) {
    set({ run: { ...get().run, killsTotal: get().run.killsTotal + n } });
  },

  resetRun() {
    set({ run: blankRun(), stats: null });
  },

  initStatsForRaid() {
    const { build, weapon, spells } = get().run;
    if (!build || !weapon) return;
    const diff = useSettingsStore.getState().difficulty;
    set({ stats: baseStats(build, weapon, spells, diff) });
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
}));
