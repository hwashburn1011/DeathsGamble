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
  timeRemaining: number;
  bossHp: number | null;
  bossHpMax: number | null;
}

export function DungeonScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const run = useGameStore((s) => s.run);
  const stats = useGameStore((s) => s.stats);
  const showScene = useGameStore((s) => s.showScene);
  const addCashEarned = useGameStore((s) => s.addCashEarned);
  const addKills = useGameStore((s) => s.addKills);
  const isBossRaidFn = useGameStore((s) => s.isBossRaid);
  const nextRound = useGameStore((s) => s.nextRound);
  const triggerWin = useGameStore((s) => s.triggerWin);
  const isBossRaid = isBossRaidFn();

  const [hud, setHud] = useState<HudStats>({
    hp: stats?.hp ?? run.build?.baseHp ?? 100,
    hpMax: stats?.hpMax ?? run.build?.baseHp ?? 100,
    level: 1,
    xp: 0,
    xpNext: 8,
    kills: 0,
    cashThisRun: 0,
    time: 0,
    timeRemaining: 60,
    bossHp: null,
    bossHpMax: null,
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
          isBossRaid,
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
          onRoundComplete: (gs) => {
            if (cancelled) return;
            addCashEarned(gs.cash);
            addKills(gs.kills);
            nextRound();
          },
          onBossDefeated: (gs) => {
            if (cancelled) return;
            addCashEarned(gs.cash);
            addKills(gs.kills);
            triggerWin();
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
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [run.build, run.weapon, run.raid, run.endlessRound, stats, isBossRaid, addCashEarned, addKills, showScene, nextRound, triggerWin]);

  const hpPct = Math.max(0, hud.hp / hud.hpMax) * 100;
  const xpPct = (hud.xp / hud.xpNext) * 100;
  const bossPct =
    hud.bossHp != null && hud.bossHpMax != null
      ? Math.max(0, (hud.bossHp / hud.bossHpMax) * 100)
      : 0;
  const timeUrgent = hud.timeRemaining > 0 && hud.timeRemaining <= 10;

  return (
    <div className="dungeon-scene">
      <div ref={containerRef} className="dungeon-canvas-wrap" />

      {loading && !loadError && (
        <div className="dungeon-loading">
          <span className="display">
            {isBossRaid ? 'Death approaches…' : 'Death is preparing…'}
          </span>
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
        <span className="info-pair">
          <span className="info-l">{run.mode === 'story' ? 'RAID' : 'ROUND'}</span>
          <span className="info-v">
            {run.mode === 'story'
              ? isBossRaid
                ? 'Boss'
                : `${run.raid} / ${run.totalRaids - 1}`
              : `${(run.endlessRound ?? 0) + 1}`}
          </span>
        </span>
        <span className="info-pair"><span className="info-l">$</span><span className="info-v">{hud.cashThisRun}</span></span>
      </div>

      {/* Round timer (hidden during boss raids) */}
      {!isBossRaid && hud.timeRemaining >= 0 && (
        <div className={`dungeon-timer ${timeUrgent ? 'dungeon-timer--urgent' : ''}`}>
          <div className="dungeon-timer-bar">
            <div
              className="dungeon-timer-fill"
              style={{ width: `${(hud.timeRemaining / 60) * 100}%` }}
            />
          </div>
          <span className="dungeon-timer-text">
            {Math.floor(hud.timeRemaining / 60)}:
            {String(hud.timeRemaining % 60).padStart(2, '0')}
          </span>
        </div>
      )}

      {/* Boss HP bar */}
      {isBossRaid && hud.bossHp != null && hud.bossHp > 0 && (
        <div className="dungeon-boss-hp">
          <div className="dungeon-boss-name display">Death Itself</div>
          <div className="dungeon-boss-bar">
            <div className="dungeon-boss-fill" style={{ width: `${bossPct}%` }} />
          </div>
        </div>
      )}

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
