// PixiJS-based dungeon game — minimal port of the v0.5 dungeon loop +
// juice pass: camera shake/zoom/smooth-follow, bouncy damage popups,
// screen flash on damage, level-up burst.

import {
  Application,
  Container,
  Sprite,
  Texture,
  Graphics,
  Assets,
  Text,
  TextStyle,
  TilingSprite,
} from 'pixi.js';
import type { BuildDef, EnemyTypeDef, PlayerStats, SettingsState, WeaponDef } from '../../types';
import { ENEMY_TYPES, FINAL_BOSS } from '../../data/enemies';
import {
  PLAYER_SPRITE_BY_BUILD,
  ENEMY_SPRITE_BY_TYPE,
  PROJECTILE_BY_WEAPON,
  THEMES,
  type ThemeKey,
} from '../pixi/manifest';
import { AudioManager } from '../audio/AudioManager';
import { buildZones, isPlayerInZone, type Zone } from './zones';
import { SPELLS_BY_ID } from '../../data/spells';

const ROUND_DURATION_S = 60;

/** Multiplier applied to all juice (shake, flash, hit-stop, zoom). */
const MOTION_MULT: Record<SettingsState['motionIntensity'], number> = {
  off: 0,
  low: 0.5,
  normal: 1.0,
  high: 1.5,
};

/** Tiny seeded PRNG — deterministic decoration placement. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PlayerEntity {
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  sprite: Sprite;
  flashTimer: number;
  facing: 1 | -1;
}

interface EnemyEntity {
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  spd: number;
  baseSpd: number;          // pre-slow speed, used to restore from frost slow
  dmg: number;
  r: number;
  cash: number;
  sprite: Sprite;
  flashTimer: number;
  proto: EnemyTypeDef;
  isBoss: boolean;
  lastShotMs: number;       // for ranged enemies — time of last projectile fired
  slowUntilMs: number;      // 0 = not slowed
  /** Zone index this enemy was spawned for (story-mode room layout, #145). */
  spawnZoneIdx?: number;
  /** Mini-boss elite (#183/#184) — gets cleave AOE (BoneKnight) or summons (Lich). */
  isElite?: boolean;
  /** Next cleave timestamp for BoneKnight elite. */
  nextCleaveMs?: number;
  /** Next add-summon timestamp for Lich elite. */
  nextSummonMs?: number;
}

interface EnemyProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  life: number;
  graphics: Graphics;
  /** Display name of the enemy that fired this — used for post-death attribution (#180). */
  sourceName: string;
}

interface ProjectileEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  crit: boolean;
  life: number;
  pierce: number;
  hit: Set<EnemyEntity>;
  /** One of `graphics` (melee slash arc) or `sprite` (ranged/magic) is set. */
  graphics?: Graphics;
  sprite?: Sprite;
}

interface GemEntity {
  x: number;
  y: number;
  graphics: Graphics;
}

type HitKind = 'damage' | 'crit' | 'heal' | 'player-damage' | 'cash';

interface HitText {
  x: number;
  y: number;
  vy: number;        // upward drift velocity
  life: number;
  maxLife: number;
  text: Text;
  kind: HitKind;
}

type ParticleKind = 'spark' | 'burst' | 'blood' | 'ember' | 'dust';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  sprite: Sprite;          // pooled — tinted instead of redrawn
  kind: ParticleKind;
  drag: number;
  gravity: number;
}

export interface DungeonRunSummary {
  time: number;
  kills: number;
  level: number;
  cash: number;
  // Post-death summary (#180/#181/#182)
  /** Display name of the enemy / source that landed the killing blow ('—' if won). */
  lastDamageSource: string;
  /** Largest single-hit damage the player dealt this run. */
  biggestHit: number;
  /** "{Enemy Name} (×N)" — the enemy type the player killed most this run. */
  favoriteKill: string;
}

export interface DungeonGameOptions {
  build: BuildDef;
  weapon: WeaponDef;
  stats: PlayerStats;
  isBossRaid: boolean;
  motionIntensity: SettingsState['motionIntensity'];
  cashMult: number;        // 1 + greedLevel*0.25
  theme: ThemeKey;
  /**
   * Story-mode room layout (#145). When true, the raid is a chain of zones
   * the player walks through east-to-east; each zone triggers a fixed wave
   * on entry, raid completes when all zones cleared. Replaces the 60s timer.
   * Boss raids and infinite mode keep the open-arena flow.
   */
  useRoomLayout?: boolean;
  /** Story raid number — used to size the room chain (raid 1 = 3 rooms, etc.). */
  raidNumber?: number;
  totalStoryRaids?: number;
  onPreloadProgress?: (loaded: number, total: number) => void;
  onStatsChange: (s: {
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
    roomIdx: number;        // current zone index (0-based)
    roomCount: number;      // total zones (0 = no room layout)
    roomLabel: string;      // e.g. "Room 2" / "Mini-Boss" / "Final Room"
    /** Mini-boss intro card pulse (#186) — true for ~3s after entering the
     *  mini-boss zone, then false. The HUD reads this to show the cinematic. */
    miniBossIntroActive: boolean;
    /** Bargain offer pulse (#167) — true when a non-final, non-mini-boss
     *  zone has just cleared. React consumes it via consumeBargainOffer()
     *  when the modal opens. */
    bargainOffered: boolean;
  }) => void;
  onGameOver: (stats: DungeonRunSummary) => void;
  onRoundComplete: (stats: DungeonRunSummary) => void; // round timer ran out (non-boss)
  onBossDefeated: (stats: DungeonRunSummary) => void;  // boss kill in boss raid
}

const HIT_STYLE_NORMAL = new TextStyle({
  fontFamily: 'Cinzel, Georgia, serif',
  fontSize: 16,
  fontWeight: 'bold',
  fill: 0xf0c84a,
  stroke: { color: 0x1a1408, width: 3 },
});
const HIT_STYLE_CRIT = new TextStyle({
  fontFamily: 'Cinzel, Georgia, serif',
  fontSize: 22,
  fontWeight: 'bold',
  fill: 0xff9050,
  stroke: { color: 0x2a1408, width: 3 },
});
const HIT_STYLE_HEAL = new TextStyle({
  fontFamily: 'Cinzel, Georgia, serif',
  fontSize: 14,
  fontWeight: 'bold',
  fill: 0x80ffaa,
  stroke: { color: 0x0a2a14, width: 3 },
});
const HIT_STYLE_PLAYER_DMG = new TextStyle({
  fontFamily: 'Cinzel, Georgia, serif',
  fontSize: 18,
  fontWeight: 'bold',
  fill: 0xff5050,
  stroke: { color: 0x2a0a0a, width: 3 },
});
const HIT_STYLE_CASH = new TextStyle({
  fontFamily: 'Cinzel, Georgia, serif',
  fontSize: 14,
  fontWeight: 'bold',
  fill: 0xf0c84a,
  stroke: { color: 0x2a1f08, width: 3 },
});

export class DungeonGame {
  private app: Application;
  private opts: DungeonGameOptions;
  private stats: PlayerStats;

  // Layers — all camera-relative containers live in worldRoot, which
  // is what we shake/zoom. screenLayer sits on top, untouched by camera.
  private worldRoot: Container = new Container();
  private bgLayer: Container = new Container();        // floor tiles
  private worldLayer: Container = new Container();
  private projectileLayer: Container = new Container();
  private particleLayer: Container = new Container();
  private hitTextLayer: Container = new Container();
  private screenLayer: Container = new Container();
  private vignetteLayer: Graphics = new Graphics();   // corners darken (screen-space)

  private screenFlash: Graphics = new Graphics();
  private screenFlashAlpha = 0;        // current alpha
  private levelGlow: Graphics = new Graphics();
  private levelGlowAlpha = 0;
  private lastAmbientSpawnMs = 0;
  private lightSprite: Sprite | null = null;
  private lightTexture: Texture | null = null;
  private lightFlickerT = 0;
  private particleTexture: Texture | null = null;
  private particlePool: Sprite[] = [];
  private floorSprite: TilingSprite | null = null;
  private floorOverlay: TilingSprite | null = null;
  /** Solid decorations the player + enemies bump into. */
  private obstacles: { x: number; y: number; r: number }[] = [];
  // Story-mode (#146/#147) — axis-aligned wall rectangles. `doorOpen` lets
  // the segment skip collision (used for door gaps that open when a zone
  // clears). x/y are world-space top-left.
  private walls: { x: number; y: number; w: number; h: number; doorOpen: boolean; zoneIdx: number; isDoor: boolean }[] = [];
  private wallGfx: Graphics | null = null;

  private player!: PlayerEntity;
  private enemies: EnemyEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private enemyProjectiles: EnemyProjectile[] = [];
  private gems: GemEntity[] = [];
  private hits: HitText[] = [];
  private particles: Particle[] = [];

  // Camera state
  private camX = 0;
  private camY = 0;
  private targetCamX = 0;
  private targetCamY = 0;
  private shakeMag = 0;
  private shakeT = 0;
  private zoomScale = 1;
  private zoomTarget = 1;

  private keys = new Set<string>();
  private startTime = 0;
  private lastShotMs = 0;
  private lastSpawnMs = 0;
  private spawnIntervalMs = 1100;

  private kills = 0;
  private level = 1;
  private xp = 0;
  private xpNext = 8;
  private cashThisRun = 0;
  private gameOver = false;
  private finished = false;        // round complete OR boss defeated
  private deathPlaying = false;    // player death animation in progress
  private deathT = 0;
  private boss: EnemyEntity | null = null;
  private bossEnraged = false;
  private bossNextAoeMs = 0;
  // Story-mode room layout (#145)
  private zones: Zone[] = [];
  private activeZoneIdx = -1;
  private allZonesCleared = false;
  /** Timestamp when the player entered the mini-boss zone (#186). 0 = never. */
  private miniBossIntroAt = 0;
  /** True after a non-final/non-mini-boss zone clears, until React consumes it (#167). */
  private bargainPending = false;
  // Post-death summary tracking (#180/#181)
  private lastDamageSource = '—';
  private biggestHit = 0;
  private killCounts: Record<string, number> = {};
  private hitStopT = 0;            // time-scale freeze remaining (real seconds)
  // Build-defined active spell on Q (#152/#153). Cooldown comes from
  // build.active.cooldownSec; per-active state below.
  private activeSpellLastCastMs = -Infinity;
  // Buff-window actives (timer-driven):
  private coinFlipUntilMs = 0;
  private coinFlipHeads = false;     // true = atkspd buff, false = range buff
  private smokeBombUntilMs = 0;      // invuln + atkspd window
  private riposteArmedUntilMs = 0;   // next melee/shot deals ×5 dmg
  private riposteUsed = false;
  // Hunter's Mark: marked enemy ref + remaining shots that home in on it
  private markedEnemy: EnemyEntity | null = null;
  private huntersMarkShotsLeft = 0;
  // Aggregated spell effects (#157/#158) — built once from build.spells.
  private spellFx: {
    fullHpHitMult: number;
    defLowHpMult: number;
    critChainPct: number;
    killStreakPierce: number;
    sustainedFireRamp: number;
    killStreakRange: number;
    killHealPct: number;
  } = {
    fullHpHitMult: 1,
    defLowHpMult: 1,
    critChainPct: 0,
    killStreakPierce: 0,
    sustainedFireRamp: 0,
    killStreakRange: 0,
    killHealPct: 0,
  };
  // Runtime spell state — kill streak / sustained fire counters.
  private streakPierceUntilMs = 0;     // Pierce — recent kill window
  private sustainedFireStreak = 0;     // Haste — consecutive shot count
  private lastShotForRampMs = 0;
  private reachKillBonus = 0;          // Reach — bonus range from kills
  private motionMult = 1;          // multiplier from settings (0/0.5/1/1.5)
  private paused = false;
  private pauseStartedAt = 0;      // performance.now() when pause began
  private totalPausedMs = 0;       // accumulated pause time, subtracted from elapsedS

  private tickerCb: (() => void) | null = null;

  constructor(app: Application, opts: DungeonGameOptions) {
    this.app = app;
    this.opts = opts;
    this.stats = { ...opts.stats };
    this.motionMult = MOTION_MULT[opts.motionIntensity] ?? 1;

    // Layer order — bg tiles are inside worldRoot so they shake/zoom with
    // the rest of the world (and scroll with the camera).
    this.worldRoot.addChild(this.bgLayer);
    this.worldRoot.addChild(this.worldLayer);
    this.worldRoot.addChild(this.projectileLayer);
    this.worldRoot.addChild(this.particleLayer);
    this.worldRoot.addChild(this.hitTextLayer);
    app.stage.addChild(this.worldRoot);

    // Screen-space overlays (above world, drawn on top)
    this.screenLayer.addChild(this.vignetteLayer);
    this.screenLayer.addChild(this.screenFlash);
    this.screenLayer.addChild(this.levelGlow);
    app.stage.addChild(this.screenLayer);

    this.buildVignette();
    this.buildLighting();
    this.buildParticleTexture();
    // buildBackground() is called in start() AFTER preload — its TilingSprite
    // texture must already be loaded or it'll render as a blank placeholder.
  }

  // Single shared white circle texture — particles use this with tint+scale
  // so we never have to clear+redraw a Graphics on recycle.
  private buildParticleTexture(): void {
    const SIZE = 16;
    const c = document.createElement('canvas');
    c.width = SIZE;
    c.height = SIZE;
    const ctx = c.getContext('2d')!;
    const cx = SIZE / 2;
    ctx.beginPath();
    ctx.arc(cx, cx, cx - 1, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    this.particleTexture = Texture.from(c);
  }

  async start(): Promise<void> {
    this.aggregateSpellFx();
    await this.preload();
    this.buildBackground();
    // Story-mode room chain (#145) — visible zone tints + state machine.
    if (this.opts.useRoomLayout && !this.opts.isBossRaid) {
      this.zones = buildZones(this.opts.raidNumber ?? 1, this.opts.totalStoryRaids ?? 3);
      this.drawZoneOverlays();
      this.buildWalls();
    }
    this.spawnPlayer();
    if (this.opts.isBossRaid) {
      this.spawnBoss();
    }
    this.startTime = performance.now();
    this.attachInput();
    this.app.renderer.on('resize', this.onResize);
    this.tickerCb = () => this.tick(this.app.ticker.deltaMS / 1000);
    this.app.ticker.add(this.tickerCb);
  }

  private onResize = () => {
    this.repaintVignette();
    this.layoutLighting();
  };

  destroy(): void {
    if (this.tickerCb) this.app.ticker.remove(this.tickerCb);
    this.detachInput();
    this.app.renderer.off('resize', this.onResize);
    this.worldRoot.destroy({ children: true });
    this.screenLayer.destroy({ children: true });
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.enemyProjectiles.length = 0;
    this.gems.length = 0;
    this.hits.length = 0;
    this.particles.length = 0;
  }

  // ---------- Preload ----------
  private async preload(): Promise<void> {
    const theme = THEMES[this.opts.theme];
    const projUrl = PROJECTILE_BY_WEAPON[this.opts.weapon.id];
    const BASE = import.meta.env.BASE_URL;
    // Flat ground props (#144) — also preloaded so they don't pop in.
    const propUrls = [
      `${BASE}assets/tiles/dungeon-crawl/dc-misc/blood_red1.png`,
      `${BASE}assets/tiles/dungeon-crawl/dc-misc/blood_red2.png`,
      `${BASE}assets/tiles/dungeon-crawl/dc-misc/blood_red3.png`,
      `${BASE}assets/tiles/dungeon-crawl/dc-misc/demon_pentagram1.png`,
      `${BASE}assets/tiles/dungeon-crawl/dc-misc/demon_pentagram3.png`,
    ];
    const urls = [
      PLAYER_SPRITE_BY_BUILD[this.opts.build.id] ?? PLAYER_SPRITE_BY_BUILD['gambler'],
      ...Object.values(ENEMY_SPRITE_BY_TYPE),
      theme.floor,
      ...theme.decorations,
      ...propUrls,
      ...(projUrl ? [projUrl] : []),
    ];
    let loaded = 0;
    const total = urls.length;
    this.opts.onPreloadProgress?.(0, total);
    await Promise.all(
      urls.map(async (u) => {
        await Assets.load(u);
        loaded++;
        this.opts.onPreloadProgress?.(loaded, total);
      })
    );
  }

  // ---------- Player ----------
  private spawnPlayer(): void {
    const url = PLAYER_SPRITE_BY_BUILD[this.opts.build.id] ?? PLAYER_SPRITE_BY_BUILD['gambler'];
    const tex = Texture.from(url);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.scale.set(2.0);
    this.worldLayer.addChild(sprite);

    this.player = {
      x: 0,
      y: 0,
      hp: this.stats.hp,
      hpMax: this.stats.hpMax,
      sprite,
      flashTimer: 0,
      facing: 1,
    };
    // Initialize camera centered on player so first frame doesn't snap
    this.camX = this.app.screen.width / 2;
    this.camY = this.app.screen.height / 2;
    this.targetCamX = this.camX;
    this.targetCamY = this.camY;
  }

  // ---------- Input ----------
  private keydown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
      this.keys.add(k);
    }
    if (k === 'q' && !this.paused && !this.gameOver && !this.finished) {
      e.preventDefault();
      this.tryCastActive();
    }
  };
  private keyup = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };
  private attachInput(): void {
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
  }
  private detachInput(): void {
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
  }

  /**
   * External pause toggle (e.g. when the SettingsModal opens). When paused,
   * tick() short-circuits and we account for the pause duration so the round
   * timer doesn't snap forward when the modal closes.
   */
  setPaused(p: boolean): void {
    if (p === this.paused) return;
    this.paused = p;
    if (p) {
      this.pauseStartedAt = performance.now();
    } else {
      this.totalPausedMs += performance.now() - this.pauseStartedAt;
    }
  }

  // ---------- Loop ----------
  private tick(realDt: number): void {
    if (this.paused) return;

    if (this.gameOver || this.finished) {
      if (this.deathPlaying) this.tickDeathAnim(realDt);
      this.updateScreenFx(realDt);
      this.updateCamera(realDt);
      return;
    }

    // Hit-stop scales the gameplay dt without affecting the camera/fx tick.
    let dt = realDt;
    if (this.hitStopT > 0) {
      this.hitStopT = Math.max(0, this.hitStopT - realDt);
      dt = realDt * 0.05; // near-freeze
    }

    const now = performance.now();
    const elapsedS = (now - this.startTime - this.totalPausedMs) / 1000;
    const remaining = this.opts.isBossRaid ? Number.POSITIVE_INFINITY : Math.max(0, ROUND_DURATION_S - elapsedS);

    this.updatePlayer(dt);
    this.maybeShoot(now);
    if (!this.opts.isBossRaid) {
      this.maybeSpawn(now, elapsedS);
    }
    this.maybeAmbient(now);
    this.tickLightFlicker(realDt);
    this.updateEnemies(dt);
    this.updateBoss(now);
    this.updateProjectiles(dt);
    this.updateEnemyProjectiles(dt);
    this.cullDeadEnemies();
    this.updateGems(dt);
    this.updateHits(dt);
    this.updateParticles(dt);
    this.updateScreenFx(dt);
    this.updateCamera(dt);

    // Story-mode (#145) HUD fields — current room index + label.
    let roomIdx = -1;
    let roomLabel = '';
    if (this.zones.length > 0) {
      // Show the active zone, or the next-uncleared zone if none active.
      const activeIdx = this.activeZoneIdx >= 0 ? this.activeZoneIdx : this.zones.findIndex((z) => !z.cleared);
      roomIdx = activeIdx >= 0 ? activeIdx : this.zones.length - 1;
      roomLabel = this.zones[roomIdx]?.label ?? '';
    }
    this.opts.onStatsChange({
      hp: this.player.hp,
      hpMax: this.player.hpMax,
      level: this.level,
      xp: this.xp,
      xpNext: this.xpNext,
      kills: this.kills,
      cashThisRun: this.cashThisRun,
      time: Math.floor(elapsedS),
      // Hide the round timer when room layout is active OR boss raid.
      timeRemaining: this.opts.isBossRaid || this.zones.length > 0 ? -1 : Math.ceil(remaining),
      bossHp: this.boss?.hp ?? null,
      bossHpMax: this.boss?.hpMax ?? null,
      roomIdx,
      roomCount: this.zones.length,
      roomLabel,
      miniBossIntroActive: this.miniBossIntroAt > 0 && performance.now() - this.miniBossIntroAt < 3000,
      bargainOffered: this.bargainPending,
    });

    // Player death takes priority
    if (this.player.hp <= 0 && !this.deathPlaying) {
      this.beginDeathAnim();
      return;
    }

    // Boss defeated
    if (this.opts.isBossRaid && this.boss && this.boss.hp <= 0) {
      this.boss = null;
      this.finished = true;
      // Brief celebratory shake + zoom
      this.applyShake(10, 0.5);
      this.applyZoomPulse(1.1, 0.5);
      this.levelGlowAlpha = 0.8;
      AudioManager.play('boss_defeat');
      this.spawnHit(this.player.x, this.player.y - 30, 'DEATH FALLS', 'heal');
      setTimeout(() => {
        this.opts.onBossDefeated(this.buildSummary(elapsedS, true));
      }, 1400);
      return;
    }

    // Story-mode (#145): all zones cleared = raid complete (replaces timer).
    if (this.zones.length > 0 && this.allZonesCleared) {
      this.finished = true;
      this.allZonesCleared = false; // prevent re-fire
      this.spawnHit(this.player.x, this.player.y - 30, 'RAID CLEAR', 'heal');
      setTimeout(() => {
        this.opts.onRoundComplete(this.buildSummary(elapsedS, true));
      }, 900);
      return;
    }

    // Non-boss round timer ran out (only fires when room layout is OFF)
    if (!this.opts.isBossRaid && this.zones.length === 0 && elapsedS >= ROUND_DURATION_S) {
      this.finished = true;
      this.spawnHit(this.player.x, this.player.y - 30, 'ROUND CLEAR', 'heal');
      setTimeout(() => {
        this.opts.onRoundComplete(this.buildSummary(elapsedS, true));
      }, 900);
    }
  }

  // ---------- Death animation ----------
  private beginDeathAnim(): void {
    this.deathPlaying = true;
    this.deathT = 0;
    // Strong feedback cluster
    this.applyShake(8, 0.6);
    this.applyScreenFlash(0.9);
    this.applyZoomPulse(1.08, 0.7);
    this.spawnHit(this.player.x, this.player.y - 24, 'DEATH COLLECTS', 'player-damage');
  }

  private tickDeathAnim(dt: number): void {
    this.deathT += dt;
    // Slow decay player sprite alpha + tint to red
    const t = Math.min(1, this.deathT / 1.8);
    this.player.sprite.alpha = 1 - t;
    this.player.sprite.tint = 0xff5050;
    // Fade in the screen overlay (handled by screenLayer alpha)
    if (this.deathT >= 1.8 && !this.gameOver) {
      this.gameOver = true;
      const elapsedS = (performance.now() - this.startTime - this.totalPausedMs) / 1000;
      this.opts.onGameOver(this.buildSummary(elapsedS, false));
    }
  }

  private updatePlayer(dt: number): void {
    let mx = 0;
    let my = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) {
      mx -= 1;
      this.player.facing = -1;
    }
    if (this.keys.has('d') || this.keys.has('arrowright')) {
      mx += 1;
      this.player.facing = 1;
    }
    if (mx || my) {
      const m = Math.hypot(mx, my);
      this.player.x += (mx / m) * this.stats.spd * dt * 60;
      this.player.y += (my / m) * this.stats.spd * dt * 60;
      this.resolveObstacleCollision(this.player, 18);
      this.resolveWallCollision(this.player, 18);
    }

    this.player.sprite.scale.x = 2.0 * this.player.facing;

    if (this.player.flashTimer > 0) {
      this.player.flashTimer -= dt;
      this.player.sprite.tint = this.player.flashTimer > 0 ? 0xff8080 : 0xffffff;
    } else {
      this.player.sprite.tint = 0xffffff;
    }
  }

  private maybeShoot(now: number): void {
    // Active-spell modifiers (#154/#155) — Coin Flip atkspd buff, Smoke Bomb
    // atkspd burst stack with the base interval calc.
    let atkspdMod = 1;
    if (this.coinFlipUntilMs > now && this.coinFlipHeads) atkspdMod *= 1.5;
    if (this.smokeBombUntilMs > now) atkspdMod *= 2.0;
    // Haste (#158) — sustained-fire ramp. Streak counts consecutive shots
    // taken within 500ms of each other; bonus = ramp × min(1, streak/8).
    if (this.spellFx.sustainedFireRamp > 0) {
      if (now - this.lastShotForRampMs > 500) this.sustainedFireStreak = 0;
      const t = Math.min(1, this.sustainedFireStreak / 8);
      atkspdMod *= 1 + this.spellFx.sustainedFireRamp * t;
    }
    const interval = 1000 / (this.stats.atkspd * this.stats.atkspdMult * atkspdMod);
    if (now - this.lastShotMs < interval) return;

    // Range can be extended by Coin Flip Tails or Hunter's Mark (auto-aim).
    // Reach (#158) — kill streak adds to range until the player takes damage.
    let range = this.stats.range + this.stats.rangeBonus + this.reachKillBonus;
    if (this.coinFlipUntilMs > now && !this.coinFlipHeads) range *= 1.5;

    const w = this.opts.weapon;

    if (w.type === 'melee') {
      const hit = this.swingMelee(range);
      if (hit) {
        this.lastShotMs = now;
        this.sustainedFireStreak++;
        this.lastShotForRampMs = now;
      }
      return;
    }

    // Hunter's Mark — auto-aim at marked enemy if it's still alive + has shots left.
    let target: EnemyEntity | null = null;
    if (this.huntersMarkShotsLeft > 0 && this.markedEnemy && this.markedEnemy.hp > 0) {
      target = this.markedEnemy;
      this.huntersMarkShotsLeft--;
      if (this.huntersMarkShotsLeft === 0) this.markedEnemy = null;
    } else {
      target = this.findNearestEnemy(range);
    }
    if (!target) return;
    this.fireProjectile(target);
    this.lastShotMs = now;
    this.sustainedFireStreak++;
    this.lastShotForRampMs = now;
  }

  /**
   * Damage enemies in a forward 180° arc within `range` of the player.
   * Iter4: was full 360° — too generous on Hard difficulty (1.4× spawns)
   * where it trivialized crowd density. Now requires player to face threats.
   * Behind-the-shoulder tolerance of 0.15× range so it doesn't feel mechanical.
   */
  private swingMelee(range: number): boolean {
    const px = this.player.x;
    const py = this.player.y;
    const w = this.opts.weapon;
    const baseColor = parseInt(w.color.replace('#', ''), 16);
    const r2 = range * range;
    const now = performance.now();
    let isCrit = Math.random() < this.stats.crit;
    let dmgMultActive = 1;
    // Riposte (#154 — Duelist) — armed → next swing deals ×5 + always crits.
    if (!this.riposteUsed && this.riposteArmedUntilMs > now) {
      dmgMultActive = 5;
      isCrit = true;
      this.riposteUsed = true;
      this.riposteArmedUntilMs = 0;
    }
    const dmg = (w.dmg + this.stats.dmg) * this.stats.dmgMult * dmgMultActive * (isCrit ? 2 : 1);
    // Forward arc threshold — facing=1 (right): hit dx >= -tol, facing=-1: hit dx <= tol.
    const facing = this.player.facing;
    const arcTol = range * 0.15;

    let anyHit = false;
    for (const e of this.enemies) {
      const dx = e.x - px;
      const dy = e.y - py;
      if (dx * dx + dy * dy > r2) continue;
      // Forward-arc gate.
      if (facing === 1 && dx < -arcTol) continue;
      if (facing === -1 && dx > arcTol) continue;
      // Overkill (#157) — full-HP enemy gets the multiplier on first contact.
      const overkill = e.hp >= e.hpMax && this.spellFx.fullHpHitMult > 1;
      const finalDmg = overkill ? dmg * this.spellFx.fullHpHitMult : dmg;
      e.hp -= finalDmg;
      if (finalDmg > this.biggestHit) this.biggestHit = finalDmg; // (#181)
      e.flashTimer = 0.12;
      e.sprite.tint = isCrit ? 0xffd070 : 0xffffff;
      this.spawnHit(e.x, e.y - 10, Math.round(finalDmg).toString(), overkill ? 'crit' : isCrit ? 'crit' : 'damage');
      this.spawnBloodSplash(e.x, e.y);
      anyHit = true;
    }
    if (anyHit) {
      AudioManager.play(isCrit ? 'hit_heavy' : dmg > 20 ? 'hit_med' : 'hit_light');
      if (isCrit) {
        this.applyShake(2.5, 0.18);
        this.applyHitStop(0.04);
      }
    }

    // Visual slash arc — half-circle facing the player's swing direction.
    const slash = new Graphics();
    const arcStart = facing === 1 ? -Math.PI / 2 : Math.PI / 2;
    const arcEnd = arcStart + Math.PI;
    slash.arc(0, 0, range, arcStart, arcEnd);
    slash.stroke({ color: isCrit ? 0xffd070 : baseColor, width: isCrit ? 5 : 3, alpha: 0.85 });
    slash.position.set(px, py);
    this.projectileLayer.addChild(slash);
    const start = performance.now();
    const dur = 200;
    const animate = () => {
      const t = (performance.now() - start) / dur;
      if (t >= 1) {
        slash.parent?.removeChild(slash);
        slash.destroy();
        return;
      }
      slash.alpha = 0.85 * (1 - t);
      slash.scale.set(1 + t * 0.15);
      requestAnimationFrame(animate);
    };
    animate();
    return anyHit || true; // tick cooldown even if no hit, so atkspd is consistent
  }

  private fireProjectile(target: EnemyEntity): void {
    const px = this.player.x;
    const py = this.player.y;
    const dx = target.x - px;
    const dy = target.y - py;
    const baseAngle = Math.atan2(dy, dx);
    const w = this.opts.weapon;
    const projCount = w.projectiles || 1;
    const spread = w.spread ?? (projCount > 1 ? 0.3 : 0);
    const projUrl = PROJECTILE_BY_WEAPON[w.id];
    const baseColor = parseInt(w.color.replace('#', ''), 16);

    const now = performance.now();
    // Riposte (#154 — Duelist) + Hunter's Mark (#155) — buffed-shot mults.
    let activeMult = 1;
    let forceCrit = false;
    if (!this.riposteUsed && this.riposteArmedUntilMs > now) {
      activeMult *= 5;
      forceCrit = true;
      this.riposteUsed = true;
      this.riposteArmedUntilMs = 0;
    }
    // If this shot is a Hunter's Mark auto-aim shot at the marked enemy, add +50%.
    if (this.markedEnemy && target === this.markedEnemy) activeMult *= 1.5;

    for (let i = 0; i < projCount; i++) {
      const offset = projCount === 1 ? 0 : (i / (projCount - 1) - 0.5) * spread;
      const angle = baseAngle + offset;
      const isCrit = forceCrit || Math.random() < this.stats.crit;
      const speed = w.type === 'magic' ? 6 : 9;
      const dmg = (w.dmg + this.stats.dmg) * this.stats.dmgMult * activeMult * (isCrit ? 2 : 1);

      // Pierce kill streak (#158 — Momentum) — within window after a kill,
      // shots get +killStreakPierce extra pierces.
      const streakPierce =
        this.streakPierceUntilMs > now ? this.spellFx.killStreakPierce : 0;
      const proj: ProjectileEntity = {
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        dmg,
        crit: isCrit,
        life: w.type === 'melee' ? 0.15 : 1.5,
        pierce: this.stats.pierce + streakPierce,
        hit: new Set(),
      };

      if (projUrl) {
        // Real sprite — rotate to travel direction, tint by crit
        const sprite = new Sprite(Texture.from(projUrl));
        sprite.anchor.set(0.5);
        // Source sprites are 32x32; scale down to ~16-22px screen size
        sprite.scale.set(isCrit ? 1.3 : 1.0);
        sprite.rotation = angle;
        sprite.tint = isCrit ? 0xffd070 : 0xffffff;
        // Magic projectiles get a subtle additive glow via the weapon color
        if (w.type === 'magic') sprite.tint = isCrit ? 0xffd070 : baseColor;
        this.projectileLayer.addChild(sprite);
        proj.sprite = sprite;
      } else {
        // Graphics fallback — small bullet for ranged guns (smaller than the
        // legacy melee slash arc), wider arc for melee weapons.
        const g = new Graphics();
        if (w.type === 'ranged') {
          // Bullet — bright dot with subtle glow
          const r = isCrit ? 4 : 3;
          g.circle(0, 0, r + 2);
          g.fill({ color: isCrit ? 0xffd070 : baseColor, alpha: 0.35 });
          g.circle(0, 0, r);
          g.fill({ color: isCrit ? 0xfff0a0 : 0xffffff, alpha: 1 });
        } else {
          // Melee slash arc — keep the larger circle
          g.circle(0, 0, isCrit ? 8 : 6);
          g.fill({ color: isCrit ? 0xff9050 : baseColor, alpha: 0.85 });
        }
        this.projectileLayer.addChild(g);
        proj.graphics = g;
      }

      this.projectiles.push(proj);
    }
  }

  /**
   * Critical Chain (#157) — when a crit lands, deal critChainPct × dealt to the
   * nearest other living enemy within 200px. Pure damage tick, no projectile.
   */
  private tryCritChain(source: EnemyEntity, dealt: number): void {
    const maxD2 = 200 * 200;
    let best: EnemyEntity | null = null;
    let bestD = maxD2;
    for (const e of this.enemies) {
      if (e === source || e.hp <= 0) continue;
      const dx = e.x - source.x;
      const dy = e.y - source.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return;
    const chainDmg = dealt * this.spellFx.critChainPct;
    best.hp -= chainDmg;
    best.flashTimer = 0.1;
    best.sprite.tint = 0xff80ff;
    this.spawnHit(best.x, best.y - 10, Math.round(chainDmg).toString(), 'crit');
    this.spawnBloodSplash(best.x, best.y);
    // Visual zap line from source to chained target.
    const zap = new Graphics();
    zap.moveTo(source.x, source.y);
    zap.lineTo(best.x, best.y);
    zap.stroke({ color: 0xff80ff, width: 2, alpha: 0.85 });
    this.projectileLayer.addChild(zap);
    setTimeout(() => { zap.parent?.removeChild(zap); zap.destroy(); }, 110);
  }

  private findNearestEnemy(maxDist: number): EnemyEntity | null {
    let best: EnemyEntity | null = null;
    let bestD = maxDist * maxDist;
    for (const e of this.enemies) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  // ---------- Torch flicker ----------
  private tickLightFlicker(dt: number): void {
    if (!this.lightSprite) return;
    this.lightFlickerT += dt;
    // 1.0 ± ~6% flicker via two stacked sin waves
    const flick =
      1 + Math.sin(this.lightFlickerT * 7.3) * 0.04 + Math.sin(this.lightFlickerT * 3.1) * 0.02;
    const baseScale = this.lightSprite.scale.x;
    // Use a distinct field on the sprite so flicker doesn't compound; layoutLighting
    // sets the underlying scale, flicker just oscillates around it.
    if (!('__baseScale' in (this.lightSprite as unknown as { __baseScale?: number }))) {
      (this.lightSprite as unknown as { __baseScale: number }).__baseScale = baseScale;
    }
    const base = (this.lightSprite as unknown as { __baseScale: number }).__baseScale;
    this.lightSprite.scale.set(base * flick);
  }

  // ---------- Ambient particle spawning ----------
  private maybeAmbient(now: number): void {
    const interval = 90; // ms between ambient spawns
    if (now - this.lastAmbientSpawnMs < interval) return;
    this.lastAmbientSpawnMs = now;
    // Skip ambient when we're already over the soft cap — leaves headroom
    // for combat bursts (level-up, crit sparks, blood) without forcing
    // them to drop. They have their own hard cap in pushParticle.
    if (this.particles.length > 220) return;
    this.spawnAmbient();
  }

  // ---------- Spawn ----------
  private maybeSpawn(now: number, elapsedS: number): void {
    // Story-mode room layout (#145) overrides time-based spawning entirely.
    if (this.zones.length > 0) {
      this.tickZones(now, elapsedS);
      return;
    }
    if (now - this.lastSpawnMs < this.spawnIntervalMs) return;
    this.spawnEnemy(elapsedS);
    this.lastSpawnMs = now;
    // Floor was 220ms (~4.5 enemies/sec by 60s). Bumped to 280ms (~3.6/sec)
    // to relieve overwhelming late-round density on slower / lower-DPS builds.
    this.spawnIntervalMs = Math.max(
      280,
      (1100 / this.stats.enemySpawnMult) * Math.pow(0.97, elapsedS)
    );
  }

  /**
   * Story-mode tick (#145). Detects player entering a zone, triggers that
   * zone's wave, and stages spawn over a brief interval so the player isn't
   * dumped into 14 enemies at once.
   */
  private tickZones(now: number, elapsedS: number): void {
    const px = this.player.x;
    const py = this.player.y;
    // Activate the first zone the player is currently inside (if any).
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      if (z.cleared || z.triggered) continue;
      if (isPlayerInZone(px, py, z)) {
        z.triggered = true;
        z.aliveCount = 0;
        this.activeZoneIdx = i;
        this.refreshDoorState();
        if (z.isMiniBoss) {
          this.miniBossIntroAt = now;
          this.applyShake(6, 0.4);
          this.applyScreenFlash(0.45);
          AudioManager.play('boss_intro', { volume: 0.5 });
        }
        break;
      }
    }
    // For the active zone, drip-spawn its wave at a fixed cadence.
    if (this.activeZoneIdx >= 0) {
      const z = this.zones[this.activeZoneIdx];
      if (!z.cleared) {
        const remaining = z.spawnCount - z.spawnedTotal;
        if (remaining > 0 && now - this.lastSpawnMs > 350) {
          this.spawnEnemy(elapsedS, this.activeZoneIdx);
          this.lastSpawnMs = now;
          z.aliveCount++;
          z.spawnedTotal++;
        }
        // Clear check — wave fully spawned AND none alive in this zone.
        if (z.spawnedTotal >= z.spawnCount && this.enemies.every((e) => e.spawnZoneIdx !== this.activeZoneIdx)) {
          z.cleared = true;
          AudioManager.play('boss_defeat', { volume: 0.6 });
          this.applyScreenFlash(0.3);
          // Bargain offer (#167) — fires only on non-final, non-mini-boss
          // rooms. The final room ends the raid, the mini-boss has its own
          // payoff (cash drop), so neither offers a bargain.
          const isLast = this.activeZoneIdx === this.zones.length - 1;
          if (!isLast && !z.isMiniBoss) {
            this.bargainPending = true;
          }
          // Was that the final zone? Trigger raid complete.
          if (this.zones.every((zz) => zz.cleared) && !this.allZonesCleared) {
            this.allZonesCleared = true;
          }
          this.activeZoneIdx = -1;
          this.refreshDoorState();
        }
      }
    }
  }

  private spawnEnemy(elapsedS: number, zoneIdx?: number): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    let px: number;
    let py: number;
    if (zoneIdx !== undefined && this.zones[zoneIdx]) {
      // Story-mode (#145): spawn at the zone's perimeter so enemies emerge
      // from the room's edges, not from off-screen.
      const z = this.zones[zoneIdx];
      const edge = Math.floor(Math.random() * 4);
      const u = (Math.random() - 0.5) * 2;
      if (edge === 0)      { px = z.cx + z.hw;      py = z.cy + u * z.hh; }
      else if (edge === 1) { px = z.cx - z.hw;      py = z.cy + u * z.hh; }
      else if (edge === 2) { px = z.cx + u * z.hw;  py = z.cy + z.hh; }
      else                 { px = z.cx + u * z.hw;  py = z.cy - z.hh; }
    } else {
      const dist = Math.max(w, h) * 0.6 + Math.random() * 60;
      const angle = Math.random() * Math.PI * 2;
      px = this.player.x + Math.cos(angle) * dist;
      py = this.player.y + Math.sin(angle) * dist;
    }

    let availTier: number;
    let proto: EnemyTypeDef;
    let forceElite = false;
    if (zoneIdx !== undefined && this.zones[zoneIdx]) {
      // Story-mode tier picked by zone, not elapsed time.
      availTier = this.zones[zoneIdx].maxTier;
      const z = this.zones[zoneIdx];
      if (z.isMiniBoss) {
        // Mini-boss zone (#185) — alternate the elite by raid number so
        // raid 2 fights the BoneKnight, raid 3 fights the Lich.
        const eliteId = ((this.opts.raidNumber ?? 1) % 2 === 0) ? 'boneKnight' : 'lichAcolyte';
        proto = ENEMY_TYPES.find((e) => e.id === eliteId)!;
        forceElite = true;
      } else {
        const eliteChance = availTier >= 4 ? 0.10 : 0;
        if (Math.random() < eliteChance) {
          const elites = ENEMY_TYPES.filter((e) => e.tier === 5);
          proto = elites[Math.floor(Math.random() * elites.length)];
        } else {
          const choices = ENEMY_TYPES.filter((e) => e.tier <= availTier && e.tier !== 5);
          proto = choices[Math.floor(Math.random() * choices.length)];
        }
      }
    } else {
      availTier = 1;
      if (elapsedS > 12) availTier = 2;
      if (elapsedS > 30) availTier = 3;
      if (elapsedS > 45) availTier = 4;
      const eliteChance = elapsedS > 40 ? 0.06 : 0;
      if (Math.random() < eliteChance) {
        const elites = ENEMY_TYPES.filter((e) => e.tier === 5);
        proto = elites[Math.floor(Math.random() * elites.length)];
      } else {
        const choices = ENEMY_TYPES.filter((e) => e.tier <= availTier && e.tier !== 5);
        proto = choices[Math.floor(Math.random() * choices.length)];
      }
    }

    const url = ENEMY_SPRITE_BY_TYPE[proto.sprite];
    const tex = Texture.from(url);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    // Enemies should be at least player-size at tier 1, larger at higher tiers.
    // Player renders at ~64px (32 source * 2.0 scale). proto.size / 7 gives
    // zombie ~64px (player size), tank ~100px, reaper ~110px, all visibly
    // smaller than the boss (~147px).
    sprite.scale.set(proto.size / 7);
    this.worldLayer.addChild(sprite);

    // Mini-boss (#185) — beefier hp + bigger sprite + cash bonus.
    const eliteMult = forceElite ? 1.6 : 1;
    if (forceElite) sprite.scale.set((proto.size / 7) * 1.25);
    const hp = proto.hp * this.stats.enemyHpMult * (1 + elapsedS * 0.05) * eliteMult;
    const enemySpd = proto.spd * this.stats.enemySpdMult;
    const now = performance.now();
    this.enemies.push({
      x: px,
      y: py,
      hp,
      hpMax: hp,
      spd: enemySpd,
      baseSpd: enemySpd,
      dmg: proto.dmg + this.stats.enemyDmgBonus,
      r: proto.size * (forceElite ? 1.15 : 1),
      cash: forceElite ? 25 : 1 + Math.floor(proto.tier * 1.5),
      sprite,
      flashTimer: 0,
      proto,
      isBoss: false,
      lastShotMs: 0,
      slowUntilMs: 0,
      spawnZoneIdx: zoneIdx,
      isElite: forceElite,
      nextCleaveMs: forceElite && proto.id === 'boneKnight' ? now + 2500 : undefined,
      nextSummonMs: forceElite && proto.id === 'lichAcolyte' ? now + 4000 : undefined,
    });
  }

  private spawnBoss(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const dist = Math.max(w, h) * 0.5;
    // Spawn directly above the player so the player sees the boss enter
    const px = this.player.x;
    const py = this.player.y - dist;

    const url = ENEMY_SPRITE_BY_TYPE['boss'];
    const tex = Texture.from(url);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    // Boss visibly larger than any tier-4 enemy (~110px)
    sprite.scale.set(FINAL_BOSS.size / 12);
    this.worldLayer.addChild(sprite);

    const hp = FINAL_BOSS.hp * this.stats.enemyHpMult;
    const bossSpd = FINAL_BOSS.spd * this.stats.enemySpdMult;
    const boss: EnemyEntity = {
      x: px,
      y: py,
      hp,
      hpMax: hp,
      spd: bossSpd,
      baseSpd: bossSpd,
      dmg: FINAL_BOSS.dmg + this.stats.enemyDmgBonus,
      r: FINAL_BOSS.size,
      cash: 200,
      sprite,
      flashTimer: 0,
      // Synthesize a fake proto for type compatibility — only `tier` and `sprite` get read elsewhere
      proto: {
        id: 'death',
        hp: FINAL_BOSS.hp,
        spd: FINAL_BOSS.spd,
        dmg: FINAL_BOSS.dmg,
        color: FINAL_BOSS.color,
        size: FINAL_BOSS.size,
        tier: 5,
        sprite: 'boss',
      },
      isBoss: true,
      lastShotMs: 0,
      slowUntilMs: 0,
    };
    this.boss = boss;
    this.bossEnraged = false;
    this.bossNextAoeMs = 0;
    this.enemies.push(boss);

    // Cinematic intro flourish — bg pulse + camera shake
    this.applyShake(8, 0.6);
    this.applyZoomPulse(1.06, 0.4);
    AudioManager.play('boss_intro');
  }

  private updateEnemies(dt: number): void {
    const px = this.player.x;
    const py = this.player.y;
    const now = performance.now();
    for (const e of this.enemies) {
      // Restore speed when frost slow expires.
      if (e.slowUntilMs > 0 && now > e.slowUntilMs) {
        e.spd = e.baseSpd;
        e.slowUntilMs = 0;
      }
      const dx = px - e.x;
      const dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      // Ranged enemies brake when in firing range — keep their distance and shoot.
      const ranged = e.proto.ranged;
      const wantsToHold = ranged && d < ranged.range * 0.9 && d > e.r + 60;
      const moveMult = wantsToHold ? 0.15 : 1.0;
      e.x += (dx / d) * e.spd * dt * 60 * moveMult;
      e.y += (dy / d) * e.spd * dt * 60 * moveMult;
      this.resolveObstacleCollision(e, e.r);
      this.resolveWallCollision(e, e.r);

      e.sprite.scale.x = Math.abs(e.sprite.scale.x) * (dx > 0 ? 1 : -1);

      if (e.flashTimer > 0) {
        e.flashTimer -= dt;
      }

      // Ranged fire — when in range and cooldown elapsed, lob a projectile at player.
      if (ranged && d < ranged.range && now - e.lastShotMs > ranged.cooldownMs) {
        e.lastShotMs = now;
        this.spawnEnemyProjectile(e, px, py, ranged.projectileSpd, ranged.projectileColor, e.dmg);
      }

      const r = e.r + 12;
      if (dx * dx + dy * dy < r * r) {
        // Smoke Bomb (#155 — Rogue): first 2s of the 4s buff window grant invuln.
        // smokeBombUntilMs = castTime + 4000; invuln window = castTime..castTime+2000.
        const buffStart = this.smokeBombUntilMs - 4000;
        if (this.smokeBombUntilMs > now && now < buffStart + 2000) continue;
        const taken = Math.max(1, e.dmg - this.effectiveDef()) * dt;
        const wasHp = this.player.hp;
        this.player.hp -= taken;
        if (Math.floor(wasHp) !== Math.floor(this.player.hp)) this.reachKillBonus = 0;
        // (#180) Track most recent damage source for the gameover screen.
        this.lastDamageSource = e.isBoss ? 'Death Itself' : this.enemyDisplayName(e.proto.id);
        // Player damage juice — only spawn the popup on a meaningful hit chunk
        // (otherwise we'd spawn one every frame of contact)
        if (Math.floor(wasHp) !== Math.floor(this.player.hp) && (wasHp - this.player.hp) >= 1) {
          this.player.flashTimer = 0.12;
          this.applyShake(4, 0.25);
          this.applyScreenFlash(0.55);
          this.applyHitStop(0.05);
          AudioManager.play('player_hurt');
          // One popup per second of contact
          if (Math.floor(performance.now() / 600) !== Math.floor((performance.now() - 50) / 600)) {
            this.spawnHit(this.player.x, this.player.y - 18, `-${Math.ceil(wasHp - this.player.hp)}`, 'player-damage');
          }
        }
      }

      // Elite AI ticks (#183/#184) — only fire for mini-boss elites.
      if (e.isElite) {
        if (e.proto.id === 'boneKnight' && e.nextCleaveMs !== undefined && now >= e.nextCleaveMs) {
          this.eliteCleave(e);
          e.nextCleaveMs = now + 4500;
        }
        if (e.proto.id === 'lichAcolyte' && e.nextSummonMs !== undefined && now >= e.nextSummonMs) {
          this.eliteSummon(e);
          e.nextSummonMs = now + 6000;
        }
      }
    }
  }

  /**
   * BoneKnight cleave (#183) — telegraph red ring for 700ms, then deal AOE
   * damage to player if still inside. Smaller radius than boss pulse so the
   * player has room to dodge sideways.
   */
  private eliteCleave(elite: EnemyEntity): void {
    const RADIUS = 130;
    const TELEGRAPH_MS = 700;
    const startedAt = performance.now();
    // Telegraph ring (red, fills slowly).
    const ring = new Graphics();
    ring.position.set(elite.x, elite.y);
    this.particleLayer.addChild(ring);
    const animate = () => {
      const t = (performance.now() - startedAt) / TELEGRAPH_MS;
      if (t >= 1) {
        ring.clear();
        ring.parent?.removeChild(ring);
        ring.destroy();
        return;
      }
      ring.clear();
      ring.circle(0, 0, RADIUS);
      ring.fill({ color: 0xc02020, alpha: 0.18 + t * 0.18 });
      ring.circle(0, 0, RADIUS);
      ring.stroke({ color: 0xff4040, width: 3, alpha: 0.85 });
      requestAnimationFrame(animate);
    };
    animate();
    // Resolve damage at the END of the telegraph window — gives the player
    // time to walk out before impact.
    setTimeout(() => {
      if (elite.hp <= 0) return;
      const dx = this.player.x - elite.x;
      const dy = this.player.y - elite.y;
      if (dx * dx + dy * dy < RADIUS * RADIUS) {
        const taken = Math.max(1, elite.dmg * 1.4 - this.effectiveDef());
        this.player.hp -= taken;
        this.reachKillBonus = 0;
        this.lastDamageSource = 'Bone Knight Cleave';
        this.player.flashTimer = 0.15;
        this.applyShake(7, 0.35);
        this.applyScreenFlash(0.55);
        AudioManager.play('player_hurt');
        this.spawnHit(this.player.x, this.player.y - 18, `-${Math.ceil(taken)}`, 'player-damage');
      }
      // Impact ring (white flash).
      const impact = new Graphics();
      impact.circle(0, 0, RADIUS);
      impact.stroke({ color: 0xffffff, width: 5, alpha: 0.9 });
      impact.position.set(elite.x, elite.y);
      this.particleLayer.addChild(impact);
      const t0 = performance.now();
      const fade = () => {
        const t = (performance.now() - t0) / 250;
        if (t >= 1) { impact.parent?.removeChild(impact); impact.destroy(); return; }
        impact.alpha = 0.9 * (1 - t);
        requestAnimationFrame(fade);
      };
      fade();
    }, TELEGRAPH_MS);
  }

  /**
   * Lich summon (#184) — spawn 1-2 small adds (skeleton/bat) near the elite,
   * inheriting its zone so they count toward zone clear.
   */
  private eliteSummon(elite: EnemyEntity): void {
    const count = 1 + (Math.random() < 0.5 ? 1 : 0);
    const addId = Math.random() < 0.5 ? 'skeleton' : 'bat';
    const proto = ENEMY_TYPES.find((e) => e.id === addId)!;
    for (let n = 0; n < count; n++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 40;
      const sx = elite.x + Math.cos(angle) * dist;
      const sy = elite.y + Math.sin(angle) * dist;
      const url = ENEMY_SPRITE_BY_TYPE[proto.sprite];
      const sprite = new Sprite(Texture.from(url));
      sprite.anchor.set(0.5);
      sprite.scale.set(proto.size / 7);
      this.worldLayer.addChild(sprite);
      const hp = proto.hp * this.stats.enemyHpMult;
      const spd = proto.spd * this.stats.enemySpdMult;
      this.enemies.push({
        x: sx, y: sy, hp, hpMax: hp, spd, baseSpd: spd,
        dmg: proto.dmg + this.stats.enemyDmgBonus,
        r: proto.size, cash: 1, sprite, flashTimer: 0, proto,
        isBoss: false, lastShotMs: 0, slowUntilMs: 0,
        spawnZoneIdx: elite.spawnZoneIdx,
      });
    }
    // Purple summon flash on the elite.
    const flash = new Graphics();
    flash.circle(0, 0, 50);
    flash.fill({ color: 0x8060ff, alpha: 0.4 });
    flash.position.set(elite.x, elite.y);
    this.particleLayer.addChild(flash);
    const t0 = performance.now();
    const fade = () => {
      const t = (performance.now() - t0) / 350;
      if (t >= 1) { flash.parent?.removeChild(flash); flash.destroy(); return; }
      flash.alpha = 0.4 * (1 - t);
      flash.scale.set(1 + t * 0.5);
      requestAnimationFrame(fade);
    };
    fade();
  }

  /**
   * Aggregate every spell's conditional flags into a single object so engine
   * code reads from this.spellFx instead of iterating spells per frame (#157/#158).
   */
  private aggregateSpellFx(): void {
    for (const id of this.opts.build.spells) {
      const sp = SPELLS_BY_ID[id];
      if (!sp) continue;
      const e = sp.effect;
      if (e.fullHpHitMult)     this.spellFx.fullHpHitMult     = Math.max(this.spellFx.fullHpHitMult, e.fullHpHitMult);
      if (e.defLowHpMult)      this.spellFx.defLowHpMult      = Math.max(this.spellFx.defLowHpMult, e.defLowHpMult);
      if (e.critChainPct)      this.spellFx.critChainPct      += e.critChainPct;
      if (e.killStreakPierce)  this.spellFx.killStreakPierce  += e.killStreakPierce;
      if (e.sustainedFireRamp) this.spellFx.sustainedFireRamp += e.sustainedFireRamp;
      if (e.killStreakRange)   this.spellFx.killStreakRange   += e.killStreakRange;
      if (e.killHealPct)       this.spellFx.killHealPct       += e.killHealPct;
    }
  }

  /** Effective defense including Tank's <30% HP surge (#157). */
  private effectiveDef(): number {
    const lowHp = this.player.hp < this.player.hpMax * 0.3;
    return lowHp ? this.stats.def * this.spellFx.defLowHpMult : this.stats.def;
  }

  /**
   * Player-cast active spell — dispatches to the build's signature ability.
   * Cooldown comes from `build.active.cooldownSec` (#152/#153).
   */
  private tryCastActive(): void {
    const now = performance.now();
    const cd = this.opts.build.active.cooldownSec * 1000;
    if (now - this.activeSpellLastCastMs < cd) return;
    this.activeSpellLastCastMs = now;
    switch (this.opts.build.active.id) {
      case 'coinFlip':    return this.castCoinFlip();
      case 'riposte':     return this.castRiposte();
      case 'earthquake':  return this.castEarthquake();
      case 'arcaneBolt':  return this.castArcaneBolt();
      case 'smokeBomb':   return this.castSmokeBomb();
      case 'huntersMark': return this.castHuntersMark();
      case 'frostNova':   return this.castFrostNova();
      case 'suppression': return this.castSuppression();
    }
  }

  /** Cooldown progress 0..1 (1 = ready). Read by HUD. */
  public getActiveSpellReady(): number {
    const cd = this.opts.build.active.cooldownSec * 1000;
    const elapsed = performance.now() - this.activeSpellLastCastMs;
    return Math.min(1, elapsed / cd);
  }

  /** Called by React after the bargain modal opens — clears the pending flag (#167). */
  public consumeBargainOffer(): void {
    this.bargainPending = false;
  }

  // -------- Build-defined active spells (#154/#155) ----------

  /** Gambler — Coin Flip: 50/50. Heads = +50% atkspd 8s; Tails = +50% range 8s. */
  private castCoinFlip(): void {
    const now = performance.now();
    this.coinFlipHeads = Math.random() < 0.5;
    this.coinFlipUntilMs = now + 8000;
    const label = this.coinFlipHeads ? 'HEADS — atkspd ↑' : 'TAILS — range ↑';
    this.spawnHit(this.player.x, this.player.y - 30, label, 'crit');
    this.applyScreenFlash(0.35);
    AudioManager.play('level_up', { volume: 0.7, pitch: this.coinFlipHeads ? 1.2 : 0.8 });
  }

  /** Duelist — Riposte: arms a 5× damage multiplier on the next hit. */
  private castRiposte(): void {
    const now = performance.now();
    this.riposteArmedUntilMs = now + 5000;
    this.riposteUsed = false;
    this.spawnHit(this.player.x, this.player.y - 30, 'RIPOSTE READY', 'crit');
    AudioManager.play('hit_heavy', { volume: 0.6 });
  }

  /** Brute — Earthquake: 200px AOE, 25 dmg + 2s stun on every enemy hit. */
  private castEarthquake(): void {
    const now = performance.now();
    const RADIUS = 200;
    const dmg = 25 + this.stats.dmg * 0.5;
    for (const e of this.enemies) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      if (dx * dx + dy * dy < RADIUS * RADIUS) {
        e.hp -= dmg;
        if (dmg > this.biggestHit) this.biggestHit = dmg;
        e.flashTimer = 0.2;
        e.spd = 0;
        e.slowUntilMs = now + 2000;
        this.spawnHit(e.x, e.y - 10, Math.round(dmg).toString(), 'damage');
      }
    }
    this.spawnExpandingRing(this.player.x, this.player.y, RADIUS, 0xa86028, 600);
    this.applyShake(12, 0.5);
    this.applyScreenFlash(0.5);
    AudioManager.play('hit_heavy', { volume: 0.9, pitch: 0.6 });
  }

  /** Arcanist — Arcane Bolt: single high-dmg projectile that pierces all in a line. */
  private castArcaneBolt(): void {
    // Fire forward in player's facing direction.
    const angle = this.player.facing === 1 ? 0 : Math.PI;
    const speed = 12;
    const dmg = 60 + this.stats.dmg;
    const g = new Graphics();
    g.circle(0, 0, 14);
    g.fill({ color: 0x80b0ff, alpha: 0.4 });
    g.circle(0, 0, 8);
    g.fill({ color: 0xeaf0ff, alpha: 1 });
    this.projectileLayer.addChild(g);
    this.projectiles.push({
      x: this.player.x,
      y: this.player.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      dmg,
      crit: true,
      life: 1.5,
      pierce: 99,
      hit: new Set(),
      graphics: g,
    });
    this.applyScreenFlash(0.3);
    AudioManager.play('level_up', { volume: 0.8, pitch: 1.4 });
  }

  /** Rogue — Smoke Bomb: 2s untargetable + 4s atkspd ramp. */
  private castSmokeBomb(): void {
    const now = performance.now();
    this.smokeBombUntilMs = now + 4000;
    this.spawnHit(this.player.x, this.player.y - 30, 'VANISHED', 'heal');
    this.spawnExpandingRing(this.player.x, this.player.y, 90, 0x808080, 500);
    AudioManager.play('gem_pickup', { volume: 0.7, pitch: 0.6 });
  }

  /** Huntsman — Hunter's Mark: marks nearest enemy; next 3 shots auto-aim + bonus dmg. */
  private castHuntersMark(): void {
    const target = this.findNearestEnemy(800);
    if (!target) {
      this.activeSpellLastCastMs = -Infinity; // refund — no enemy to mark
      return;
    }
    this.markedEnemy = target;
    this.huntersMarkShotsLeft = 3;
    this.spawnHit(target.x, target.y - 30, 'MARKED', 'crit');
    AudioManager.play('hit_heavy', { volume: 0.5, pitch: 1.3 });
  }

  /** Witch — Frost Nova: 200px AOE damage + slow (signature-since-iter1 spell). */
  private castFrostNova(): void {
    const now = performance.now();
    const RADIUS = 200;
    const dmg = 15 + this.stats.dmg * 0.5;
    const slowDuration = 3000;
    for (const e of this.enemies) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      if (dx * dx + dy * dy < RADIUS * RADIUS) {
        e.hp -= dmg;
        if (dmg > this.biggestHit) this.biggestHit = dmg;
        e.flashTimer = 0.18;
        e.spd = e.baseSpd * 0.4;
        e.slowUntilMs = now + slowDuration;
        this.spawnHit(e.x, e.y - 10, Math.round(dmg).toString(), 'damage');
      }
    }
    this.spawnExpandingRing(this.player.x, this.player.y, RADIUS, 0x80c8ff, 500);
    this.applyShake(5, 0.25);
    this.applyScreenFlash(0.3);
    AudioManager.play('level_up', { volume: 0.7, pitch: 0.85 });
  }

  /** Soldier — Suppression: 300px forward cone, 30 dmg + 50% slow 3s. */
  private castSuppression(): void {
    const now = performance.now();
    const RANGE = 300;
    const dmg = 30 + this.stats.dmg * 0.7;
    const facing = this.player.facing;
    for (const e of this.enemies) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const inFront = (facing === 1 && dx >= -20) || (facing === -1 && dx <= 20);
      if (!inFront) continue;
      if (Math.abs(dy) > 80) continue; // narrow horizontal cone
      if (dx * dx + dy * dy > RANGE * RANGE) continue;
      e.hp -= dmg;
      if (dmg > this.biggestHit) this.biggestHit = dmg;
      e.flashTimer = 0.15;
      e.spd = e.baseSpd * 0.5;
      e.slowUntilMs = now + 3000;
      this.spawnHit(e.x, e.y - 10, Math.round(dmg).toString(), 'crit');
    }
    // Visual: forward beam line
    const beam = new Graphics();
    const x0 = this.player.x;
    const x1 = this.player.x + facing * RANGE;
    beam.moveTo(x0, this.player.y);
    beam.lineTo(x1, this.player.y);
    beam.stroke({ color: 0xffd070, width: 14, alpha: 0.85 });
    beam.moveTo(x0, this.player.y);
    beam.lineTo(x1, this.player.y);
    beam.stroke({ color: 0xfffce0, width: 4, alpha: 1 });
    this.projectileLayer.addChild(beam);
    const t0 = performance.now();
    const dur = 350;
    const animate = () => {
      const t = (performance.now() - t0) / dur;
      if (t >= 1) {
        beam.parent?.removeChild(beam);
        beam.destroy();
        return;
      }
      beam.alpha = 1 - t;
      requestAnimationFrame(animate);
    };
    animate();
    this.applyShake(6, 0.3);
    AudioManager.play('hit_heavy', { volume: 0.7, pitch: 1.1 });
  }

  /** Helper — animated expanding ring at world position, used by AOE actives. */
  private spawnExpandingRing(x: number, y: number, radius: number, color: number, durationMs: number): void {
    const ring = new Graphics();
    ring.position.set(x, y);
    this.particleLayer.addChild(ring);
    const t0 = performance.now();
    const animate = () => {
      const t = (performance.now() - t0) / durationMs;
      if (t >= 1) {
        ring.parent?.removeChild(ring);
        ring.destroy();
        return;
      }
      ring.clear();
      ring.circle(0, 0, 30 + (radius - 30) * t);
      ring.stroke({ color, width: 5 * (1 - t * 0.5), alpha: 0.85 * (1 - t) });
      requestAnimationFrame(animate);
    };
    animate();
  }

  /**
   * Boss-specific behavior — phase transitions, periodic shadowbolts,
   * AOE shadow pulse when enraged.
   */
  private updateBoss(now: number): void {
    const boss = this.boss;
    if (!boss || boss.hp <= 0) return;

    // Phase transition at 50% HP — bigger, faster, scarier.
    if (!this.bossEnraged && boss.hp / boss.hpMax <= 0.5) {
      this.bossEnraged = true;
      boss.spd *= 1.6;
      boss.sprite.scale.set(boss.sprite.scale.x * 1.15);
      // Telegraph the rage with a screen flash + shake.
      this.applyShake(8, 0.5);
      this.applyScreenFlash(0.6);
      AudioManager.play('boss_intro', { volume: 1 });
      this.bossNextAoeMs = now + 1000;
    }

    // Boss fires shadowbolts at the player every 2.5s (1.4s when enraged).
    const shotCd = this.bossEnraged ? 1400 : 2500;
    if (now - boss.lastShotMs > shotCd) {
      boss.lastShotMs = now;
      this.spawnEnemyProjectile(boss, this.player.x, this.player.y, 260, 0x803060, boss.dmg * 0.6);
      // Phase-2 boss fans 3 bolts in a small spread.
      if (this.bossEnraged) {
        const spread = 0.3;
        const dx = this.player.x - boss.x;
        const dy = this.player.y - boss.y;
        const a = Math.atan2(dy, dx);
        const baseSpd = 260;
        const cosA1 = Math.cos(a + spread), sinA1 = Math.sin(a + spread);
        const cosA2 = Math.cos(a - spread), sinA2 = Math.sin(a - spread);
        this.spawnEnemyProjectile(
          boss, boss.x + cosA1 * 20, boss.y + sinA1 * 20,
          baseSpd, 0x803060, boss.dmg * 0.5
        );
        this.spawnEnemyProjectile(
          boss, boss.x + cosA2 * 20, boss.y + sinA2 * 20,
          baseSpd, 0x803060, boss.dmg * 0.5
        );
      }
    }

    // Phase-2 AOE pulse — every 5s, deal damage in a radius around the boss.
    if (this.bossEnraged && now >= this.bossNextAoeMs) {
      this.bossNextAoeMs = now + 5000;
      this.bossAoePulse(boss);
    }
  }

  private bossAoePulse(boss: EnemyEntity): void {
    const RADIUS = 180;
    // Visual ring — quick expanding circle at boss position.
    const ring = new Graphics();
    ring.circle(0, 0, 20);
    ring.stroke({ color: 0xc04080, width: 4, alpha: 0.85 });
    ring.position.set(boss.x, boss.y);
    this.particleLayer.addChild(ring);
    const ringStart = performance.now();
    const ringDur = 600;
    const animate = () => {
      const t = (performance.now() - ringStart) / ringDur;
      if (t >= 1) {
        ring.parent?.removeChild(ring);
        ring.destroy();
        return;
      }
      ring.clear();
      ring.circle(0, 0, 20 + (RADIUS - 20) * t);
      ring.stroke({ color: 0xc04080, width: 4 * (1 - t * 0.6), alpha: 0.85 * (1 - t) });
      requestAnimationFrame(animate);
    };
    animate();
    // Damage if player inside radius.
    const dx = this.player.x - boss.x;
    const dy = this.player.y - boss.y;
    if (dx * dx + dy * dy < RADIUS * RADIUS) {
      const taken = Math.max(1, boss.dmg * 1.2 - this.effectiveDef());
      this.player.hp -= taken;
      this.reachKillBonus = 0;
      this.lastDamageSource = "Death's Shadow Pulse";
      this.player.flashTimer = 0.18;
      this.applyShake(10, 0.5);
      this.applyScreenFlash(0.7);
      this.applyHitStop(0.08);
      AudioManager.play('player_hurt');
      this.spawnHit(this.player.x, this.player.y - 18, `-${Math.ceil(taken)}`, 'player-damage');
    }
  }

  /** Pretty-print an enemy id for the post-death summary (#182). */
  private enemyDisplayName(id: string): string {
    const map: Record<string, string> = {
      zombie: 'Zombie',
      bat: 'Bat',
      skeleton: 'Skeleton',
      ghoul: 'Ghoul',
      wraith: 'Wraith',
      tank: 'Bone Dragon',
      imp: 'Imp',
      reaper: 'Reaper',
      archer: 'Skeleton Archer',
      fireImp: 'Fire Imp',
      lichAcolyte: 'Lich Acolyte',
      boneKnight: 'Bone Knight',
      death: 'Death Itself',
    };
    return map[id] ?? id;
  }

  /** Build the run-summary including post-death stats (#180/#181/#182). */
  private buildSummary(elapsedS: number, killedByBoss = false): DungeonRunSummary {
    let favName = '—';
    let favCount = 0;
    for (const [id, n] of Object.entries(this.killCounts)) {
      if (n > favCount) {
        favCount = n;
        favName = this.enemyDisplayName(id);
      }
    }
    return {
      time: Math.floor(elapsedS),
      kills: this.kills,
      level: this.level,
      cash: this.cashThisRun,
      lastDamageSource: killedByBoss ? '—' : this.lastDamageSource,
      biggestHit: Math.round(this.biggestHit),
      favoriteKill: favCount > 0 ? `${favName} (×${favCount})` : '—',
    };
  }

  /** Spawn an enemy → player projectile (Graphics circle). */
  private spawnEnemyProjectile(
    e: EnemyEntity,
    targetX: number,
    targetY: number,
    speed: number,
    color: number,
    dmg: number
  ): void {
    const dx = targetX - e.x;
    const dy = targetY - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const g = new Graphics();
    g.circle(0, 0, 5);
    g.fill({ color });
    g.circle(0, 0, 8);
    g.stroke({ color, alpha: 0.4, width: 1.5 });
    g.position.set(e.x, e.y);
    this.projectileLayer.addChild(g);
    this.enemyProjectiles.push({
      x: e.x,
      y: e.y,
      vx: (dx / d) * speed,
      vy: (dy / d) * speed,
      dmg,
      life: 4,
      graphics: g,
      sourceName: e.isBoss ? "Death's Shadowbolt" : `${this.enemyDisplayName(e.proto.id)}'s Shot`,
    });
  }

  private updateEnemyProjectiles(dt: number): void {
    const px = this.player.x;
    const py = this.player.y;
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.graphics.position.set(p.x, p.y);
      // Hit player?
      const dx = px - p.x;
      const dy = py - p.y;
      const hitR = 18;
      if (dx * dx + dy * dy < hitR * hitR) {
        // Smoke Bomb invuln window (first 2s of 4s buff) — projectiles vanish.
        const now = performance.now();
        const buffStart = this.smokeBombUntilMs - 4000;
        const isInvuln = this.smokeBombUntilMs > now && now < buffStart + 2000;
        if (isInvuln) {
          this.projectileLayer.removeChild(p.graphics);
          p.graphics.destroy();
          this.enemyProjectiles.splice(i, 1);
          continue;
        }
        const taken = Math.max(1, p.dmg - this.effectiveDef());
        this.player.hp -= taken;
        this.reachKillBonus = 0;
        this.lastDamageSource = p.sourceName;
        this.player.flashTimer = 0.12;
        this.applyShake(4, 0.25);
        this.applyScreenFlash(0.55);
        this.applyHitStop(0.05);
        AudioManager.play('player_hurt');
        this.spawnHit(this.player.x, this.player.y - 18, `-${Math.ceil(taken)}`, 'player-damage');
        this.projectileLayer.removeChild(p.graphics);
        p.graphics.destroy();
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
      if (p.life <= 0) {
        this.projectileLayer.removeChild(p.graphics);
        p.graphics.destroy();
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx * dt * 60;
      pr.y += pr.vy * dt * 60;
      pr.life -= dt;
      if (pr.life <= 0) {
        this.removeProjectile(i);
        continue;
      }

      let consumed = false;
      for (let j = 0; j < this.enemies.length; j++) {
        const e = this.enemies[j];
        if (pr.hit.has(e)) continue;
        const dx = e.x - pr.x;
        const dy = e.y - pr.y;
        if (dx * dx + dy * dy < (e.r + 4) * (e.r + 4)) {
          // Overkill (#157) — full-HP enemy gets the multiplier on first hit.
          const overkill = e.hp >= e.hpMax && this.spellFx.fullHpHitMult > 1;
          const dealt = overkill ? pr.dmg * this.spellFx.fullHpHitMult : pr.dmg;
          e.hp -= dealt;
          if (dealt > this.biggestHit) this.biggestHit = dealt; // (#181)
          e.flashTimer = 0.12;
          e.sprite.tint = pr.crit ? 0xffd070 : 0xffffff;
          this.spawnHit(e.x, e.y - 10, Math.round(dealt).toString(), pr.crit || overkill ? 'crit' : 'damage');
          this.spawnBloodSplash(e.x, e.y);
          // Critical Chain (#157) — crits ricochet to nearest other enemy.
          if (pr.crit && this.spellFx.critChainPct > 0) this.tryCritChain(e, dealt);
          // SFX
          AudioManager.play(
            e.isBoss ? 'hit_heavy' : pr.crit ? 'hit_heavy' : pr.dmg > 15 ? 'hit_med' : 'hit_light'
          );
          if (pr.crit) {
            this.applyShake(2.5, 0.18);
            this.applyZoomPulse(1.04, 0.18);
            this.applyHitStop(0.04);
            this.spawnCritSparks(e.x, e.y);
          }
          if (e.isBoss) {
            this.applyHitStop(0.05);
          }
          if (this.stats.lifesteal > 0) {
            const heal = dealt * this.stats.lifesteal;
            const next = Math.min(this.player.hpMax, this.player.hp + heal);
            const actual = next - this.player.hp;
            this.player.hp = next;
            if (actual >= 1) {
              this.spawnHit(this.player.x, this.player.y - 18, `+${Math.ceil(actual)}`, 'heal');
            }
          }
          pr.hit.add(e);
          if (pr.pierce > 0) {
            pr.pierce--;
          } else {
            this.removeProjectile(i);
            consumed = true;
            break;
          }
        }
      }
      if (consumed) continue;
    }
  }

  private removeProjectile(i: number): void {
    const pr = this.projectiles[i];
    const display = pr.sprite ?? pr.graphics;
    if (display) {
      this.projectileLayer.removeChild(display);
      display.destroy();
    }
    this.projectiles.splice(i, 1);
  }

  private cullDeadEnemies(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp > 0) {
        if (e.flashTimer <= 0) e.sprite.tint = 0xffffff;
        continue;
      }
      this.kills++;
      // (#181) Track per-enemy-type kill count for "favorite kill" stat.
      const killKey = e.isBoss ? 'death' : e.proto.id;
      this.killCounts[killKey] = (this.killCounts[killKey] ?? 0) + 1;
      // Conditional spell on-kill triggers (#158).
      if (this.spellFx.killStreakPierce > 0) {
        this.streakPierceUntilMs = performance.now() + 600;
      }
      if (this.spellFx.killStreakRange > 0) {
        const cap = 200;
        this.reachKillBonus = Math.min(cap, this.reachKillBonus + this.spellFx.killStreakRange);
      }
      if (this.spellFx.killHealPct > 0) {
        const heal = this.player.hpMax * this.spellFx.killHealPct;
        const next = Math.min(this.player.hpMax, this.player.hp + heal);
        const actual = next - this.player.hp;
        this.player.hp = next;
        if (actual >= 1) {
          this.spawnHit(this.player.x, this.player.y - 18, `+${Math.ceil(actual)}`, 'heal');
        }
      }
      const cashGain = Math.max(1, Math.round(e.cash * this.opts.cashMult));
      this.cashThisRun += cashGain;
      // Visible feedback for the cash drop — a small gold "+$N" floats up
      // from where the enemy died, paired with a soft pickup chime.
      this.spawnHit(e.x, e.y - 14, `+$${cashGain}`, 'cash');
      AudioManager.play('gem_pickup', { volume: 0.35, pitch: 1.3 });
      // Drop XP gem
      const gemG = new Graphics();
      gemG.poly([0, -6, 6, 0, 0, 6, -6, 0]);
      gemG.fill({ color: 0x69b070 });
      this.worldLayer.addChild(gemG);
      this.gems.push({ x: e.x, y: e.y, graphics: gemG });
      // A little extra pop on tier-3+ kills
      if (e.proto.tier >= 3) {
        this.applyShake(3, 0.2);
      }
      this.worldLayer.removeChild(e.sprite);
      e.sprite.destroy();
      this.enemies.splice(i, 1);
    }
  }

  private updateGems(dt: number): void {
    const px = this.player.x;
    const py = this.player.y;
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      const dx = px - g.x;
      const dy = py - g.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < this.stats.pickup * this.stats.pickup) {
        const d = Math.sqrt(d2) || 1;
        g.x += (dx / d) * 6 * dt * 60;
        g.y += (dy / d) * 6 * dt * 60;
      }
      if (d2 < 14 * 14) {
        this.worldLayer.removeChild(g.graphics);
        g.graphics.destroy();
        this.gems.splice(i, 1);
        this.xp += 1;
        AudioManager.play('gem_pickup', { volume: 0.4 });
        if (this.xp >= this.xpNext) {
          this.xp -= this.xpNext;
          this.level++;
          this.xpNext = Math.round(this.xpNext * 1.4);
          this.player.hpMax += 10;
          this.player.hp = this.player.hpMax;
          this.stats.dmg += 2;
          this.onLevelUp();
        }
      }
    }
  }

  // ---------- Juice helpers ----------
  // All scaled by motionMult — set to 0 in settings to disable entirely.
  private applyShake(magnitude: number, duration: number): void {
    const m = magnitude * this.motionMult;
    if (m > this.shakeMag) this.shakeMag = m;
    if (duration > this.shakeT) this.shakeT = duration;
  }

  private applyZoomPulse(scale: number, _duration: number): void {
    // Soften zoom proportionally — at motionMult 0, zoom is disabled
    const eased = 1 + (scale - 1) * this.motionMult;
    if (eased > this.zoomTarget) this.zoomTarget = eased;
  }

  private applyScreenFlash(intensity: number): void {
    const i = intensity * this.motionMult;
    if (i > this.screenFlashAlpha) this.screenFlashAlpha = i;
  }

  /** Brief time-scale freeze on big hits (~30-100ms). */
  private applyHitStop(durationS: number): void {
    const d = durationS * this.motionMult;
    if (d > this.hitStopT) this.hitStopT = d;
  }

  private onLevelUp(): void {
    this.applyShake(6, 0.35);
    this.levelGlowAlpha = 0.55;
    AudioManager.play('level_up');
    const count = 18;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const speed = 220 + Math.random() * 60;
      this.pushParticle('burst', this.player.x, this.player.y, Math.cos(a) * speed, Math.sin(a) * speed, 0.7, 0xffd070, 3);
    }
    this.spawnHit(this.player.x, this.player.y - 30, `LVL ${this.level}`, 'heal');
  }

  private spawnCritSparks(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 80;
      this.pushParticle('spark', x, y, Math.cos(a) * speed, Math.sin(a) * speed - 60, 0.4, 0xff9050, 2);
    }
  }

  /** Splash blood drops outward from a hit point (no-op when blood gore is off). */
  private spawnBloodSplash(x: number, y: number): void {
    if (typeof window === 'undefined') return;
    // Read settings JIT — avoids store import dep cycle in the engine
    const blood = (window as Window & { __DG_BLOOD_ON?: boolean }).__DG_BLOOD_ON !== false;
    if (!blood) return;
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 70;
      const dropColor = Math.random() < 0.7 ? 0xa02020 : 0x6a1010;
      this.pushParticle('blood', x, y, Math.cos(a) * speed, Math.sin(a) * speed - 40, 0.5, dropColor, 2);
    }
  }

  /** Ambient embers + dust drifting through the dungeon (atmosphere). */
  private spawnAmbient(): void {
    const screen = this.app.screen;
    const camOffsetX = -this.worldRoot.position.x;
    const camOffsetY = -this.worldRoot.position.y;
    const inv = 1 / Math.max(0.001, this.zoomScale);
    // Spawn anywhere within the camera's view, in world coords
    const x = (Math.random() * screen.width + camOffsetX) * inv + this.player.x - screen.width / 2;
    const y = (Math.random() * screen.height + camOffsetY) * inv + this.player.y - screen.height / 2;
    if (Math.random() < 0.55) {
      // Ember — warm, rises
      this.pushParticle('ember', x, y, (Math.random() - 0.5) * 8, -10 - Math.random() * 12, 2.4, 0xffae50, 1.8);
    } else {
      // Dust — cool, drifts
      this.pushParticle('dust', x, y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8, 3.5, 0x808a98, 1);
    }
  }

  /** Internal — push a particle with kind-specific physics defaults.
   *  Uses a shared white circle texture; pool sprites are recycled by tint+scale.
   */
  private pushParticle(
    kind: ParticleKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    color: number,
    radius: number
  ): void {
    // Hard cap — recycle the oldest particle when over budget. Better than
    // dropping the new spawn (which would make bursts feel cut off) since
    // the oldest is closest to expiring anyway.
    const HARD_CAP = 500;
    if (this.particles.length >= HARD_CAP) {
      const oldest = this.particles.shift();
      if (oldest) this.releaseParticle(oldest);
    }
    const sprite = this.particlePool.pop() ?? new Sprite(this.particleTexture!);
    sprite.anchor.set(0.5);
    sprite.tint = color;
    sprite.position.set(x, y);
    // Texture is 16x16 — scale to desired diameter (radius*2 / 16 = radius/8)
    sprite.scale.set(radius / 8);
    sprite.alpha = 1;
    if (!sprite.parent) this.particleLayer.addChild(sprite);
    let drag = 0.92;
    let gravity = 50;
    if (kind === 'ember') { drag = 0.99; gravity = -8; }
    if (kind === 'dust')  { drag = 0.99; gravity = 0; }
    if (kind === 'blood') { drag = 0.88; gravity = 240; }
    this.particles.push({
      x, y, vx, vy,
      life, maxLife: life,
      sprite,
      kind, drag, gravity,
    });
  }

  private releaseParticle(p: Particle): void {
    if (p.sprite.parent) p.sprite.parent.removeChild(p.sprite);
    // Cap pool to avoid unbounded growth on long sessions
    if (this.particlePool.length < 400) {
      this.particlePool.push(p.sprite);
    } else {
      p.sprite.destroy();
    }
  }

  // ---------- Background tiles (real CC0 dungeon-crawl floor + decorations) ----------
  private buildBackground(): void {
    const theme = THEMES[this.opts.theme];
    const SCALE = 4;       // upscale 16x16 Kenney source → 64x64 in world
    const AREA = 4000;     // floor TilingSprite size — repositioned each
                           // frame to follow the player so the map feels
                           // endless (player never sees the edge).

    // Floor: a TilingSprite re-positioned each frame to stay centered on
    // the player. Because it tiles its source texture across its bounds,
    // the player always sees a continuous floor.
    const floorTex = Texture.from(theme.floor);
    const floor = new TilingSprite({
      texture: floorTex,
      width: AREA,
      height: AREA,
    });
    floor.tileScale.set(SCALE);
    floor.tint = theme.floorTint;
    this.bgLayer.addChild(floor);
    this.floorSprite = floor;

    // Variety overlay — a second TilingSprite at a different scale + alpha
    // breaks up the perfect repeating-tile look without needing multiple
    // textures. Larger tile (1.5x) means it doesn't align with the base
    // grid, so the eye sees layered variation.
    const overlay = new TilingSprite({
      texture: floorTex,
      width: AREA,
      height: AREA,
    });
    overlay.tileScale.set(SCALE * 1.5);
    overlay.tint = theme.floorTint;
    overlay.alpha = 0.35;
    this.bgLayer.addChild(overlay);
    this.floorOverlay = overlay;

    // Scatter decorations — fewer, smaller, and tracked so they collide.
    // Deterministic seed so the same theme produces the same arrangement.
    const rng = mulberry32(0x9e3779b1 ^ this.opts.theme.charCodeAt(0));
    // #143: was 28 — reduced to 14 so the map breathes; scale dropped from
    // 0.65-0.9 to 0.4-0.6; collision radius tightened from 18+s*4 to 11+s*2.5
    // so it matches the actual visible footprint.
    const COUNT = 14;
    this.obstacles.length = 0;
    for (let i = 0; i < COUNT; i++) {
      const url = theme.decorations[Math.floor(rng() * theme.decorations.length)];
      // Skip blood splat decorations for collision — they're flat ground markings
      const isFlat = /blood_/.test(url);
      const tex = Texture.from(url);
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 1.0); // bottom-center for grounded objects
      const r = 280 + rng() * 1600;
      const a = rng() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      sprite.position.set(x, y);
      const scale = SCALE * (0.4 + rng() * 0.2);
      sprite.scale.set(scale);
      if (rng() < 0.5) sprite.scale.x = -scale;
      sprite.alpha = 0.85 + rng() * 0.15;
      this.bgLayer.addChild(sprite);
      if (!isFlat) {
        const collisionR = 11 + scale * 2.5;
        this.obstacles.push({ x, y, r: collisionR });
      }
    }

    // #144: scatter a second non-collision "prop" layer — small flat
    // ground markings that liven up the floor without blocking movement.
    // Mix of pentagrams, blood, and procedural moss/dust patches with
    // per-theme color tinting so the floor reads as inhabited, not empty.
    const propRng = mulberry32(0xb5297a4d ^ this.opts.theme.charCodeAt(1));
    const PROP_COUNT = 80;
    const themePropTint = this.themePropTint();
    const propPaths = [
      `${import.meta.env.BASE_URL}assets/tiles/dungeon-crawl/dc-misc/blood_red1.png`,
      `${import.meta.env.BASE_URL}assets/tiles/dungeon-crawl/dc-misc/blood_red2.png`,
      `${import.meta.env.BASE_URL}assets/tiles/dungeon-crawl/dc-misc/blood_red3.png`,
      `${import.meta.env.BASE_URL}assets/tiles/dungeon-crawl/dc-misc/demon_pentagram1.png`,
      `${import.meta.env.BASE_URL}assets/tiles/dungeon-crawl/dc-misc/demon_pentagram3.png`,
    ];
    for (let i = 0; i < PROP_COUNT; i++) {
      const useSprite = propRng() < 0.55;
      const r = 200 + propRng() * 2200;
      const a = propRng() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (useSprite) {
        // Sprite prop — blood splat or pentagram, tinted to theme.
        const url = propPaths[Math.floor(propRng() * propPaths.length)];
        const tex = Texture.from(url);
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.position.set(x, y);
        const scale = SCALE * (0.25 + propRng() * 0.3);
        sprite.scale.set(scale);
        sprite.rotation = propRng() * Math.PI * 2;
        sprite.alpha = 0.20 + propRng() * 0.25;
        sprite.tint = themePropTint;
        this.bgLayer.addChild(sprite);
      } else {
        // Procedural moss / dust patch — Graphics circle blob.
        const patch = new Graphics();
        const blobR = 8 + propRng() * 14;
        patch.circle(0, 0, blobR);
        patch.fill({ color: themePropTint, alpha: 0.18 + propRng() * 0.18 });
        // Soft inner highlight
        patch.circle(propRng() * 4 - 2, propRng() * 4 - 2, blobR * 0.55);
        patch.fill({ color: 0xffffff, alpha: 0.06 });
        patch.position.set(x, y);
        this.bgLayer.addChild(patch);
      }
    }
  }

  /**
   * Story-mode (#145): paint a tinted floor patch + decoration outline for
   * each zone so the player can see the room boundaries. Drawn into bgLayer
   * AFTER the base floor so it shows on top.
   */
  private drawZoneOverlays(): void {
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      const patch = new Graphics();
      patch.rect(z.cx - z.hw, z.cy - z.hh, z.hw * 2, z.hh * 2);
      patch.fill({ color: z.tint, alpha: 0.18 });
      patch.rect(z.cx - z.hw, z.cy - z.hh, z.hw * 2, z.hh * 2);
      patch.stroke({ color: 0xc9a227, width: 4, alpha: 0.45 });
      this.bgLayer.addChild(patch);

      // Corner markers — small gold L-brackets at each corner so the room
      // reads as a discrete space.
      const corners = new Graphics();
      const armLen = 36;
      const corners3 = [
        [z.cx - z.hw, z.cy - z.hh, 1, 1],
        [z.cx + z.hw, z.cy - z.hh, -1, 1],
        [z.cx - z.hw, z.cy + z.hh, 1, -1],
        [z.cx + z.hw, z.cy + z.hh, -1, -1],
      ];
      for (const [x, y, dx, dy] of corners3) {
        corners.moveTo(x, y);
        corners.lineTo(x + dx * armLen, y);
        corners.moveTo(x, y);
        corners.lineTo(x, y + dy * armLen);
      }
      corners.stroke({ color: 0xc9a227, width: 5, alpha: 0.85 });
      this.bgLayer.addChild(corners);
    }
  }

  /**
   * Story-mode (#147) — wrap each zone in 4 walls + leave door gaps on the
   * east/west edges connecting to adjacent zones. End zones get sealed sides.
   * Door segments default to closed; they swing open when the zone clears.
   */
  private buildWalls(): void {
    this.walls.length = 0;
    if (this.zones.length === 0) return;
    const T = 16;            // wall thickness
    const DOOR = 110;        // door gap width
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      const left = z.cx - z.hw;
      const right = z.cx + z.hw;
      const top = z.cy - z.hh;
      const bottom = z.cy + z.hh;
      // North + South walls (full width).
      this.walls.push({ x: left, y: top - T, w: z.hw * 2, h: T, doorOpen: true, zoneIdx: i, isDoor: false });
      this.walls.push({ x: left, y: bottom, w: z.hw * 2, h: T, doorOpen: true, zoneIdx: i, isDoor: false });
      // West edge — wall above + below the door gap; door spans the gap.
      const hasWest = i > 0;
      const doorY = z.cy - DOOR / 2;
      if (hasWest) {
        this.walls.push({ x: left - T, y: top - T, w: T, h: doorY - top + T, doorOpen: true, zoneIdx: i, isDoor: false });
        this.walls.push({ x: left - T, y: doorY + DOOR, w: T, h: bottom - (doorY + DOOR) + T, doorOpen: true, zoneIdx: i, isDoor: false });
        // West door segment — closed by default; opens after zone is cleared.
        this.walls.push({ x: left - T, y: doorY, w: T, h: DOOR, doorOpen: true, zoneIdx: i, isDoor: true });
      } else {
        this.walls.push({ x: left - T, y: top - T, w: T, h: z.hh * 2 + T * 2, doorOpen: true, zoneIdx: i, isDoor: false });
      }
      // East edge — same construction; door connects to next zone.
      const hasEast = i < this.zones.length - 1;
      if (hasEast) {
        this.walls.push({ x: right, y: top - T, w: T, h: doorY - top + T, doorOpen: true, zoneIdx: i, isDoor: false });
        this.walls.push({ x: right, y: doorY + DOOR, w: T, h: bottom - (doorY + DOOR) + T, doorOpen: true, zoneIdx: i, isDoor: false });
        this.walls.push({ x: right, y: doorY, w: T, h: DOOR, doorOpen: true, zoneIdx: i, isDoor: true });
      } else {
        this.walls.push({ x: right, y: top - T, w: T, h: z.hh * 2 + T * 2, doorOpen: true, zoneIdx: i, isDoor: false });
      }
    }
    this.refreshDoorState();
  }

  /**
   * Door state (#149) — the active uncleared zone gets its doors closed
   * (locking the player inside until the wave is dead). Cleared zones reopen.
   */
  private refreshDoorState(): void {
    for (const w of this.walls) {
      if (!w.isDoor) continue;
      const z = this.zones[w.zoneIdx];
      // Doors close when the zone is triggered but not cleared.
      const closed = z.triggered && !z.cleared;
      w.doorOpen = !closed;
    }
    this.repaintWalls();
  }

  /**
   * Render all walls into bgLayer. Theme-tinted (#150). Cleared zones fade
   * to lower alpha (#151). Doors render distinctly so the player reads them.
   */
  private repaintWalls(): void {
    if (!this.wallGfx) {
      this.wallGfx = new Graphics();
      this.bgLayer.addChild(this.wallGfx);
    }
    const g = this.wallGfx;
    g.clear();
    const tint = this.themeWallTint();
    for (const w of this.walls) {
      const z = this.zones[w.zoneIdx];
      const cleared = z.cleared;
      const baseAlpha = cleared ? 0.35 : 0.95;
      if (w.isDoor && w.doorOpen) {
        // Open door — thin glow line so the gap reads visually.
        g.rect(w.x, w.y, w.w, w.h);
        g.fill({ color: 0xc9a227, alpha: cleared ? 0.18 : 0.32 });
        continue;
      }
      g.rect(w.x, w.y, w.w, w.h);
      g.fill({ color: tint, alpha: baseAlpha });
      // Subtle highlight strip on top edge for readability.
      g.rect(w.x, w.y, w.w, Math.min(3, w.h));
      g.fill({ color: 0xffffff, alpha: cleared ? 0.04 : 0.10 });
    }
  }

  /** Per-theme wall stone tint (#150). */
  private themeWallTint(): number {
    switch (this.opts.theme) {
      case 'crypt':     return 0x4a4654;
      case 'catacomb':  return 0x6a4e30;
      case 'hellscape': return 0x4a1818;
      case 'cavern':    return 0x3a4438;
      default:          return 0x404040;
    }
  }

  /**
   * Push a circular body out of any solid wall rect (#146). AABB-vs-circle:
   * find the nearest point on the rect, push along the vector from that
   * point back to the body center if overlapping. Doors with doorOpen skip.
   */
  private resolveWallCollision(body: { x: number; y: number }, bodyR: number): void {
    for (const w of this.walls) {
      if (w.doorOpen && w.isDoor) continue;
      const cx = Math.max(w.x, Math.min(body.x, w.x + w.w));
      const cy = Math.max(w.y, Math.min(body.y, w.y + w.h));
      const dx = body.x - cx;
      const dy = body.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bodyR * bodyR) {
        if (d2 < 0.0001) {
          // Body sitting exactly on the rect — push along whichever axis
          // has the shorter escape distance.
          const left = body.x - w.x;
          const right = (w.x + w.w) - body.x;
          const top = body.y - w.y;
          const bot = (w.y + w.h) - body.y;
          const minH = Math.min(left, right);
          const minV = Math.min(top, bot);
          if (minH < minV) body.x += (left < right ? -1 : 1) * (minH + bodyR);
          else body.y += (top < bot ? -1 : 1) * (minV + bodyR);
        } else {
          const d = Math.sqrt(d2);
          const push = (bodyR - d) / d;
          body.x += dx * push;
          body.y += dy * push;
        }
      }
    }
  }

  /** Per-theme tint for the flat prop layer (matches the floor mood). */
  private themePropTint(): number {
    switch (this.opts.theme) {
      case 'crypt':     return 0x40404a;  // cool grey
      case 'catacomb':  return 0x8a6438;  // warm tan
      case 'hellscape': return 0x602020;  // dried blood
      case 'cavern':    return 0x405030;  // moss
      default:          return 0x404040;
    }
  }

  /** Move solid bodies (player + enemies) out of decoration obstacles. */
  private resolveObstacleCollision(body: { x: number; y: number }, bodyR: number): void {
    for (const o of this.obstacles) {
      const dx = body.x - o.x;
      const dy = body.y - o.y;
      const minD = bodyR + o.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < minD * minD && d2 > 0) {
        const d = Math.sqrt(d2);
        const push = (minD - d) / d;
        body.x += dx * push;
        body.y += dy * push;
      }
    }
  }

  // ---------- Vignette (screen-space) ----------
  private buildVignette(): void {
    this.repaintVignette();
  }

  private repaintVignette(): void {
    // The dynamic torch already handles edge darkening with a smooth radial
    // gradient — adding a static rect-band vignette on top produced a
    // double-darkened look. Leave the layer empty (kept for hooks).
    this.vignetteLayer.clear();
  }

  // ---------- Dynamic lighting (player torch) ----------
  // Render a single radial-gradient sprite at screen center with multiply
  // blend mode. The sprite's transparent center keeps the world bright;
  // its dark edges multiply down to ~black, simulating a torch.
  private buildLighting(): void {
    const tex = this.makeRadialLightTexture();
    this.lightTexture = tex;
    const sp = new Sprite(tex);
    sp.anchor.set(0.5);
    sp.blendMode = 'multiply';
    this.lightSprite = sp;
    // Sits above world but BELOW screen overlays (vignette, flash, glow)
    // so the dynamic light is the base layer of darkness.
    this.app.stage.addChildAt(sp, this.app.stage.getChildIndex(this.screenLayer));
    this.layoutLighting();
  }

  /** Build a 512-px-square canvas texture with a radial gradient: clear → dark.
   *  Bright zone stays nearly full-brightness for the inner 55% of the radius
   *  so the dungeon is comfortably readable around the player; the outer 45%
   *  is the long soft falloff into the dark corners.
   *  Multiply blend: 0xFFFFFF leaves color unchanged, 0x000000 multiplies to black. */
  private makeRadialLightTexture(): Texture {
    const SIZE = 512;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    const cx = SIZE / 2;
    const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grad.addColorStop(0.00, 'rgba(255, 252, 240, 1.00)');  // pure bright core
    grad.addColorStop(0.45, 'rgba(252, 245, 225, 1.00)');  // still ~98% — broad lit area
    grad.addColorStop(0.62, 'rgba(220, 195, 165, 1.00)');  // gentle warm dim begins
    grad.addColorStop(0.78, 'rgba(140, 110,  80, 1.00)');  // moderate falloff
    grad.addColorStop(0.92, 'rgba( 45,  35,  25, 1.00)');  // dark
    grad.addColorStop(1.00, 'rgba( 14,  14,  18, 1.00)');  // near-black at corners
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    return Texture.from(canvas);
  }

  private layoutLighting(): void {
    if (!this.lightSprite) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    // Light radius scales subtly with weapon range — long-range builds see
    // further into the dark.
    const baseRange = this.stats.range + this.stats.rangeBonus;
    const rangeBoost = Math.max(0.95, Math.min(1.45, baseRange / 320));
    // Cover slightly larger than the viewport so the dark corners hit cleanly
    // but the bright center fills most of the visible area.
    const cover = Math.max(w, h) * 1.5 * rangeBoost;
    this.lightSprite.position.set(w / 2, h / 2);
    // Texture is 512px now; divide accordingly.
    this.lightSprite.scale.set(cover / 512);
    // Reset stored base scale so flicker recalculates from the new size on resize
    delete (this.lightSprite as unknown as { __baseScale?: number }).__baseScale;
  }

  private spawnHit(x: number, y: number, txt: string, kind: HitKind): void {
    let style: TextStyle;
    switch (kind) {
      case 'crit':         style = HIT_STYLE_CRIT;        break;
      case 'heal':         style = HIT_STYLE_HEAL;        break;
      case 'player-damage':style = HIT_STYLE_PLAYER_DMG;  break;
      case 'cash':         style = HIT_STYLE_CASH;        break;
      default:             style = HIT_STYLE_NORMAL;
    }
    const t = new Text({ text: txt, style });
    t.anchor.set(0.5);
    t.position.set(x, y);
    // Bouncy entrance: start scaled down
    t.scale.set(0.4);
    this.hitTextLayer.addChild(t);

    this.hits.push({
      x,
      y,
      vy: -50,
      life: 0.85,
      maxLife: 0.85,
      text: t,
      kind,
    });
  }

  private updateHits(dt: number): void {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      h.life -= dt;
      h.y += h.vy * dt;
      h.vy *= 0.92; // decelerate float
      // Bouncy scale: overshoot then settle
      const t = 1 - h.life / h.maxLife; // 0 → 1 over lifetime
      const targetScale = h.kind === 'crit' ? 1.0 : h.kind === 'heal' ? 0.85 : 0.95;
      // Spring with overshoot
      const ease = t < 0.18
        ? Math.min(1.4, t / 0.18 * 1.4)
        : 1 + Math.sin((t - 0.18) * Math.PI * 4) * 0.08 * Math.exp(-(t - 0.18) * 6);
      h.text.scale.set(targetScale * ease);
      h.text.position.set(h.x, h.y);
      // Fade in last 30%
      h.text.alpha = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
      if (h.life <= 0) {
        this.hitTextLayer.removeChild(h.text);
        h.text.destroy();
        this.hits.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity * dt;
      p.sprite.position.set(p.x, p.y);
      // Ambient particles (ember/dust) use a softer fade curve
      if (p.kind === 'ember' || p.kind === 'dust') {
        const t = p.life / p.maxLife;
        p.sprite.alpha = Math.max(0, Math.min(1, t < 0.2 ? t * 5 : 1) * 0.55);
      } else {
        p.sprite.alpha = Math.max(0, p.life / p.maxLife);
      }
      if (p.life <= 0) {
        this.releaseParticle(p);
        this.particles.splice(i, 1);
      }
    }
  }

  private updateScreenFx(dt: number): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    // Damage flash — red vignette pulse from edges
    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - dt * 1.4);
      this.screenFlash.clear();
      const a = this.screenFlashAlpha;
      // Outer ring of red — strong at edges, fades to center
      this.screenFlash.rect(0, 0, w, h);
      this.screenFlash.fill({ color: 0xb02020, alpha: a * 0.18 });
      // Edge bands
      const band = Math.max(40, Math.min(w, h) * 0.06);
      this.screenFlash.rect(0, 0, w, band);
      this.screenFlash.fill({ color: 0xff3030, alpha: a * 0.35 });
      this.screenFlash.rect(0, h - band, w, band);
      this.screenFlash.fill({ color: 0xff3030, alpha: a * 0.35 });
      this.screenFlash.rect(0, 0, band, h);
      this.screenFlash.fill({ color: 0xff3030, alpha: a * 0.35 });
      this.screenFlash.rect(w - band, 0, band, h);
      this.screenFlash.fill({ color: 0xff3030, alpha: a * 0.35 });
    } else {
      this.screenFlash.clear();
    }

    // Level glow — gold edge pulse
    if (this.levelGlowAlpha > 0) {
      this.levelGlowAlpha = Math.max(0, this.levelGlowAlpha - dt * 1.0);
      this.levelGlow.clear();
      const a = this.levelGlowAlpha;
      const band = Math.max(60, Math.min(w, h) * 0.08);
      this.levelGlow.rect(0, 0, w, band);
      this.levelGlow.fill({ color: 0xffd070, alpha: a * 0.4 });
      this.levelGlow.rect(0, h - band, w, band);
      this.levelGlow.fill({ color: 0xffd070, alpha: a * 0.4 });
      this.levelGlow.rect(0, 0, band, h);
      this.levelGlow.fill({ color: 0xffd070, alpha: a * 0.4 });
      this.levelGlow.rect(w - band, 0, band, h);
      this.levelGlow.fill({ color: 0xffd070, alpha: a * 0.4 });
    } else {
      this.levelGlow.clear();
    }
  }

  // ---------- Camera ----------
  private updateCamera(dt: number): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    // Endless map — re-center the floor TilingSprite(s) on the player so
    // they never see the edge. Position is in WORLD coords.
    for (const sp of [this.floorSprite, this.floorOverlay]) {
      if (!sp) continue;
      const half = sp.width / 2;
      sp.position.set(this.player.x - half, this.player.y - half);
      // Counter-shift tile offset so the pattern appears stationary in
      // world coords (otherwise it would drag with the player).
      sp.tilePosition.set(-this.player.x, -this.player.y);
    }

    // Target = player position translated to screen center
    this.targetCamX = w / 2 - this.player.x;
    this.targetCamY = h / 2 - this.player.y;

    // Smooth follow (lerp)
    const lerp = 1 - Math.pow(1 - 0.18, dt * 60);
    this.camX += (this.targetCamX - this.camX) * lerp;
    this.camY += (this.targetCamY - this.camY) * lerp;

    // Shake
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeMag * Math.max(0, this.shakeT) / Math.max(0.0001, this.shakeT + dt);
      shakeX = (Math.random() - 0.5) * 2 * m;
      shakeY = (Math.random() - 0.5) * 2 * m;
      if (this.shakeT <= 0) this.shakeMag = 0;
    }

    // Zoom pulse — settle back to 1
    this.zoomTarget = Math.max(1, this.zoomTarget - dt * 0.4);
    this.zoomScale += (this.zoomTarget - this.zoomScale) * lerp;

    // Apply transforms to worldRoot. Zoom centers on the screen middle.
    this.worldRoot.scale.set(this.zoomScale);
    this.worldRoot.position.set(
      (this.camX + shakeX) * this.zoomScale + (1 - this.zoomScale) * (w / 2),
      (this.camY + shakeY) * this.zoomScale + (1 - this.zoomScale) * (h / 2)
    );

    // Sync sprite positions (they live in worldLayer, which is inside worldRoot)
    this.player.sprite.position.set(this.player.x, this.player.y);
    for (const e of this.enemies) e.sprite.position.set(e.x, e.y);
    for (const pr of this.projectiles) {
      const display = pr.sprite ?? pr.graphics;
      if (display) display.position.set(pr.x, pr.y);
    }
    for (const g of this.gems) g.graphics.position.set(g.x, g.y);
  }
}
