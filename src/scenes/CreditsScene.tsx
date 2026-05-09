import { useMemo } from 'react';
import { GlassPanel } from '../ui/GlassPanel';
import { GlassButton } from '../ui/GlassButton';
import { useGameStore } from '../state/gameStore';
import { CREDITS, CATEGORY_LABEL, type AssetCredit } from '../data/credits';
import './credits.css';

export function CreditsScene() {
  const showScene = useGameStore((s) => s.showScene);

  const grouped = useMemo(() => {
    const m = new Map<AssetCredit['category'], AssetCredit[]>();
    for (const c of CREDITS) {
      if (!m.has(c.category)) m.set(c.category, []);
      m.get(c.category)!.push(c);
    }
    // Sort each group: shipped first, then alpha
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        if (a.shipped !== b.shipped) return a.shipped ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }
    return m;
  }, []);

  // Order in which categories render
  const order: AssetCredit['category'][] = [
    'characters',
    'enemies',
    'tiles',
    'ui',
    'icons',
    'audio',
    'fonts',
    'code',
  ];

  return (
    <div className="scene credits-scene">
      <div className="credits-header">
        <h2 className="display credits-heading">Credits</h2>
        <p className="subtitle credits-sub">
          The dead pay no debts; the living do. These artists, composers, and engineers
          made this game possible.
        </p>
      </div>

      <div className="credits-list">
        {order.map((cat) => {
          const items = grouped.get(cat);
          if (!items || items.length === 0) return null;
          return (
            <GlassPanel key={cat} padding="md" className="credits-group">
              <h3 className="credits-cat-heading">{CATEGORY_LABEL[cat]}</h3>
              <ul className="credits-items">
                {items.map((item) => (
                  <li key={item.name + item.url} className="credits-item">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="credits-link"
                    >
                      <span className="credits-name">{item.name}</span>
                    </a>
                    <span className="credits-author">{item.author}</span>
                    <span className={`credits-lic credits-lic--${item.shipped ? 'on' : 'off'}`}>
                      {item.license}
                    </span>
                    {!item.shipped && <span className="credits-pending">planned</span>}
                  </li>
                ))}
              </ul>
            </GlassPanel>
          );
        })}
      </div>

      <div className="credits-actions">
        <GlassButton variant="ghost" size="md" onClick={() => showScene('title')}>
          Back to Title
        </GlassButton>
      </div>
    </div>
  );
}
