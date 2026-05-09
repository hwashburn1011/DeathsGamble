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
} from 'pixi.js';
import type { BuildDef, EnemyTypeDef, PlayerStats, WeaponDef } from '../../types';
import { ENEMY_TYPES } from '../../data/enemies';
import { PLAYER_SPRITE_BY_BUILD, ENEMY_SPRITE_BY_TYPE } from '../pixi/manifest';

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
  spd: number;
  dmg: number;
  r: number;
  cash: number;
  sprite: Sprite;
  flashTimer: number;
  proto: EnemyTypeDef;
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
  graphics: Graphics;
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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  graphics: Graphics;
  rot: number;
  vrot: number;
}

export interface DungeonGameOptions {
  build: BuildDef;
  weapon: WeaponDef;
  stats: PlayerStats;
  onStatsChange: (s: { hp: number; hpMax: number; level: number; xp: number; xpNext: number; kills: number; cashThisRun: number; time: number }) => void;
  onGameOver: (stats: { time: number; kills: number; level: number; cash: number }) => void;
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
  private worldLayer: Container = new Container();
  private projectileLayer: Container = new Container();
  private particleLayer: Container = new Container();
  private hitTextLayer: Container = new Container();
  private screenLayer: Container = new Container();

  private screenFlash: Graphics = new Graphics();
  private screenFlashAlpha = 0;        // current alpha
  private levelGlow: Graphics = new Graphics();
  private levelGlowAlpha = 0;

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

  private tickerCb: (() => void) | null = null;

  constructor(app: Application, opts: DungeonGameOptions) {
    this.app = app;
    this.opts = opts;
    this.stats = { ...opts.stats };

    // Layer order
    this.worldRoot.addChild(this.worldLayer);
    this.worldRoot.addChild(this.projectileLayer);
    this.worldRoot.addChild(this.particleLayer);
    this.worldRoot.addChild(this.hitTextLayer);
    app.stage.addChild(this.worldRoot);

    // Screen-space overlays (above world, drawn on top)
    this.screenLayer.addChild(this.screenFlash);
    this.screenLayer.addChild(this.levelGlow);
    app.stage.addChild(this.screenLayer);
  }

  async start(): Promise<void> {
    await this.preload();
    this.spawnPlayer();
    this.startTime = performance.now();
    this.attachInput();
    this.tickerCb = () => this.tick(this.app.ticker.deltaMS / 1000);
    this.app.ticker.add(this.tickerCb);
  }

  destroy(): void {
    if (this.tickerCb) this.app.ticker.remove(this.tickerCb);
    this.detachInput();
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
    const urls = [
      PLAYER_SPRITE_BY_BUILD[this.opts.build.id] ?? PLAYER_SPRITE_BY_BUILD['gambler'],
      ...Object.values(ENEMY_SPRITE_BY_TYPE),
    ];
    await Promise.all(urls.map((u) => Assets.load(u)));
  }

  // ---------- Player ----------
  private spawnPlayer(): void {
    const url = PLAYER_SPRITE_BY_BUILD[this.opts.build.id] ?? PLAYER_SPRITE_BY_BUILD['gambler'];
    const tex = Texture.from(url);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.scale.set(1.4);
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
  private tick(dt: number): void {
    if (this.gameOver) return;

    const now = performance.now();
    const elapsedS = (now - this.startTime) / 1000;

    this.updatePlayer(dt);
    this.maybeShoot(now);
    this.maybeSpawn(now, elapsedS);
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
    });

    if (this.player.hp <= 0) {
      this.gameOver = true;
      this.opts.onGameOver({
        time: Math.floor(elapsedS),
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
    }

    this.player.sprite.scale.x = 1.4 * this.player.facing;

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
    for (let i = 0; i < projCount; i++) {
      const offset = projCount === 1 ? 0 : (i / (projCount - 1) - 0.5) * spread;
      const angle = baseAngle + offset;
      const isCrit = Math.random() < this.stats.crit;
      const speed = w.type === 'magic' ? 6 : 9;
      const dmg = (w.dmg + this.stats.dmg) * this.stats.dmgMult * (isCrit ? 2 : 1);

      const g = new Graphics();
      const color = parseInt(w.color.replace('#', ''), 16);
      g.circle(0, 0, isCrit ? 6 : 4);
      g.fill({ color: isCrit ? 0xff9050 : color });

      this.projectileLayer.addChild(g);

      this.projectiles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        dmg,
        crit: isCrit,
        life: w.type === 'melee' ? 0.15 : 1.5,
        pierce: this.stats.pierce,
        hit: new Set(),
        graphics: g,
      });
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
    sprite.scale.set(proto.size / 22);
    this.worldLayer.addChild(sprite);

    this.enemies.push({
      x: px,
      y: py,
      hp: proto.hp * this.stats.enemyHpMult * (1 + elapsedS * 0.05),
      spd: proto.spd * this.stats.enemySpdMult,
      dmg: proto.dmg + this.stats.enemyDmgBonus,
      r: proto.size,
      cash: 1 + Math.floor(proto.tier * 1.5),
      sprite,
      flashTimer: 0,
      proto,
    });
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
          if (pr.crit) {
            this.applyShake(2.5, 0.18);
            this.applyZoomPulse(1.04, 0.18);
            this.spawnCritSparks(e.x, e.y);
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
    this.projectileLayer.removeChild(pr.graphics);
    pr.graphics.destroy();
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
      this.cashThisRun += e.cash;
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
  private applyShake(magnitude: number, duration: number): void {
    // Take the larger of current vs new — shakes don't dampen each other
    if (magnitude > this.shakeMag) this.shakeMag = magnitude;
    if (duration > this.shakeT) this.shakeT = duration;
  }

  private applyZoomPulse(scale: number, _duration: number): void {
    if (scale > this.zoomTarget) this.zoomTarget = scale;
  }

  private applyScreenFlash(intensity: number): void {
    if (intensity > this.screenFlashAlpha) this.screenFlashAlpha = intensity;
  }

  private onLevelUp(): void {
    // Visual burst
    this.applyShake(6, 0.35);
    this.levelGlowAlpha = 0.55;
    // Radial particle ring at player
    const count = 18;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const speed = 220 + Math.random() * 60;
      const g = new Graphics();
      g.circle(0, 0, 3);
      g.fill({ color: 0xffd070 });
      this.particleLayer.addChild(g);
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.7,
        maxLife: 0.7,
        graphics: g,
        rot: 0,
        vrot: 0,
      });
    }
    // Floating "LVL UP" text
    this.spawnHit(this.player.x, this.player.y - 30, `LVL ${this.level}`, 'heal');
  }

  private spawnCritSparks(x: number, y: number): void {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 80;
      const g = new Graphics();
      g.circle(0, 0, 2);
      g.fill({ color: 0xff9050 });
      this.particleLayer.addChild(g);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 60,
        life: 0.4,
        maxLife: 0.4,
        graphics: g,
        rot: 0,
        vrot: 0,
      });
    }
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
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.vy += 50 * dt; // mild gravity
      p.graphics.position.set(p.x, p.y);
      p.graphics.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.particleLayer.removeChild(p.graphics);
        p.graphics.destroy();
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
    for (const pr of this.projectiles) pr.graphics.position.set(pr.x, pr.y);
    for (const g of this.gems) g.graphics.position.set(g.x, g.y);
  }
}
