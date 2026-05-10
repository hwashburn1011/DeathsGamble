import { useEffect, useState } from 'react';
import { GlassButton } from '../ui/GlassButton';
import { StatsModal } from '../ui/StatsModal';
import { useGameStore } from '../state/gameStore';
import { shouldShowIntro } from './IntroScene';
import './title.css';

const TOUCH_NOTICE_KEY = 'dg_touch_notice_dismissed';

function isTouchOnlyDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  // Pointer-coarse means primary input is touch (no mouse). Avoids false-positives
  // on touch laptops with a trackpad.
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return hasTouch && coarse;
}

export function TitleScene() {
  const startNewRun = useGameStore((s) => s.startNewRun);
  const showScene = useGameStore((s) => s.showScene);
  const [showTouchNotice, setShowTouchNotice] = useState(false);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (isTouchOnlyDevice() && !localStorage.getItem(TOUCH_NOTICE_KEY)) {
      setShowTouchNotice(true);
    }
  }, []);

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
          <GlassButton
            size="lg"
            variant="gold"
            onClick={() => {
              // First-time players see the intro cards before mode select.
              if (shouldShowIntro()) showScene('intro');
              else startNewRun();
            }}
          >
            Start Game
          </GlassButton>
          <GlassButton size="md" variant="ghost" onClick={() => setShowStats(true)}>
            Stats
          </GlassButton>
          <GlassButton size="md" variant="ghost" onClick={() => showScene('credits')}>
            Credits
          </GlassButton>
        </div>
      </div>
      <div className="title-version">v0.6 · React + PixiJS migration in progress</div>

      {showStats && <StatsModal onClose={() => setShowStats(false)} />}

      {showTouchNotice && (
        <div className="touch-notice-backdrop">
          <div className="touch-notice-card">
            <h3 className="display touch-notice-title">Best on Desktop</h3>
            <p className="touch-notice-body">
              The dungeon uses keyboard movement (WASD or arrow keys) and isn't
              playable on touch devices yet. Menus, wheels, and the shop work
              fine — the combat won't.
            </p>
            <p className="touch-notice-body">
              For the full experience, please play on a desktop or laptop.
            </p>
            <GlassButton
              size="md"
              variant="gold"
              onClick={() => {
                localStorage.setItem(TOUCH_NOTICE_KEY, '1');
                setShowTouchNotice(false);
              }}
            >
              I Understand
            </GlassButton>
          </div>
        </div>
      )}
    </div>
  );
}
