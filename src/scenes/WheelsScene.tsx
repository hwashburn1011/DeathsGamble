import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { GlassPanel } from '../ui/GlassPanel';
import { GlassButton } from '../ui/GlassButton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useGameStore } from '../state/gameStore';
import { useSettingsStore } from '../state/settingsStore';
import { WheelsGame } from '../engine/wheels/WheelsGame';
import { BUFF_SEGMENTS, CURSE_SEGMENTS, formatGiftLabel, formatTollLabel } from '../data/wheels';
import { SPELLS_BY_ID } from '../data/spells';
import { AudioManager } from '../engine/audio/AudioManager';
import type { PlayerStats } from '../types';
import './wheels.css';

interface SpinResult {
  side: 'buff' | 'curse';
  label: string;
  magnitude: number;
}

const X = '×'; // multiplication sign for "x N.N" magnitude indicator

function formatResultLabel(r: SpinResult): string {
  if (r.label === 'JACKPOT') {
    const m = r.magnitude;
    const dmg = Math.round(10 * m);
    const hp = Math.round(25 * m);
    const atkspd = (0.3 * m).toFixed(1);
    return `JACKPOT  +${dmg} DMG  +${hp} HP  +${atkspd} ATK`;
  }
  // Apply thematic prefix per side, then add the magnitude multiplier suffix.
  const themed = r.side === 'buff' ? formatGiftLabel(r.label) : formatTollLabel(r.label);
  return r.magnitude !== 1 ? `${themed}  ${X}${r.magnitude.toFixed(1)}` : themed;
}

export function WheelsScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelsRef = useRef<WheelsGame | null>(null);

  const run = useGameStore((s) => s.run);
  const stats = useGameStore((s) => s.stats);
  const showScene = useGameStore((s) => s.showScene);
  const applyWheelSegment = useGameStore((s) => s.applyWheelSegment);
  const renderQuality = useSettingsStore((s) => s.renderQuality);
  const wheelMode = useSettingsStore((s) => s.wheelMode);

  const [buffResult, setBuffResult] = useState<SpinResult | null>(null);
  const [curseResult, setCurseResult] = useState<SpinResult | null>(null);
  const [spinningSide, setSpinningSide] = useState<'buff' | 'curse' | null>(null);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [jackpotFlash, setJackpotFlash] = useState(false);

  // Mount Pixi app + WheelsGame
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let app: Application | null = null;
    let game: WheelsGame | null = null;
    let cancelled = false;

    (async () => {
      const dpr = window.devicePixelRatio || 1;
      const qualityCap = renderQuality === 'low' ? 1 : renderQuality === 'medium' ? 1.5 : 4;
      app = new Application();
      await app.init({
        background: 0x07070a,
        resizeTo: window,
        antialias: true,
        resolution: Math.min(dpr, qualityCap),
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy(true);
        return;
      }
      app.canvas.setAttribute('role', 'img');
      app.canvas.setAttribute(
        'aria-label',
        'Two spinning wheels operated by Death — a green Boon wheel on the left and a red Curse wheel on the right. Use the Spin buttons below each wheel.'
      );
      container.appendChild(app.canvas);

      const wheelMode = useSettingsStore.getState().wheelMode;
      game = new WheelsGame(app, BUFF_SEGMENTS, CURSE_SEGMENTS, {
        mode: wheelMode,
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
          // JACKPOT celebration — gold screen flash + chime sting.
          if (seg.label === 'JACKPOT') {
            setJackpotFlash(true);
            AudioManager.play('level_up', { volume: 1, pitch: 1.2 });
            setTimeout(() => setJackpotFlash(false), 1400);
          }
        },
      });
      await game.start();
      if (cancelled) {
        game.destroy();
        return;
      }
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
  }, [applyWheelSegment, renderQuality, wheelMode]);

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

      {jackpotFlash && (
        <div className="wheels-jackpot-flash">
          <div className="wheels-jackpot-banner">JACKPOT</div>
        </div>
      )}

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
          <span className="lbl">{run.mode !== 'infinite' ? 'Raid' : 'Round'}</span>
          <span className="val">
            {run.mode !== 'infinite'
              ? `${run.raid} of ${run.totalRaids}`
              : `${(run.endlessRound ?? 0) + 1}`}
          </span>
        </div>
      </GlassPanel>

      {/* Top-right: Stats preview */}
      {stats && (
        <GlassPanel padding="md" className="wheels-stats" variant="mid">
          <h3 className="wheels-h3">Stats</h3>
          <StatRow icon="♥" iconColor="var(--blood-bright)" label="HP" value={Math.round(stats.hp)} />
          <StatRow icon="⚔" iconColor="var(--gold)" label="DMG" value={Math.round(stats.dmg + (run.weapon?.dmg ?? 0))} />
          <StatRow icon="🛡" iconColor="var(--moss-bright)" label="DEF" value={stats.def} />
          <StatRow icon="👟" iconColor="var(--ink)" label="SPD" value={stats.spd.toFixed(1)} />
          <StatRow icon="⚡" iconColor="var(--candle)" label="ATK SPD" value={(stats.atkspd * stats.atkspdMult).toFixed(1)} />
          <StatRow icon="🎯" iconColor="var(--arcane-bright)" label="RANGE" value={Math.round(stats.range + stats.rangeBonus)} />
          <StatRow icon="✦" iconColor="var(--candle)" label="CRIT" value={`${Math.round(stats.crit * 100)}%`} />
          <StatRow icon="☘" iconColor="var(--gold-bright)" label="LUCK" value={stats.luck.toFixed(1)} highlight />
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
        <div
          className={`wheel-result wheel-result--good ${buffResult ? 'shown' : ''} ${
            buffResult?.label === 'JACKPOT' ? 'wheel-result--jackpot' : ''
          }`}
        >
          {buffResult ? formatResultLabel(buffResult) : ' '}
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
          {curseResult ? formatResultLabel(curseResult) : ' '}
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
        <GlassButton variant="ghost" size="sm" onClick={() => setConfirmForfeit(true)}>
          Forfeit
        </GlassButton>
      </div>

      {confirmForfeit && (
        <ConfirmDialog
          title="Forfeit this run?"
          body="You'll lose all progress, cash, and upgrades from this run. Death keeps the wager."
          confirmLabel="Forfeit"
          cancelLabel="Stay"
          variant="danger"
          onConfirm={() => {
            setConfirmForfeit(false);
            showScene('title');
          }}
          onCancel={() => setConfirmForfeit(false)}
        />
      )}
    </div>
  );
}

interface StatRowProps {
  icon?: string;
  iconColor?: string;
  label: string;
  value: string | number;
  highlight?: boolean;
}

function StatRow({ icon, iconColor, label, value, highlight = false }: StatRowProps) {
  return (
    <div className="wheels-stat-row">
      <span className="lbl">
        {icon && (
          <span className="wheels-stat-icon" style={{ color: iconColor ?? 'var(--ink)' }}>
            {icon}
          </span>
        )}
        {label}
      </span>
      <span className={`val ${highlight ? 'val--gold' : ''}`}>{value}</span>
    </div>
  );
}

// Re-export to ensure the type is reachable if external code imports it
export type { PlayerStats };
