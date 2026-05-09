import { useEffect } from 'react';
import { useGameStore } from './state/gameStore';
import { useSettingsStore } from './state/settingsStore';
import { TitleScene } from './scenes/TitleScene';
import { ModeSelectScene } from './scenes/ModeSelectScene';
import { BuildPickerScene } from './scenes/BuildPickerScene';
import { WheelsScene } from './scenes/WheelsScene';
import { DungeonScene } from './scenes/DungeonScene';
import { GameoverScene } from './scenes/GameoverScene';
import { CreditsScene } from './scenes/CreditsScene';
import { SettingsButton } from './ui/SettingsButton';
import type { SceneName } from './types';

const SCENES: Record<SceneName, () => JSX.Element> = {
  title: TitleScene,
  modeselect: ModeSelectScene,
  buildpicker: BuildPickerScene,
  wheels: WheelsScene,
  dungeon: DungeonScene,
  gameover: GameoverScene,
  credits: CreditsScene,
  // Still placeholders bridging to legacy/v0.5.html
  shop: WheelsScene,
  win: WheelsScene,
};

export function App() {
  const scene = useGameStore((s) => s.scene);
  const brightness = useSettingsStore((s) => s.brightness);

  // Apply brightness as CSS var on root
  useEffect(() => {
    document.documentElement.style.setProperty('--brightness', String(brightness));
  }, [brightness]);

  const Scene = SCENES[scene] ?? TitleScene;

  return (
    <>
      <div className="atmosphere" />
      <Scene />
      <SettingsButton />
    </>
  );
}
