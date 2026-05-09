import { create } from 'zustand';
import type { SettingsState } from '../types';
import { defaultSettings, loadSave, writeSave } from './persistent';
import { usePersistentStore } from './persistentStore';

interface SettingsActions {
  set<K extends keyof SettingsState>(key: K, value: SettingsState[K]): void;
  resetSave(): void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>((set, get) => ({
  ...loadSave().settings,
  set(key, value) {
    set({ [key]: value } as Partial<SettingsState>);
    const persistent = usePersistentStore.getState().toJSON();
    writeSave(persistent, { ...get() } as SettingsState);
  },
  resetSave() {
    set(defaultSettings());
    usePersistentStore.getState().reset();
    writeSave(usePersistentStore.getState().toJSON(), { ...get() } as SettingsState);
  },
}));
