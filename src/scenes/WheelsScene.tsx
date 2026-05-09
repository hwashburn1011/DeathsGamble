import { GlassPanel } from '../ui/GlassPanel';
import { GlassButton } from '../ui/GlassButton';
import { useGameStore } from '../state/gameStore';
import './placeholder.css';

/**
 * v0.6 placeholder — wheels rendering will be ported to PixiJS in a follow-up turn.
 * For now, players can jump to the v0.5 build to keep playing the existing game.
 */
export function WheelsScene() {
  const showScene = useGameStore((s) => s.showScene);
  const run = useGameStore((s) => s.run);

  return (
    <div className="scene placeholder-scene">
      <GlassPanel padding="lg" className="placeholder-card">
        <h2 className="display placeholder-heading">Wheels Scene</h2>
        <p className="placeholder-text">
          You picked <strong>{run.build?.name ?? 'a build'}</strong> in the new architecture.
          The wheels rendering is still being ported to PixiJS — but the new dungeon
          (with real CC0 sprites + glass HUD) is live.
        </p>
        <div className="placeholder-actions">
          <GlassButton variant="gold" size="lg" onClick={() => showScene('dungeon')}>
            Skip to Dungeon (test)
          </GlassButton>
          <a className="placeholder-link" href="legacy/v0.5.html">
            <GlassButton variant="ghost" size="md">Open v0.5</GlassButton>
          </a>
          <GlassButton variant="ghost" size="md" onClick={() => showScene('title')}>
            Back to Title
          </GlassButton>
        </div>
      </GlassPanel>
    </div>
  );
}
