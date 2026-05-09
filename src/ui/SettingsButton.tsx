import { useState } from 'react';
import { SettingsModal } from './SettingsModal';
import './settings-button.css';

export function SettingsButton() {
  const [open, setOpen] = useState(false);
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
