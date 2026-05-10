import { useEffect, useState } from 'react';
import { GlassButton } from '../ui/GlassButton';
import { useGameStore } from '../state/gameStore';
import './intro.css';

const INTRO_KEY = 'dg_intro_seen';

const CARDS: Array<{ heading?: string; body: string }> = [
  { heading: "In a place between worlds…", body: "Death plays a game with the souls who refuse to leave." },
  { heading: "Two wheels", body: "One bargains your strength. The other carves it away." },
  { heading: "You drew the cards.", body: "Now spin the wheel. And don't lose." },
];

export function IntroScene() {
  const showScene = useGameStore((s) => s.showScene);
  const [card, setCard] = useState(0);

  function next() {
    if (card < CARDS.length - 1) {
      setCard((c) => c + 1);
    } else {
      finish();
    }
  }

  function finish() {
    localStorage.setItem(INTRO_KEY, '1');
    // Direct to mode select — start the run flow.
    useGameStore.getState().startNewRun();
  }

  // Auto-advance on any keypress; Escape skips entirely.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finish();
      } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card]);

  const c = CARDS[card];
  return (
    <div className="scene intro-scene" onClick={next}>
      <div className="intro-aura" />
      <div className="intro-card" key={card}>
        {c.heading && <h2 className="display intro-heading">{c.heading}</h2>}
        <p className="intro-body">{c.body}</p>
      </div>

      <div className="intro-controls" onClick={(e) => e.stopPropagation()}>
        <span className="intro-progress">
          {Array.from({ length: CARDS.length }).map((_, i) => (
            <span
              key={i}
              className={`intro-dot ${i === card ? 'intro-dot--active' : ''}`}
            />
          ))}
        </span>
        <GlassButton size="sm" variant="ghost" onClick={finish}>
          Skip
        </GlassButton>
        <GlassButton size="sm" variant="gold" onClick={next}>
          {card < CARDS.length - 1 ? 'Next' : 'Begin'}
        </GlassButton>
      </div>
    </div>
  );
}

export function shouldShowIntro(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return !localStorage.getItem(INTRO_KEY);
}
