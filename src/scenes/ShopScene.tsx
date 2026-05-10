import { GlassPanel } from '../ui/GlassPanel';
import { GlassButton } from '../ui/GlassButton';
import { useGameStore } from '../state/gameStore';
import { SHOP_UPGRADES } from '../data/shop';
import type { PersistentUpgrades } from '../types';
import './shop.css';

export function ShopScene() {
  const continueAfterShop = useGameStore((s) => s.continueAfterShop);
  const run = useGameStore((s) => s.run);
  const cash = useGameStore((s) => s.run.cash);
  const upgrades = useGameStore((s) => s.run.upgrades);
  const spendRunCash = useGameStore((s) => s.spendRunCash);
  const buyRunUpgrade = useGameStore((s) => s.buyRunUpgrade);
  const buyPotion = useGameStore((s) => s.buyPotion);
  const pendingPotions = useGameStore((s) => s.run.pendingPotions);
  const POTION_COST = 60;

  function nextLabel(): string {
    if (run.mode !== 'infinite') {
      return run.raid >= run.totalRaids ? 'Face the Boss' : `Continue to Raid ${run.raid}`;
    }
    return `Continue to Round ${(run.endlessRound ?? 0) + 1}`;
  }

  return (
    <div className="scene shop-scene">
      <div className="shop-aura" />
      <div className="shop-header">
        <h2 className="display shop-heading">The Shop</h2>
        <p className="subtitle shop-sub">Spend what you've earned. Death will take it eventually.</p>
        <div className="shop-cash">
          <span className="shop-cash-icon">$</span>
          <span className="shop-cash-num">{cash}</span>
        </div>
      </div>

      <div className="shop-grid">
        <GlassPanel padding="md" className="shop-item">
          <div className="shop-item-name">Healing Draught</div>
          <div className="shop-item-desc">
            Stack +60 max HP for the next raid only{pendingPotions > 0 ? ` (${pendingPotions} stacked)` : ''}.
          </div>
          <div className="shop-item-row">
            <span className="shop-item-level">{pendingPotions > 0 ? `${pendingPotions} ready` : 'Single use'}</span>
            <button
              className={`shop-buy ${cash < POTION_COST ? 'shop-buy--locked' : ''}`}
              disabled={cash < POTION_COST}
              onClick={() => buyPotion(POTION_COST)}
            >
              $ {POTION_COST}
            </button>
          </div>
        </GlassPanel>
        {SHOP_UPGRADES.map((u) => {
          const lvl = upgrades[u.id as keyof PersistentUpgrades] ?? 0;
          const cost = Math.round(u.cost * Math.pow(u.costMult, lvl));
          const canAfford = cash >= cost;
          return (
            <GlassPanel key={u.id} padding="md" className="shop-item">
              <div className="shop-item-name">{u.name}</div>
              <div className="shop-item-desc">{u.desc}</div>
              <div className="shop-item-row">
                <span className="shop-item-level">Lv {lvl}</span>
                <button
                  className={`shop-buy ${!canAfford ? 'shop-buy--locked' : ''}`}
                  disabled={!canAfford}
                  onClick={() => {
                    if (spendRunCash(cost)) {
                      buyRunUpgrade(u.id as keyof PersistentUpgrades);
                    }
                  }}
                >
                  $ {cost}
                </button>
              </div>
            </GlassPanel>
          );
        })}
      </div>

      <div className="shop-actions">
        <GlassButton variant="gold" size="lg" glow onClick={continueAfterShop}>
          {nextLabel()}
        </GlassButton>
      </div>
    </div>
  );
}
