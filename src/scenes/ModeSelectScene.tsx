import { GlassPanel } from '../ui/GlassPanel';
import { GlassButton } from '../ui/GlassButton';
import { useGameStore } from '../state/gameStore';
import { useSettingsStore } from '../state/settingsStore';
import { DIFFICULTY } from '../data/difficulty';
import { dailyLabel } from '../engine/dailySeed';
import './modeselect.css';

export function ModeSelectScene() {
  const selectMode = useGameStore((s) => s.selectMode);
  const showScene = useGameStore((s) => s.showScene);
  const difficulty = useSettingsStore((s) => s.difficulty);
  const storyRaids = DIFFICULTY[difficulty].storyRaids;

  return (
    <div className="scene modeselect-scene">
      <h2 className="display modeselect-heading">Choose Your Path</h2>
      <p className="subtitle modeselect-sub">
        Difficulty: <strong>{difficulty.toUpperCase()}</strong>
      </p>

      <div className="mode-options">
        <GlassPanel
          padding="lg"
          hoverable
          onClick={() => selectMode('story')}
          className="mode-card"
        >
          <div className="mode-emblem mode-emblem--story">☠</div>
          <h3 className="mode-title">Story</h3>
          <p className="mode-desc">
            {storyRaids} raid{storyRaids === 1 ? '' : 's'} against the dead. Survive each, gather
            cash, and face Death himself at the end.
          </p>
        </GlassPanel>

        <GlassPanel
          padding="lg"
          hoverable
          onClick={() => selectMode('infinite')}
          className="mode-card"
        >
          <div className="mode-emblem mode-emblem--infinite">∞</div>
          <h3 className="mode-title">Infinite</h3>
          <p className="mode-desc">
            Endless rounds. Spin again between each — the wheels grow more extreme. No final boss,
            no escape.
          </p>
        </GlassPanel>

        <GlassPanel
          padding="lg"
          hoverable
          onClick={() => selectMode('daily')}
          className="mode-card"
        >
          <div className="mode-emblem mode-emblem--daily">☀</div>
          <h3 className="mode-title">Daily</h3>
          <p className="mode-desc">
            One seed for everyone today. Same builds, same wheel rolls, same enemies.
            Resets at midnight local.
          </p>
          <p className="mode-daily-tag">{dailyLabel()}</p>
        </GlassPanel>
      </div>

      <div className="modeselect-actions">
        <GlassButton variant="ghost" size="sm" onClick={() => showScene('title')}>
          Back
        </GlassButton>
      </div>
    </div>
  );
}
