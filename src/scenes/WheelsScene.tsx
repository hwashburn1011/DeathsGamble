import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { GlassPanel } from '../ui/GlassPanel';
import { GlassButton } from '../ui/GlassButton';
import { useGameStore } from '../state/gameStore';
import { WheelsGame } from '../engine/wheels/WheelsGame';
import { BUFF_SEGMENTS, CURSE_SEGMENTS } from '../data/wheels';
import { SPELLS_BY_ID } from '../data/spells';
import type { PlayerStats } from '../types';
import './wheels.css';

interface SpinResult {
  side: 'buff' | 'curse';
  label: string;
  magnitude: number;
}

export function WheelsScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelsRef = useRef<WheelsGame | null>(null);

  const run = useGameStore((s) => s.run);
  const stats = useGameStore((s) => s.stats);
  const showScene = useGameStore((s) => s.showScene);
  const applyWheelSegment = useGameStore((s) => s.applyWheelSegment);

  const [buffResult, setBuffResult] = useState<SpinResult | null>(null);
  const [curseResult, setCurseResult] = useState<SpinResult | null>(null);
  const [spinningSide, setSpinningSide] = useState<'buff' | 'curse' | null>(null);

  // Mount Pixi app + WheelsGame
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let app: Application | null = null;
    let game: WheelsGame | null = null;
    let cancelled = false;

    (async () => {
      app = new Application();
      await app.init({
        background: 0x07070a,
        resizeTo: window,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy(true);
        return;
      }
      container.appendChild(app.canvas);

      game = new WheelsGame(app, BUFF_SEGMENTS, CURSE_SEGMENTS, {
        getLuck: () => useGameStore.getState().stats?.luck ?? 0,
        onSpinComplete: (side, segIdx) => {
          if (cancelled) return;
          const segs = side === 'buff' ? BUFF_SEGMENTS : CURSE_SEGMENTS;
          const seg = segs[segIdx];
          const m = applyWheelSegment(side, seg);
          const result: SpinResult = { side, label: seg.label, magnitude: m };
          if (side === 'buff') setBuffResult(result);
          else setCurseResult(result);
          setSpinningSide(null);
        },
      });
      game.start();
      wheelsRef.current = game;
    })();

    return () => {
      cancelled = true;
      wheelsRef.current = null;
      try {
        game?.destroy();
      } catch {
        /* swallow */
      }
      try {
        app?.destroy(true, { children: true });
      } catch {
        /* swallow */
      }
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [applyWheelSegment]);

  function spin(side: 'buff' | 'curse') {
    const game = wheelsRef.current;
    if (!game) return;
    if (game.isSpinning(side) || game.isSpun(side)) return;
    setSpinningSide(side);
    game.startSpin(side);
  }

  const buffSpun = !!buffResult;
  const curseSpun = !!curseResult;
  const ready = buffSpun && curseSpun;

  return (
    <div className="wheels-scene">
      <div ref={containerRef} className="wheels-canvas-wrap" />

      {/* Top header */}
      <div className="wheels-header">Make Your Bargain</div>

      {/* Top-left: Loadout panel */}
      <GlassPanel padding="md" className="wheels-loadout" variant="mid">
        <h3 className="wheels-h3">Loadout</h3>
        <div className="wheels-load-row">
          <span className="lbl">Build</span>
          <span className="val">{run.build?.name ?? '—'}</span>
        </div>
        <div className="wheels-load-row">
          <span className="lbl">Weapon</span>
          <span className="val">
            {run.weapon ? `${run.weapon.icon} ${run.weapon.name}` : '—'}
          </span>
        </div>
        <div className="wheels-load-row">
          <span className="lbl">Spells</span>
          <span className="val">
            {run.spells.length
              ? run.spells.map((id) => SPELLS_BY_ID[id]?.name ?? id).join(', ')
              : 'None'}
          </span>
        </div>
        <div className="wheels-load-divider" />
        <div className="wheels-load-row">
          <span className="lbl">
            {run.mode === 'story' ? 'Raid' : 'Round'}
          </span>
          <span className="val">
            {run.mode === 'story'
              ? `${run.raid} of ${run.totalRaids}`
              : `${(run.endlessRound ?? 0) + 1}`}
          </span>
        </div>
      </GlassPanel>

      {/* Top-right: Stats preview */}
      {stats && (
        <GlassPanel padding="md" className="wheels-stats" variant="mid">
          <h3 className="wheels-h3">Stats</h3>
          <StatRow label="HP" value={Math.round(stats.hp)} />
          <StatRow label="DMG" value={Math.round(stats.dmg + (run.weapon?.dmg ?? 0))} />
          <StatRow label="DEF" value={stats.def} />
          <StatRow label="SPD" value={stats.spd.toFixed(1)} />
          <StatRow label="ATK SPD" value={(stats.atkspd * stats.atkspdMult).toFixed(1)} />
          <StatRow label="RANGE" value={Math.round(stats.range + stats.rangeBonus)} />
          <StatRow label="CRIT" value={`${Math.round(stats.crit * 100)}%`} />
          <StatRow label="LUCK" value={stats.luck.toFixed(1)} highlight />
        </GlassPanel>
      )}

      {/* Bottom-left wheel button group */}
      <div className="wheel-button-group wheel-button-group--buff">
        <span className="wheel-label wheel-label--buff">Boon</span>
        <GlassButton
          variant="good"
          size="md"
          disabled={buffSpun || spinningSide === 'buff'}
          onClick={() => spin('buff')}
        >
          {spinningSide === 'buff' ? 'Spinning…' : 'Spin'}
        </GlassButton>
        <div className={`wheel-result wheel-result--good ${buffResult ? 'shown' : ''}`}>
          {buffResult
            ? buffResult.magnitude !== 1
              ? `${buffResult.label}  ×${buffResult.magnitude.toFixed(1)}`
              : buffResult.label
            : ' '}
        </div>
      </div>

      {/* Bottom-right wheel button group */}
      <div className="wheel-button-group wheel-button-group--curse">
        <span className="wheel-label wheel-label--curse">Curse</span>
        <GlassButton
          variant="danger"
          size="md"
          disabled={curseSpun || spinningSide === 'curse'}
          onClick={() => spin('curse')}
        >
          {spinningSide === 'curse' ? 'Spinning…' : 'Spin'}
        </GlassButton>
        <div className={`wheel-result wheel-result--bad ${curseResult ? 'shown' : ''}`}>
          {curseResult
            ? curseResult.magnitude !== 1
              ? `${curseResult.label}  ×${curseResult.magnitude.toFixed(1)}`
              : curseResult.label
            : ' '}
        </div>
      </div>

      {/* Enter Dungeon */}
      <div className="wheels-enter">
        <GlassButton
          variant="gold"
          size="lg"
          glow={ready}
          disabled={!ready}
          onClick={() => showScene('dungeon')}
        >
          Enter Dungeon
        </GlassButton>
      </div>

      {/* Title-screen escape */}
      <div className="wheels-back">
        <GlassButton variant="ghost" size="sm" onClick={() => showScene('title')}>
          Forfeit
        </GlassButton>
      </div>
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

function StatRow({ label, value, highlight = false }: StatRowProps) {
  return (
    <div className="wheels-stat-row">
      <span className="lbl">{label}</span>
      <span className={`val ${highlight ? 'val--gold' : ''}`}>{value}</span>
    </div>
  );
}

// Re-export to ensure the type is reachable if external code imports it
export type { PlayerStats };
