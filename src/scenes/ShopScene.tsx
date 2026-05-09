import { GlassPanel } from '../ui/GlassPanel';
import { GlassButton } from '../ui/GlassButton';
import { useGameStore } from '../state/gameStore';
import { usePersistentStore } from '../state/persistentStore';
import { SHOP_UPGRADES } from '../data/shop';
import './shop.css';

export function ShopScene() {
  const continueAfterShop = useGameStore((s) => s.continueAfterShop);
  const run = useGameStore((s) => s.run);
  const cash = usePersistentStore((s) => s.cash);
  const upgrades = usePersistentStore((s) => s.upgrades);
  const spendCash = usePersistentStore((s) => s.spendCash);
  const buyUpgrade = usePersistentStore((s) => s.buyUpgrade);

  function nextLabel(): string {
    if (run.mode === 'story') {
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
        {SHOP_UPGRADES.map((u) => {
          const lvl = upgrades[u.id as keyof typeof upgrades] ?? 0;
          const cost = Math.round(u.cost * Math.pow(u.costMult, lvl));
          const maxed = lvl >= u.max;
          const canAfford = cash >= cost;
          return (
            <GlassPanel key={u.id} padding="md" className="shop-item">
              <div className="shop-item-name">{u.name}</div>
              <div className="shop-item-desc">{u.desc}</div>
              <div className="shop-item-row">
                <span className="shop-item-level">
                  Lv {lvl} / {u.max}
                </span>
                <button
                  className={`shop-buy ${maxed ? 'shop-buy--maxed' : ''} ${
                    !maxed && !canAfford ? 'shop-buy--locked' : ''
                  }`}
                  disabled={maxed || !canAfford}
                  onClick={() => {
                    if (maxed) return;
                    if (spendCash(cost)) {
                      buyUpgrade(u.id as keyof typeof upgrades);
                    }
                  }}
                >
                  {maxed ? 'MAX' : `$ ${cost}`}
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
