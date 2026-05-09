import { GlassButton } from '../ui/GlassButton';
import { useGameStore } from '../state/gameStore';
import './title.css';

export function TitleScene() {
  const startNewRun = useGameStore((s) => s.startNewRun);
  const showScene = useGameStore((s) => s.showScene);

  return (
    <div className="scene title-scene">
      <div className="title-aura" />
      <div className="title-stack">
        <h1 className="title-display">
          <span className="title-deaths">Death's</span>
          <span className="title-gamble">Gamble</span>
        </h1>
        <p className="title-subtitle">Spin both wheels. Survive the dungeon.</p>
        <div className="title-actions">
          <GlassButton size="lg" variant="gold" onClick={startNewRun}>
            Start Game
          </GlassButton>
          <GlassButton size="md" variant="ghost" onClick={() => showScene('credits')}>
            Credits
          </GlassButton>
        </div>
      </div>
      <div className="title-version">v0.6 · React + PixiJS migration in progress</div>
    </div>
  );
}
