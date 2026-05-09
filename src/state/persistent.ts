import type { PersistentState, SettingsState } from '../types';

const SAVE_KEY = 'deathsgamble_save_v6';

export const defaultPersistent = (): PersistentState => ({
  cash: 0,
  upgrades: { hp: 0, dmg: 0, spd: 0, def: 0, crit: 0, luck: 0, cash: 0 },
});

export const defaultSettings = (): SettingsState => ({
  brightness: 1.0,
  difficulty: 'normal',
  wheelMode: 'wheel',
  blood: true,
  motionIntensity: 'normal',
});

interface SaveBundle {
  persistent: PersistentState;
  settings: SettingsState;
}

export function loadSave(): SaveBundle {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { persistent: defaultPersistent(), settings: defaultSettings() };
    const data = JSON.parse(raw);
    const p = { ...defaultPersistent(), ...(data.persistent ?? {}) };
    p.upgrades = { ...defaultPersistent().upgrades, ...(data.persistent?.upgrades ?? {}) };
    const s = { ...defaultSettings(), ...(data.settings ?? {}) };
    return { persistent: p, settings: s };
  } catch {
    return { persistent: defaultPersistent(), settings: defaultSettings() };
  }
}

export function writeSave(persistent: PersistentState, settings: SettingsState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ persistent, settings }));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
