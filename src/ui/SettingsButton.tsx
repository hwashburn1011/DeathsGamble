import { useEffect, useState } from 'react';
import { SettingsModal } from './SettingsModal';
import { useGameStore } from '../state/gameStore';
import './settings-button.css';

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const setPaused = useGameStore((s) => s.setPaused);
  const scene = useGameStore((s) => s.scene);

  // Whenever the modal opens/closes during gameplay, flip the game-store
  // pause flag. DungeonScene watches this and forwards it to DungeonGame.
  useEffect(() => {
    if (scene === 'dungeon') setPaused(open);
    return () => {
      if (scene === 'dungeon') setPaused(false);
    };
  }, [open, scene, setPaused]);

  return (
    <>
      <button
        className="settings-btn"
        title="Settings"
        aria-label="Open settings"
        onClick={() => setOpen(true)}
      >
        ⚙
      </button>
      {open && <SettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}
