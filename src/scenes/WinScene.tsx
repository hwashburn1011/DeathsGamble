import { GlassPanel } from '../ui/GlassPanel';
import { GlassButton } from '../ui/GlassButton';
import { useGameStore } from '../state/gameStore';
import './win.css';

const VICTORY_LINES = [
  'For a moment. Death never forgets a debt.',
  "He's amused. That should worry you.",
  'You bought yourself another day. They cost more each time.',
  'The reaper steps back. Not far.',
];

export function WinScene() {
  const startNewRun = useGameStore((s) => s.startNewRun);
  const showScene = useGameStore((s) => s.showScene);
  const run = useGameStore((s) => s.run);
  const line = VICTORY_LINES[Math.floor(Math.random() * VICTORY_LINES.length)];

  return (
    <div className="scene win-scene">
      <div className="win-aura" />
      <GlassPanel padding="lg" className="win-card">
        <h2 className="display win-heading">You Cheated Death</h2>
        <p className="win-line">{line}</p>

        <div className="win-stats">
          <Stat label="Build" value={run.build?.name ?? '—'} />
          <Stat label="Kills" value={String(run.killsTotal)} />
          <Stat label="Earned" value={`$${run.cashEarned}`} />
          <Stat label="Raids" value={`${run.totalRaids}`} />
        </div>

        <div className="win-actions">
          <GlassButton variant="gold" size="lg" onClick={startNewRun} glow>
            Gamble Again
          </GlassButton>
          <GlassButton variant="ghost" size="md" onClick={() => showScene('title')}>
            Title Screen
          </GlassButton>
        </div>
      </GlassPanel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="win-stat">
      <span className="win-stat-label">{label}</span>
      <span className="win-stat-value">{value}</span>
    </div>
  );
}
