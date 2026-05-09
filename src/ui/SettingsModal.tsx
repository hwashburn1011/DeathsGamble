import { useEffect } from 'react';
import { GlassPanel } from './GlassPanel';
import { GlassButton } from './GlassButton';
import { useSettingsStore } from '../state/settingsStore';
import type { Difficulty, SettingsState, WheelMode } from '../types';
import './settings-modal.css';

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const settings = useSettingsStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Apply brightness as CSS var on root
  useEffect(() => {
    document.documentElement.style.setProperty('--brightness', String(settings.brightness));
  }, [settings.brightness]);

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-card-wrap" onClick={(e) => e.stopPropagation()}>
        <GlassPanel className="settings-card" padding="lg">
          <h2 className="display settings-title">Settings</h2>

          <div className="settings-row">
            <span className="settings-label">Brightness</span>
            <div className="settings-control">
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={settings.brightness}
                onChange={(e) => settings.set('brightness', Number(e.target.value))}
              />
              <span className="settings-val">{Math.round(settings.brightness * 100)}%</span>
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">Difficulty</span>
            <Segmented<Difficulty>
              value={settings.difficulty}
              options={[
                { value: 'easy', label: 'Easy' },
                { value: 'normal', label: 'Normal' },
                { value: 'hard', label: 'Hard' },
              ]}
              onChange={(v) => settings.set('difficulty', v)}
            />
          </div>

          <div className="settings-row">
            <span className="settings-label">Wheel Style</span>
            <Segmented<WheelMode>
              value={settings.wheelMode}
              options={[
                { value: 'wheel', label: 'Wheel' },
                { value: 'slot', label: 'Slot' },
              ]}
              onChange={(v) => settings.set('wheelMode', v)}
            />
          </div>

          <div className="settings-row">
            <span className="settings-label">Blood / Gore</span>
            <Toggle on={settings.blood} onClick={() => settings.set('blood', !settings.blood)} />
          </div>

          <div className="settings-row">
            <span className="settings-label">Motion</span>
            <Segmented<SettingsState['motionIntensity']>
              value={settings.motionIntensity}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'low', label: 'Low' },
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High' },
              ]}
              onChange={(v) => settings.set('motionIntensity', v)}
            />
          </div>

          <div className="settings-actions">
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm('Reset all save data (cash, upgrades)?')) settings.resetSave();
              }}
            >
              Reset Save
            </GlassButton>
            <GlassButton variant="gold" size="sm" onClick={onClose}>
              Close
            </GlassButton>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}

function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          className={`seg-btn ${value === o.value ? 'seg-btn--active' : ''}`}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface ToggleProps {
  on: boolean;
  onClick: () => void;
}

function Toggle({ on, onClick }: ToggleProps) {
  return (
    <button
      type="button"
      className={`toggle ${on ? 'toggle--on' : ''}`}
      onClick={onClick}
      aria-pressed={on}
      aria-label="Toggle"
    >
      <span className="toggle__thumb" />
    </button>
  );
}
