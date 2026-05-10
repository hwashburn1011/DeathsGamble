import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { GlassPanel } from '../ui/GlassPanel';
import { useGameStore } from '../state/gameStore';
import { useSettingsStore } from '../state/settingsStore';
import { useStatsStore } from '../state/statsStore';
import { DungeonGame } from '../engine/dungeon/DungeonGame';
import { themeFor } from '../engine/pixi/manifest';
import { rollBargainChoices, BARGAINS_BY_ID, type BargainDef } from '../data/bargains';
import { calcSoulsForRun } from '../data/unlocks';
import { useSoulsStore } from '../state/soulsStore';
import { GlassButton } from '../ui/GlassButton';
import './dungeon.css';

// Death dialogue lines (#163) — one per story raid, spoken in Death's voice.
// Boss raid handled separately by the existing intro card.
const DEATH_RAID_LINES: Record<number, string> = {
  1: '"You came. Of course you did."',
  2: '"Closer now. The dead grow restless."',
  3: '"You will not leave the same."',
  4: '"Show me what you have learned."',
  5: '"One more door. Then me."',
};

const THEME_FLAVOR: Record<string, { name: string; line: string }> = {
  crypt:     { name: 'The Crypt',     line: 'Bones whisper here.' },
  catacomb:  { name: 'The Catacomb',  line: 'Old idols watch from the dark.' },
  hellscape: { name: 'The Hellscape', line: 'Ash and blood.' },
  cavern:    { name: 'The Cavern',    line: 'Roots clutch the dead.' },
};

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
  roomIdx: number;
  roomCount: number;
  roomLabel: string;
  miniBossIntroActive: boolean;
  bargainOffered: boolean;
}

export function DungeonScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<DungeonGame | null>(null);
  const run = useGameStore((s) => s.run);
  const stats = useGameStore((s) => s.stats);
  const showScene = useGameStore((s) => s.showScene);
  const addCashEarned = useGameStore((s) => s.addCashEarned);
  const addKills = useGameStore((s) => s.addKills);
  const isBossRaidFn = useGameStore((s) => s.isBossRaid);
  const nextRound = useGameStore((s) => s.nextRound);
  const triggerWin = useGameStore((s) => s.triggerWin);
  const setLastRunSummary = useGameStore((s) => s.setLastRunSummary);
  const paused = useGameStore((s) => s.paused);
  const motionIntensity = useSettingsStore((s) => s.motionIntensity);
  const renderQuality = useSettingsStore((s) => s.renderQuality);
  const blood = useSettingsStore((s) => s.blood);
  const greedLevel = useGameStore((s) => s.run.upgrades.cash);
  const addCashToRun = useGameStore((s) => s.addCashToRun);
  const cashMult = 1 + greedLevel * 0.25;
  const isBossRaid = isBossRaidFn();

  // Push pause state through to the engine whenever it flips.
  useEffect(() => {
    gameRef.current?.setPaused(paused);
  }, [paused]);

  // Poll the active-spell cooldown 5x/sec so the HUD pip refreshes.
  useEffect(() => {
    const id = setInterval(() => {
      const g = gameRef.current;
      if (g) setActiveReady(g.getActiveSpellReady());
    }, 200);
    return () => clearInterval(id);
  }, []);

  // Engine reads blood toggle off a global (avoids dragging zustand into the
  // engine module). Keep it in sync with the store.
  useEffect(() => {
    (window as Window & { __DG_BLOOD_ON?: boolean }).__DG_BLOOD_ON = blood;
  }, [blood]);

  const [activeReady, setActiveReady] = useState(1);

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
    roomIdx: -1,
    roomCount: 0,
    roomLabel: '',
    miniBossIntroActive: false,
    bargainOffered: false,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 1 });
  const [showFirstHelp, setShowFirstHelp] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  // Bargain modal state (#164/#167) — opens when the engine signals a
  // bargain is owed after a non-final, non-mini-boss room clears.
  const [bargainChoices, setBargainChoices] = useState<BargainDef[] | null>(null);
  const setPaused = useGameStore((s) => s.setPaused);
  const applyBargain = useGameStore((s) => s.applyBargain);

  // First-time dungeon visit: show prominent control overlay for ~5s.
  useEffect(() => {
    if (loading) return;
    if (localStorage.getItem('dg_dungeon_help_seen')) return;
    setShowFirstHelp(true);
    const t = setTimeout(() => {
      setShowFirstHelp(false);
      localStorage.setItem('dg_dungeon_help_seen', '1');
    }, 5000);
    return () => clearTimeout(t);
  }, [loading]);

  // Per-raid intro card — fades in/out. Boss raids get a longer, weightier
  // hold so "DEATH ITSELF" lands cinematically.
  useEffect(() => {
    if (loading) return;
    setShowIntro(true);
    const dur = isBossRaid ? 4000 : 2500;
    const t = setTimeout(() => setShowIntro(false), dur);
    return () => clearTimeout(t);
  }, [loading, run.raid, run.endlessRound, isBossRaid]);

  // Bargain modal trigger (#167) — when the engine raises bargainOffered,
  // roll 3 random options the player hasn't taken this raid, pause the
  // game, and consume the offer flag so the engine doesn't re-fire.
  useEffect(() => {
    if (!hud.bargainOffered || bargainChoices) return;
    const taken = useGameStore.getState().run.bargainsTaken;
    const choices = rollBargainChoices(taken);
    if (choices.length === 0) {
      gameRef.current?.consumeBargainOffer();
      return;
    }
    setBargainChoices(choices);
    setPaused(true);
    gameRef.current?.consumeBargainOffer();
  }, [hud.bargainOffered, bargainChoices, setPaused]);

  function chooseBargain(b: BargainDef) {
    // Apply directly to the live engine (#194) — bypasses the store so the
    // dungeon effect doesn't see a stats-ref change and remount the engine.
    const def = BARGAINS_BY_ID[b.id];
    if (def && gameRef.current) {
      gameRef.current.applyBargain(def.apply);
    }
    // Still record the bargain in the store so the same option isn't offered
    // again this raid (rollBargainChoices reads run.bargainsTaken).
    applyBargain(b.id);
    setBargainChoices(null);
    setPaused(false);
  }
  function skipBargain() {
    setBargainChoices(null);
    setPaused(false);
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !run.build || !run.weapon || !stats) return;

    let game: DungeonGame | null = null;
    let app: Application | null = null;
    let cancelled = false;

    (async () => {
      try {
        const dpr = window.devicePixelRatio || 1;
        const qualityCap = renderQuality === 'low' ? 1 : renderQuality === 'medium' ? 1.5 : 4;
        app = new Application();
        await app.init({
          background: 0x060609,
          resizeTo: window,
          antialias: true,
          resolution: Math.min(dpr, qualityCap),
          autoDensity: true,
        });
        if (cancelled) {
          app.destroy(true);
          return;
        }
        // Accessibility — screen readers can at least announce the canvas
        // as "Dungeon combat" with movement instructions.
        app.canvas.setAttribute('role', 'application');
        app.canvas.setAttribute(
          'aria-label',
          'Dungeon combat — use WASD or arrow keys to move. Your weapon fires automatically at the nearest enemy.'
        );
        container.appendChild(app.canvas);

        game = new DungeonGame(app, {
          build: run.build!,
          weapon: run.weapon!,
          stats: stats!,
          isBossRaid,
          motionIntensity,
          cashMult,
          // Story-mode room layout (#145) — only for story (not infinite/daily)
          // and only for non-boss raids. Boss raid stays single-arena.
          useRoomLayout: run.mode === 'story' && !isBossRaid,
          raidNumber: run.raid,
          totalStoryRaids: run.totalRaids,
          theme: themeFor({
            mode: run.mode,
            raid: run.raid,
            totalRaids: run.totalRaids,
            endlessRound: run.endlessRound,
            isBossRaid,
          }),
          onPreloadProgress: (loaded, total) => {
            if (cancelled) return;
            setLoadProgress({ loaded, total });
          },
          onStatsChange: (s) => {
            if (cancelled) return;
            setHud(s);
          },
          onGameOver: (gs) => {
            if (cancelled) return;
            addCashEarned(gs.cash);
            addKills(gs.kills);
            useStatsStore.getState().recordDeath(gs.kills, gs.cash);
            // (#169) Award souls for the run — death still pays out so first
            // attempts feel rewarding.
            const souls = useSoulsStore.getState();
            const earned = calcSoulsForRun({
              kills: gs.kills,
              raidsCleared: Math.max(0, run.raid - 1),
              bossDefeated: false,
            });
            souls.addSouls(earned);
            souls.markPlayed();
            // (#180-#182) capture post-death summary for the gameover screen.
            setLastRunSummary({
              lastDamageSource: gs.lastDamageSource,
              biggestHit: gs.biggestHit,
              favoriteKill: gs.favoriteKill,
              timeAlive: gs.time,
              soulsEarned: earned,
            });
            // No persistent cash — run-scoped only.
            showScene('gameover');
          },
          onRoundComplete: (gs) => {
            if (cancelled) return;
            addKills(gs.kills);
            // Cash earned this round becomes spendable cash in the shop
            addCashToRun(gs.cash);
            // Track endless milestone if applicable.
            if (run.mode === 'infinite') {
              useStatsStore.getState().recordEndlessRound((run.endlessRound ?? 0) + 1);
            }
            // Refresh the last-run summary so it's available even if player wins.
            setLastRunSummary({
              lastDamageSource: gs.lastDamageSource,
              biggestHit: gs.biggestHit,
              favoriteKill: gs.favoriteKill,
              timeAlive: gs.time,
            });
            nextRound();
          },
          onBossDefeated: (gs) => {
            if (cancelled) return;
            addCashEarned(gs.cash);
            addKills(gs.kills);
            useStatsStore.getState().recordWin(gs.kills, gs.cash);
            // (#169) Award souls for full clear — base + perRaid + bossWin.
            const souls = useSoulsStore.getState();
            const earned = calcSoulsForRun({
              kills: gs.kills,
              raidsCleared: run.totalRaids - 1,
              bossDefeated: true,
            });
            souls.addSouls(earned);
            souls.markPlayed();
            setLastRunSummary({
              lastDamageSource: gs.lastDamageSource,
              biggestHit: gs.biggestHit,
              favoriteKill: gs.favoriteKill,
              timeAlive: gs.time,
              soulsEarned: earned,
            });
            triggerWin();
          },
        });
        await game.start();
        if (cancelled) {
          game.destroy();
          app.destroy(true);
          return;
        }
        gameRef.current = game;
        setLoading(false);
      } catch (err) {
        console.error('Dungeon init failed', err);
        setLoadError(String(err));
      }
    })();

    return () => {
      cancelled = true;
      gameRef.current = null;
      game?.destroy();
      try {
        app?.destroy(true, { children: true });
      } catch {
        /* swallow */
      }
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  // Intentionally omit `stats` from deps (#194): the engine takes a copy at
  // mount; subsequent store-side stats mutations (bargains, wheels) would
  // otherwise remount the engine and reset kills/position. The early-return
  // above still gates initial mount on `stats` being present.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.build, run.weapon, run.raid, run.endlessRound, run.mode, run.totalRaids, isBossRaid, motionIntensity, renderQuality, cashMult, addCashEarned, addCashToRun, addKills, showScene, nextRound, triggerWin, setLastRunSummary]);

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
          <GlassPanel padding="lg" className="dungeon-preload-card">
            <h3 className="display preload-title">
              {isBossRaid ? 'Death Approaches' : 'Death is Preparing'}
            </h3>
            <div className="preload-bar">
              <div
                className="preload-fill"
                style={{ width: `${(loadProgress.loaded / loadProgress.total) * 100}%` }}
              />
            </div>
            <div className="preload-count">
              {loadProgress.loaded} / {loadProgress.total}
            </div>
          </GlassPanel>
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
          <span className="info-l">{run.mode !== 'infinite' ? 'RAID' : 'ROUND'}</span>
          <span className="info-v">
            {run.mode !== 'infinite'
              ? isBossRaid
                ? 'Boss'
                : `${run.raid} / ${run.totalRaids - 1}`
              : `${(run.endlessRound ?? 0) + 1}`}
          </span>
        </span>
        {hud.roomCount > 0 && (
          <span className="info-pair">
            <span className="info-l">ROOM</span>
            <span className="info-v">
              {Math.min(hud.roomIdx + 1, hud.roomCount)} / {hud.roomCount} · {hud.roomLabel}
            </span>
          </span>
        )}
        <span className="info-pair"><span className="info-l">$</span><span className="info-v">{hud.cashThisRun}</span></span>
      </div>

      {/* Active bargain chips — top-center under the round timer */}
      {(run.activeBuff || run.activeCurse) && (
        <div className="dungeon-bargain">
          {run.activeBuff && (
            <span className="bargain-chip bargain-chip--buff">{run.activeBuff}</span>
          )}
          {run.activeCurse && (
            <span className="bargain-chip bargain-chip--curse">{run.activeCurse}</span>
          )}
        </div>
      )}

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
        <div className="hud-row"><span><span className="hud-icon" style={{ color: 'var(--blood-bright)' }}>♥</span> HP</span><span>{Math.max(0, Math.ceil(hud.hp))} / {hud.hpMax}</span></div>
        {run.weapon && (
          <>
            <div className="hud-row"><span><span className="hud-icon">{run.weapon.icon}</span> WPN</span><span>{run.weapon.name}</span></div>
            <div className="hud-row"><span><span className="hud-icon" style={{ color: 'var(--gold)' }}>⚔</span> DMG</span><span>{run.weapon.dmg}</span></div>
            <div className="hud-row"><span><span className="hud-icon" style={{ color: 'var(--candle)' }}>⚡</span> ATK SPD</span><span>{run.weapon.atkspd.toFixed(1)}</span></div>
            <div className="hud-row"><span><span className="hud-icon" style={{ color: 'var(--arcane-bright)' }}>🎯</span> RANGE</span><span>{run.weapon.range}</span></div>
          </>
        )}
        <div className="hud-bar hud-bar--xp">
          <div className="hud-bar-fill hud-bar-fill--xp" style={{ width: `${xpPct}%` }} />
        </div>
      </GlassPanel>

      <div className="dungeon-hint">
        WASD / Arrow keys — auto-attacks fire · Q for {run.build?.active.name ?? 'active'}
      </div>

      {/* Active spell cooldown pip — bottom-right */}
      <div className={`active-spell ${activeReady >= 1 ? 'active-spell--ready' : ''}`}>
        <div className="active-spell-key">{run.build?.active.key ?? 'Q'}</div>
        <div className="active-spell-name">{run.build?.active.name ?? 'Active'}</div>
        <div className="active-spell-cd">
          <div className="active-spell-cd-fill" style={{ width: `${activeReady * 100}%` }} />
        </div>
      </div>

      {hud.miniBossIntroActive && (() => {
        // Pick the elite name based on raid number — matches the engine's
        // alternation in spawnEnemy (#185).
        const eliteName = (run.raid % 2 === 0) ? 'BONE KNIGHT' : 'LICH ACOLYTE';
        const tag = (run.raid % 2 === 0) ? 'Heavy cleave. Telegraphed.' : 'Summons adds. Strike fast.';
        return (
          <div className="dungeon-intro dungeon-intro--miniboss">
            <div className="dungeon-intro-heading display">{eliteName}</div>
            <div className="dungeon-intro-sub">{tag}</div>
          </div>
        );
      })()}

      {showIntro && (() => {
        const themeKey = themeFor({
          mode: run.mode,
          raid: run.raid,
          totalRaids: run.totalRaids,
          endlessRound: run.endlessRound,
          isBossRaid,
        });
        const flavor = THEME_FLAVOR[themeKey] ?? { name: 'Unknown', line: '' };
        const heading = isBossRaid
          ? 'DEATH ITSELF'
          : run.mode !== 'infinite'
            ? `Raid ${run.raid} of ${run.totalRaids - 1}`
            : `Round ${(run.endlessRound ?? 0) + 1}`;
        const sub = isBossRaid ? 'You knew this was coming.' : `${flavor.name} · ${flavor.line}`;
        // Death dialogue (#163) — adds a per-raid spoken line under the
        // existing flavor. Boss raid keeps its own subtitle.
        const deathLine = !isBossRaid ? DEATH_RAID_LINES[run.raid] : null;
        return (
          <div className={`dungeon-intro ${isBossRaid ? 'dungeon-intro--boss' : ''}`}>
            <div className="dungeon-intro-heading display">{heading}</div>
            <div className="dungeon-intro-sub">{sub}</div>
            {deathLine && <div className="dungeon-intro-death">{deathLine}</div>}
          </div>
        );
      })()}

      {showFirstHelp && (
        <div className="dungeon-first-help">
          <div className="first-help-card">
            <div className="first-help-row"><kbd>W A S D</kbd> <span>or arrow keys to move</span></div>
            <div className="first-help-row"><span>Your weapon fires automatically at the nearest enemy</span></div>
            <div className="first-help-row"><kbd>⚙</kbd> <span>top-right · settings &amp; pause</span></div>
          </div>
        </div>
      )}

      {paused && !bargainChoices && (
        <div className="dungeon-paused">
          <div className="dungeon-paused-text display">Paused</div>
        </div>
      )}

      {bargainChoices && (
        <div className="bargain-modal">
          <div className="bargain-card">
            {/* Death NPC sprite (#166) — uses the boss lich sprite as Death's
                in-game representation. The wheels scene draws a procedural
                Death; here a sprite is enough since the modal is brief. */}
            <div className="bargain-death">
              <img src={`${import.meta.env.BASE_URL}assets/tiles/dungeon-crawl/dc-mon/undead/lich.png`} alt="Death offers a bargain" />
            </div>
            <div className="bargain-body">
              <div className="bargain-title display">A Bargain</div>
              <div className="bargain-flavor">"Choose. I'm patient — but the dead grow restless."</div>
              <div className="bargain-options">
                {bargainChoices.map((b) => (
                  <button key={b.id} className="bargain-option" onClick={() => chooseBargain(b)}>
                    <div className="bargain-option-name">{b.name}</div>
                    <div className="bargain-option-desc">{b.desc}</div>
                    <div className="bargain-option-flavor">{b.flavor}</div>
                  </button>
                ))}
              </div>
              <div className="bargain-actions">
                <GlassButton onClick={skipBargain} variant="ghost">Walk away</GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
