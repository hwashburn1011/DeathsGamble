import { GlassPanel } from '../ui/GlassPanel';
import { GlassButton } from '../ui/GlassButton';
import { useGameStore } from '../state/gameStore';
import './gameover.css';

const EPITAPHS = [
  'Death always collects.',
  'A poor wager.',
  'The wheel turns; the reaper waits.',
  'You should have spun differently.',
  'The dungeon swallowed you whole.',
];

export function GameoverScene() {
  const startNewRun = useGameStore((s) => s.startNewRun);
  const showScene = useGameStore((s) => s.showScene);
  const run = useGameStore((s) => s.run);

  // Pick once per render — stable until scene changes
  const epitaph = EPITAPHS[Math.floor(Math.random() * EPITAPHS.length)];

  return (
    <div className="scene gameover-scene">
      <GlassPanel padding="lg" className="gameover-card">
        <h2 className="display gameover-heading">You Lost the Bet</h2>
        <p className="gameover-epitaph">{epitaph}</p>

        <div className="gameover-stats">
          <Stat label="Build" value={run.build?.name ?? '—'} />
          <Stat label="Kills" value={String(run.killsTotal)} />
          <Stat label="Earned" value={`$${run.cashEarned}`} />
        </div>

        <div className="gameover-actions">
          <GlassButton variant="gold" size="lg" onClick={startNewRun}>
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
    <div className="gameover-stat">
      <span className="gameover-stat-label">{label}</span>
      <span className="gameover-stat-value">{value}</span>
    </div>
  );
}
