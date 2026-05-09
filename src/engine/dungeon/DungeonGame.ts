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
  dmg: number;
  r: number;
  cash: number;
  sprite: Sprite;
  flashTimer: number;
  proto: EnemyTypeDef;
  isBoss: boolean;
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

type HitKind = 'damage' | 'crit' | 'heal' | 'player-damage';

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
}

export interface DungeonGameOptions {
  build: BuildDef;
  weapon: WeaponDef;
  stats: PlayerStats;
  isBossRaid: boolean;
  motionIntensity: SettingsState['motionIntensity'];
  cashMult: number;        // 1 + greedLevel*0.25
  theme: ThemeKey;
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
  /** Solid decorations the player + enemies bump into. */
  private obstacles: { x: number; y: number; r: number }[] = [];

  private player!: PlayerEntity;
  private enemies: EnemyEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
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
  private hitStopT = 0;            // time-scale freeze remaining (real seconds)
  private motionMult = 1;          // multiplier from settings (0/0.5/1/1.5)

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
    await this.preload();
    this.buildBackground();
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
    this.gems.length = 0;
    this.hits.length = 0;
    this.particles.length = 0;
  }

  // ---------- Preload ----------
  private async preload(): Promise<void> {
    const theme = THEMES[this.opts.theme];
    const projUrl = PROJECTILE_BY_WEAPON[this.opts.weapon.id];
    const urls = [
      PLAYER_SPRITE_BY_BUILD[this.opts.build.id] ?? PLAYER_SPRITE_BY_BUILD['gambler'],
      ...Object.values(ENEMY_SPRITE_BY_TYPE),
      theme.floor,
      ...theme.decorations,
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

  // ---------- Loop ----------
  private tick(realDt: number): void {
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
    const elapsedS = (now - this.startTime) / 1000;
    const remaining = this.opts.isBossRaid ? Number.POSITIVE_INFINITY : Math.max(0, ROUND_DURATION_S - elapsedS);

    this.updatePlayer(dt);
    this.maybeShoot(now);
    if (!this.opts.isBossRaid) {
      this.maybeSpawn(now, elapsedS);
    }
    this.maybeAmbient(now);
    this.tickLightFlicker(realDt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.cullDeadEnemies();
    this.updateGems(dt);
    this.updateHits(dt);
    this.updateParticles(dt);
    this.updateScreenFx(dt);
    this.updateCamera(dt);

    this.opts.onStatsChange({
      hp: this.player.hp,
      hpMax: this.player.hpMax,
      level: this.level,
      xp: this.xp,
      xpNext: this.xpNext,
      kills: this.kills,
      cashThisRun: this.cashThisRun,
      time: Math.floor(elapsedS),
      timeRemaining: this.opts.isBossRaid ? -1 : Math.ceil(remaining),
      bossHp: this.boss?.hp ?? null,
      bossHpMax: this.boss?.hpMax ?? null,
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
        this.opts.onBossDefeated({
          time: Math.floor(elapsedS),
          kills: this.kills,
          level: this.level,
          cash: this.cashThisRun,
        });
      }, 1400);
      return;
    }

    // Non-boss round timer ran out
    if (!this.opts.isBossRaid && elapsedS >= ROUND_DURATION_S) {
      this.finished = true;
      this.spawnHit(this.player.x, this.player.y - 30, 'ROUND CLEAR', 'heal');
      setTimeout(() => {
        this.opts.onRoundComplete({
          time: Math.floor(elapsedS),
          kills: this.kills,
          level: this.level,
          cash: this.cashThisRun,
        });
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
      this.opts.onGameOver({
        time: Math.floor((performance.now() - this.startTime) / 1000),
        kills: this.kills,
        level: this.level,
        cash: this.cashThisRun,
      });
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
    const interval = 1000 / (this.stats.atkspd * this.stats.atkspdMult);
    if (now - this.lastShotMs < interval) return;
    const target = this.findNearestEnemy(this.stats.range + this.stats.rangeBonus);
    if (!target) return;
    this.fireProjectile(target);
    this.lastShotMs = now;
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

    for (let i = 0; i < projCount; i++) {
      const offset = projCount === 1 ? 0 : (i / (projCount - 1) - 0.5) * spread;
      const angle = baseAngle + offset;
      const isCrit = Math.random() < this.stats.crit;
      const speed = w.type === 'magic' ? 6 : 9;
      const dmg = (w.dmg + this.stats.dmg) * this.stats.dmgMult * (isCrit ? 2 : 1);

      const proj: ProjectileEntity = {
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        dmg,
        crit: isCrit,
        life: w.type === 'melee' ? 0.15 : 1.5,
        pierce: this.stats.pierce,
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
        // Melee — keep the slash-arc Graphics
        const g = new Graphics();
        g.circle(0, 0, isCrit ? 8 : 6);
        g.fill({ color: isCrit ? 0xff9050 : baseColor, alpha: 0.85 });
        this.projectileLayer.addChild(g);
        proj.graphics = g;
      }

      this.projectiles.push(proj);
    }
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
    if (this.particles.length > 220) return; // soft cap to keep frame budget sane
    this.spawnAmbient();
  }

  // ---------- Spawn ----------
  private maybeSpawn(now: number, elapsedS: number): void {
    if (now - this.lastSpawnMs < this.spawnIntervalMs) return;
    this.spawnEnemy(elapsedS);
    this.lastSpawnMs = now;
    this.spawnIntervalMs = Math.max(
      220,
      (1100 / this.stats.enemySpawnMult) * Math.pow(0.97, elapsedS)
    );
  }

  private spawnEnemy(elapsedS: number): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const dist = Math.max(w, h) * 0.6 + Math.random() * 60;
    const angle = Math.random() * Math.PI * 2;
    const px = this.player.x + Math.cos(angle) * dist;
    const py = this.player.y + Math.sin(angle) * dist;

    let availTier = 1;
    if (elapsedS > 15) availTier = 2;
    if (elapsedS > 35) availTier = 3;
    if (elapsedS > 50) availTier = 4;

    const choices = ENEMY_TYPES.filter((e) => e.tier <= availTier);
    const proto = choices[Math.floor(Math.random() * choices.length)];

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

    const hp = proto.hp * this.stats.enemyHpMult * (1 + elapsedS * 0.05);
    this.enemies.push({
      x: px,
      y: py,
      hp,
      hpMax: hp,
      spd: proto.spd * this.stats.enemySpdMult,
      dmg: proto.dmg + this.stats.enemyDmgBonus,
      r: proto.size,
      cash: 1 + Math.floor(proto.tier * 1.5),
      sprite,
      flashTimer: 0,
      proto,
      isBoss: false,
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
    const boss: EnemyEntity = {
      x: px,
      y: py,
      hp,
      hpMax: hp,
      spd: FINAL_BOSS.spd * this.stats.enemySpdMult,
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
    };
    this.boss = boss;
    this.enemies.push(boss);

    // Cinematic intro flourish — bg pulse + camera shake
    this.applyShake(8, 0.6);
    this.applyZoomPulse(1.06, 0.4);
    AudioManager.play('boss_intro');
  }

  private updateEnemies(dt: number): void {
    const px = this.player.x;
    const py = this.player.y;
    for (const e of this.enemies) {
      const dx = px - e.x;
      const dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * e.spd * dt * 60;
      e.y += (dy / d) * e.spd * dt * 60;
      this.resolveObstacleCollision(e, e.r);

      e.sprite.scale.x = Math.abs(e.sprite.scale.x) * (dx > 0 ? 1 : -1);

      if (e.flashTimer > 0) {
        e.flashTimer -= dt;
      }

      const r = e.r + 12;
      if (dx * dx + dy * dy < r * r) {
        const taken = Math.max(1, e.dmg - this.stats.def) * dt;
        const wasHp = this.player.hp;
        this.player.hp -= taken;
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
          e.hp -= pr.dmg;
          e.flashTimer = 0.12;
          e.sprite.tint = pr.crit ? 0xffd070 : 0xffffff;
          this.spawnHit(e.x, e.y - 10, Math.round(pr.dmg).toString(), pr.crit ? 'crit' : 'damage');
          this.spawnBloodSplash(e.x, e.y);
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
            const heal = pr.dmg * this.stats.lifesteal;
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
      this.cashThisRun += Math.max(1, Math.round(e.cash * this.opts.cashMult));
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

    // Floor: a single TilingSprite that we re-position each frame to stay
    // centered on the player. Because it tiles its source texture across
    // its bounds, the player always sees a continuous floor.
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

    // Scatter decorations — fewer, smaller, and tracked so they collide.
    // Deterministic seed so the same theme produces the same arrangement.
    const rng = mulberry32(0x9e3779b1 ^ this.opts.theme.charCodeAt(0));
    const COUNT = 28;
    this.obstacles.length = 0;
    for (let i = 0; i < COUNT; i++) {
      const url = theme.decorations[Math.floor(rng() * theme.decorations.length)];
      // Skip blood splat decorations for collision — they're flat ground markings
      const isFlat = /blood_/.test(url);
      const tex = Texture.from(url);
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 1.0); // bottom-center for grounded objects
      const r = 240 + rng() * 1500;
      const a = rng() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      sprite.position.set(x, y);
      // Modestly smaller than before — fewer + tighter gives the dungeon more breathing room.
      const scale = SCALE * (0.65 + rng() * 0.25);
      sprite.scale.set(scale);
      if (rng() < 0.5) sprite.scale.x = -scale;
      sprite.alpha = 0.85 + rng() * 0.15;
      this.bgLayer.addChild(sprite);
      if (!isFlat) {
        // Solid obstacle. Radius tuned to the rendered decoration footprint
        // (~28-40 px depending on tex + scale).
        const collisionR = 18 + scale * 4;
        this.obstacles.push({ x, y, r: collisionR });
      }
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

    // Endless map — re-center the floor TilingSprite on the player so they
    // never see the edge. Position is in WORLD coords (worldRoot's child).
    if (this.floorSprite) {
      const half = this.floorSprite.width / 2;
      this.floorSprite.position.set(this.player.x - half, this.player.y - half);
      // Counter-shift the tile offset so the world tiles appear stationary
      // (otherwise the floor pattern would drag along with the player).
      this.floorSprite.tilePosition.set(-this.player.x, -this.player.y);
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
