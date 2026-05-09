import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { GlassPanel } from '../ui/GlassPanel';
import { useGameStore } from '../state/gameStore';
import { DungeonGame } from '../engine/dungeon/DungeonGame';
import './dungeon.css';

interface HudStats {
  hp: number;
  hpMax: number;
  level: number;
  xp: number;
  xpNext: number;
  kills: number;
  cashThisRun: number;
  time: number;
}

export function DungeonScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const run = useGameStore((s) => s.run);
  const stats = useGameStore((s) => s.stats);
  const showScene = useGameStore((s) => s.showScene);
  const addCashEarned = useGameStore((s) => s.addCashEarned);
  const addKills = useGameStore((s) => s.addKills);
  const [hud, setHud] = useState<HudStats>({
    hp: stats?.hp ?? run.build?.baseHp ?? 100,
    hpMax: stats?.hpMax ?? run.build?.baseHp ?? 100,
    level: 1,
    xp: 0,
    xpNext: 8,
    kills: 0,
    cashThisRun: 0,
    time: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !run.build || !run.weapon || !stats) return;

    let game: DungeonGame | null = null;
    let app: Application | null = null;
    let cancelled = false;

    (async () => {
      try {
        app = new Application();
        await app.init({
          background: 0x060609,
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

        game = new DungeonGame(app, {
          build: run.build!,
          weapon: run.weapon!,
          stats: stats!,
          onStatsChange: (s) => {
            if (cancelled) return;
            setHud(s);
          },
          onGameOver: (gs) => {
            if (cancelled) return;
            addCashEarned(gs.cash);
            addKills(gs.kills);
            showScene('gameover');
          },
        });
        await game.start();
        if (cancelled) {
          game.destroy();
          app.destroy(true);
          return;
        }
        setLoading(false);
      } catch (err) {
        console.error('Dungeon init failed', err);
        setLoadError(String(err));
      }
    })();

    return () => {
      cancelled = true;
      game?.destroy();
      try {
        app?.destroy(true, { children: true });
      } catch {
        /* swallow */
      }
      // Clear container in case canvas didn't get removed
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [run.build, run.weapon, stats, addCashEarned, addKills, showScene]);

  const hpPct = Math.max(0, hud.hp / hud.hpMax) * 100;
  const xpPct = (hud.xp / hud.xpNext) * 100;

  return (
    <div className="dungeon-scene">
      <div ref={containerRef} className="dungeon-canvas-wrap" />

      {loading && !loadError && (
        <div className="dungeon-loading">
          <span className="display">Death is preparing…</span>
        </div>
      )}

      {loadError && (
        <div className="dungeon-loading">
          <GlassPanel padding="lg" className="dungeon-error">
            <h3>Failed to load assets</h3>
            <p>{loadError}</p>
          </GlassPanel>
        </div>
      )}

      <div className="dungeon-info">
        <span className="info-pair"><span className="info-l">TIME</span><span className="info-v">{hud.time}s</span></span>
        <span className="info-pair"><span className="info-l">KILLS</span><span className="info-v">{hud.kills}</span></span>
        <span className="info-pair"><span className="info-l">LVL</span><span className="info-v">{hud.level}</span></span>
        <span className="info-pair"><span className="info-l">$</span><span className="info-v">{hud.cashThisRun}</span></span>
      </div>

      <GlassPanel padding="md" className="dungeon-hud" variant="mid">
        <h3 className="hud-title">Stats</h3>
        <div className="hud-bar hud-bar--hp">
          <div className="hud-bar-fill hud-bar-fill--hp" style={{ width: `${hpPct}%` }} />
        </div>
        <div className="hud-row"><span>HP</span><span>{Math.max(0, Math.ceil(hud.hp))} / {hud.hpMax}</span></div>
        {run.weapon && (
          <>
            <div className="hud-row"><span>WPN</span><span style={{ color: 'var(--gold-bright)' }}>{run.weapon.icon} {run.weapon.name}</span></div>
            <div className="hud-row"><span>DMG</span><span>{run.weapon.dmg}</span></div>
            <div className="hud-row"><span>ATK SPD</span><span>{run.weapon.atkspd.toFixed(1)}</span></div>
            <div className="hud-row"><span>RANGE</span><span>{run.weapon.range}</span></div>
          </>
        )}
        <div className="hud-bar hud-bar--xp">
          <div className="hud-bar-fill hud-bar-fill--xp" style={{ width: `${xpPct}%` }} />
        </div>
      </GlassPanel>

      <div className="dungeon-hint">WASD / Arrow keys — auto-attacks fire</div>
    </div>
  );
}
