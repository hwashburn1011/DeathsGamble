import { create } from 'zustand';
import type {
  BuildDef,
  GameMode,
  RunState,
  SceneName,
  WeaponDef,
} from '../types';
import { DIFFICULTY } from '../data/difficulty';
import { useSettingsStore } from './settingsStore';

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
}

interface GameStoreState {
  scene: SceneName;
  run: RunState;
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

  showScene(name) {
    set({ scene: name });
  },

  startNewRun() {
    set({ scene: 'modeselect', run: blankRun() });
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
    set({ run: blankRun() });
  },
}));
