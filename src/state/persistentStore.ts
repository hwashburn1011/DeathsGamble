import { create } from 'zustand';
import type { PersistentState, PersistentUpgrades } from '../types';
import { defaultPersistent, loadSave, writeSave } from './persistent';

interface PersistentActions {
  addCash(amt: number): void;
  spendCash(amt: number): boolean;
  buyUpgrade(id: keyof PersistentUpgrades): void;
  toJSON(): PersistentState;
  reset(): void;
}

export const usePersistentStore = create<PersistentState & PersistentActions>((set, get) => ({
  ...loadSave().persistent,
  addCash(amt) {
    set({ cash: get().cash + amt });
    persist();
  },
  spendCash(amt) {
    if (get().cash < amt) return false;
    set({ cash: get().cash - amt });
    persist();
    return true;
  },
  buyUpgrade(id) {
    const u = { ...get().upgrades };
    u[id] = (u[id] ?? 0) + 1;
    set({ upgrades: u });
    persist();
  },
  toJSON() {
    const { cash, upgrades } = get();
    return { cash, upgrades };
  },
  reset() {
    set(defaultPersistent());
    persist();
  },
}));

function persist() {
  // Lazy import to avoid a circular dep at module load.
  import('./settingsStore').then(({ useSettingsStore }) => {
    const settings = useSettingsStore.getState();
    writeSave(usePersistentStore.getState().toJSON(), settings);
  });
}
