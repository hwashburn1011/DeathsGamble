import { useEffect } from 'react';
import { useAchievementsStore } from '../state/achievementsStore';
import { AudioManager } from '../engine/audio/AudioManager';
import './achievement-toast.css';

/** Shows the head of the queue for ~3.5s, then advances. */
export function AchievementToast() {
  const queue = useAchievementsStore((s) => s.pendingPopups);
  const consume = useAchievementsStore((s) => s.consumePopup);
  const head = queue[0];

  useEffect(() => {
    if (!head) return;
    AudioManager.play('level_up', { volume: 0.6, pitch: 1.1 });
    const t = setTimeout(consume, 3500);
    return () => clearTimeout(t);
  }, [head, consume]);

  if (!head) return null;
  return (
    <div className="achievement-toast" role="status" aria-live="polite">
      <div className="achievement-badge">★</div>
      <div className="achievement-text">
        <div className="achievement-tag">Achievement Unlocked</div>
        <div className="achievement-name">{head.name}</div>
        <div className="achievement-desc">{head.desc}</div>
      </div>
    </div>
  );
}
