import { useState } from 'react';
import { GlassButton } from './GlassButton';
import { useSoulsStore } from '../state/soulsStore';
import { UNLOCKS, SOULS_AWARD } from '../data/unlocks';
import './unlocks-modal.css';

interface Props {
  onClose: () => void;
}

/**
 * Souls / Unlocks modal (#171). Lists every locked item with cost + state.
 * Buttons enable when the player has enough souls; clicking deducts and
 * marks the unlock as owned. Persists via the souls store.
 */
export function UnlocksModal({ onClose }: Props) {
  const souls = useSoulsStore((s) => s.souls);
  const purchased = useSoulsStore((s) => s.unlocked);
  const unlock = useSoulsStore((s) => s.unlock);
  const [recent, setRecent] = useState<string | null>(null);

  function tryUnlock(id: string) {
    if (unlock(id)) {
      setRecent(id);
      setTimeout(() => setRecent(null), 1200);
    }
  }

  return (
    <div className="unlocks-modal-backdrop" onClick={onClose}>
      <div className="unlocks-modal" onClick={(e) => e.stopPropagation()}>
        <div className="unlocks-header">
          <h2 className="display unlocks-title">Souls &amp; Unlocks</h2>
          <div className="unlocks-balance">
            <span className="unlocks-balance-num">{souls}</span>
            <span className="unlocks-balance-label">souls</span>
          </div>
        </div>

        <p className="unlocks-tagline">
          Souls are earned every run — surviving, clearing rooms, killing,
          and finally beating Death itself. Spend them on permanent unlocks.
        </p>

        <div className="unlocks-grid">
          {UNLOCKS.map((u) => {
            const owned = purchased.includes(u.id);
            const canAfford = souls >= u.cost;
            const justUnlocked = recent === u.id;
            return (
              <div
                key={u.id}
                className={`unlock-row ${owned ? 'unlock-row--owned' : ''} ${justUnlocked ? 'unlock-row--flash' : ''}`}
              >
                <div className="unlock-info">
                  <div className="unlock-name">{u.name}</div>
                  <div className="unlock-desc">{u.desc}</div>
                </div>
                {owned ? (
                  <div className="unlock-owned">Unlocked ✓</div>
                ) : (
                  <button
                    type="button"
                    className="unlock-buy"
                    disabled={!canAfford}
                    onClick={() => tryUnlock(u.id)}
                  >
                    {u.cost} souls
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="unlocks-howto">
          <h4 className="unlocks-howto-h">How souls are earned</h4>
          <ul className="unlocks-howto-list">
            <li>+{SOULS_AWARD.base} just for finishing a run</li>
            <li>+{SOULS_AWARD.perRaid} per raid you cleared</li>
            <li>+1 per {SOULS_AWARD.perKill} kills</li>
            <li>+{SOULS_AWARD.bossWin} for beating Death</li>
          </ul>
        </div>

        <div className="unlocks-actions">
          <GlassButton variant="ghost" size="md" onClick={onClose}>Close</GlassButton>
        </div>
      </div>
    </div>
  );
}
