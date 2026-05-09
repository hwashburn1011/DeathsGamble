import { useEffect, useState } from 'react';
import { useGameStore } from './state/gameStore';
import { useSettingsStore } from './state/settingsStore';
import { AudioManager } from './engine/audio/AudioManager';
import { MUSIC_BY_SCENE, BOSS_MUSIC } from './engine/audio/musicMap';
import { TitleScene } from './scenes/TitleScene';
import { ModeSelectScene } from './scenes/ModeSelectScene';
import { BuildPickerScene } from './scenes/BuildPickerScene';
import { WheelsScene } from './scenes/WheelsScene';
import { DungeonScene } from './scenes/DungeonScene';
import { GameoverScene } from './scenes/GameoverScene';
import { WinScene } from './scenes/WinScene';
import { ShopScene } from './scenes/ShopScene';
import { CreditsScene } from './scenes/CreditsScene';
import { SettingsButton } from './ui/SettingsButton';
import type { SceneName } from './types';
import './app.css';

const SCENES: Record<SceneName, () => JSX.Element> = {
  title: TitleScene,
  modeselect: ModeSelectScene,
  buildpicker: BuildPickerScene,
  wheels: WheelsScene,
  dungeon: DungeonScene,
  shop: ShopScene,
  gameover: GameoverScene,
  win: WinScene,
  credits: CreditsScene,
};

// Per-(from→to) transition durations (ms). Falls back to default.
const TRANSITION_DEFAULT_MS = 280;
const TRANSITION_LONG_MS = 600;
function transitionFor(from: SceneName, to: SceneName): number {
  // Slower transition into combat / dungeon and on death/win
  if (to === 'dungeon')  return TRANSITION_LONG_MS;
  if (to === 'gameover') return TRANSITION_LONG_MS;
  if (to === 'win')      return TRANSITION_LONG_MS;
  if (from === 'dungeon') return TRANSITION_LONG_MS;
  return TRANSITION_DEFAULT_MS;
}

export function App() {
  const target = useGameStore((s) => s.scene);
  const isBossRaid = useGameStore((s) => s.isBossRaid)();
  const brightness = useSettingsStore((s) => s.brightness);
  const motion = useSettingsStore((s) => s.motionIntensity);
  const [active, setActive] = useState<SceneName>(target);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [transitionMs, setTransitionMs] = useState(TRANSITION_DEFAULT_MS);

  const volumeMaster = useSettingsStore((s) => s.volumeMaster);
  const volumeSfx = useSettingsStore((s) => s.volumeSfx);
  const volumeMusic = useSettingsStore((s) => s.volumeMusic);

  // Apply brightness as CSS var on root
  useEffect(() => {
    document.documentElement.style.setProperty('--brightness', String(brightness));
  }, [brightness]);

  // Push audio volumes to manager on boot + whenever they change
  useEffect(() => {
    AudioManager.setVolumes(volumeMaster, volumeSfx, volumeMusic);
  }, [volumeMaster, volumeSfx, volumeMusic]);

  // Switch background music whenever the visible scene changes.
  // Use `active` (the post-transition scene), not `target`, so the
  // crossfade aligns with the visual fade.
  useEffect(() => {
    const url =
      active === 'dungeon' && isBossRaid ? BOSS_MUSIC : MUSIC_BY_SCENE[active] ?? null;
    AudioManager.playMusic(url);
  }, [active, isBossRaid]);

  // Drive crossfade: when target diverges from active, start an out-fade,
  // swap, then fade back in. Skip the fade entirely on motion=off so
  // accessibility users get instant scene swaps.
  useEffect(() => {
    if (target === active) return;
    if (motion === 'off') {
      setActive(target);
      return;
    }
    const dur = transitionFor(active, target);
    setTransitionMs(dur);
    setPhase('out');
    const t = setTimeout(() => {
      setActive(target);
      setPhase('in');
    }, dur / 2);
    return () => clearTimeout(t);
  }, [target, active, motion]);

  const Scene = SCENES[active] ?? TitleScene;

  return (
    <>
      <div className="atmosphere" />
      <div
        className={`scene-transition scene-transition--${phase}`}
        style={{ transitionDuration: `${Math.max(50, transitionMs / 2)}ms` }}
      >
        <Scene />
      </div>
      <SettingsButton />
    </>
  );
}
