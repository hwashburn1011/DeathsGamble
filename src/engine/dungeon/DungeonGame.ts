// PixiJS-based dungeon game — minimal port of the v0.5 dungeon loop.
// Uses real sprite textures for player + enemies, glass HUD overlay
// rendered separately by React.

import {
  Application,
  Container,
  Sprite,
  Texture,
  Graphics,
  Assets,
} from 'pixi.js';
import type { BuildDef, EnemyTypeDef, PlayerStats, WeaponDef } from '../../types';
import { ENEMY_TYPES } from '../../data/enemies';
import { SPELLS_BY_ID } from '../../data/spells';
import { DIFFICULTY } from '../../data/difficulty';
import { PLAYER_SPRITE_BY_BUILD, ENEMY_SPRITE_BY_TYPE } from '../pixi/manifest';
import type { Difficulty } from '../../types';

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

interface HitText {
  x: number;
  y: number;
  text: string;
  life: number;
  crit: boolean;
  graphics: Graphics;
}

export interface DungeonGameOptions {
  build: BuildDef;
  weapon: WeaponDef;
  spells: string[];
  difficulty: Difficulty;
  onStatsChange: (s: { hp: number; hpMax: number; level: number; xp: number; xpNext: number; kills: number; cashThisRun: number; time: number }) => void;
  onGameOver: (stats: { time: number; kills: number; level: number; cash: number }) => void;
}

export class DungeonGame {
  private app: Application;
  private opts: DungeonGameOptions;
  private stats: PlayerStats;

  private worldLayer: Container = new Container();
  private projectileLayer: Container = new Container();
  private hitTextLayer: Container = new Container();

  private player!: PlayerEntity;
  private enemies: EnemyEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private gems: GemEntity[] = [];
  private hits: HitText[] = [];

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
    this.stats = computeStats(opts.build, opts.weapon, opts.spells, opts.difficulty);

    app.stage.addChild(this.worldLayer);
    app.stage.addChild(this.projectileLayer);
    app.stage.addChild(this.hitTextLayer);
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
    this.worldLayer.removeChildren();
    this.projectileLayer.removeChildren();
    this.hitTextLayer.removeChildren();
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.gems.length = 0;
    this.hits.length = 0;
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
    // Tiles are 32x32 — we render at world coords. The dungeon camera is
    // centered on the player.
    sprite.scale.set(1.4); // beef sprite up a bit so it reads at 32px source
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
    this.updateCamera();

    // Notify React HUD
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

    // Flash on hit
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

      // Face the player
      e.sprite.scale.x = Math.abs(e.sprite.scale.x) * (dx > 0 ? 1 : -1);

      // Flash
      if (e.flashTimer > 0) {
        e.flashTimer -= dt;
        e.sprite.tint = e.flashTimer > 0 ? 0xffffff : 0xffffff;
      }

      // Contact damage
      const r = e.r + 12;
      if (dx * dx + dy * dy < r * r) {
        const taken = Math.max(1, e.dmg - this.stats.def) * dt;
        this.player.hp -= taken;
        this.player.flashTimer = 0.1;
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
          e.sprite.tint = 0xff8080;
          this.spawnHit(e.x, e.y - 10, Math.round(pr.dmg).toString(), pr.crit);
          if (this.stats.lifesteal > 0) {
            this.player.hp = Math.min(this.player.hpMax, this.player.hp + pr.dmg * this.stats.lifesteal);
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
        // Reset tint after flash
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
      // Remove sprite
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
        }
      }
    }
  }

  private spawnHit(x: number, y: number, text: string, crit: boolean): void {
    const g = new Graphics();
    // Use a simple text-style indicator — render as dot here, real Text in render layer
    // For simplicity just track and let positions update
    this.hitTextLayer.addChild(g);
    this.hits.push({ x, y, text, life: 0.6, crit, graphics: g });
  }

  private updateHits(dt: number): void {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      h.life -= dt;
      h.y -= 24 * dt;
      if (h.life <= 0) {
        this.hitTextLayer.removeChild(h.graphics);
        h.graphics.destroy();
        this.hits.splice(i, 1);
      }
    }
  }

  // ---------- Camera ----------
  private updateCamera(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const camX = w / 2 - this.player.x;
    const camY = h / 2 - this.player.y;
    this.worldLayer.position.set(camX, camY);
    this.projectileLayer.position.set(camX, camY);
    this.hitTextLayer.position.set(camX, camY);

    // Sync sprite positions
    this.player.sprite.position.set(this.player.x, this.player.y);
    for (const e of this.enemies) e.sprite.position.set(e.x, e.y);
    for (const pr of this.projectiles) pr.graphics.position.set(pr.x, pr.y);
    for (const g of this.gems) g.graphics.position.set(g.x, g.y);
    for (const h of this.hits) h.graphics.position.set(h.x, h.y);
  }
}

// ---------- Stats compute ----------
function computeStats(
  build: BuildDef,
  weapon: WeaponDef,
  spells: string[],
  difficulty: Difficulty
): PlayerStats {
  const s: PlayerStats = {
    hp: build.baseHp,
    hpMax: build.baseHp,
    dmg: 0,
    def: build.baseDef,
    spd: build.baseSpd,
    atkspd: weapon.atkspd,
    range: weapon.range,
    crit: 0.05,
    luck: build.baseLuck || 0,
    pickup: 60,
    enemyHpMult: 1.0,
    enemySpdMult: 1.0,
    enemySpawnMult: 1.0,
    enemyDmgBonus: 0,
    dmgMult: 1.0,
    atkspdMult: 1.0,
    rangeBonus: 0,
    lifesteal: 0,
    pierce: 0,
    aoe: weapon.aoe || 0,
  };
  for (const id of spells) {
    const sp = SPELLS_BY_ID[id];
    if (!sp) continue;
    const e = sp.effect;
    if (e.dmgMult) s.dmgMult *= e.dmgMult;
    if (e.atkspdMult) s.atkspdMult *= e.atkspdMult;
    if (e.rangeBonus) s.rangeBonus += e.rangeBonus;
    if (e.hpBonus) {
      s.hp += e.hpBonus;
      s.hpMax += e.hpBonus;
    }
    if (e.critBonus) s.crit = Math.min(1, s.crit + e.critBonus);
    if (e.lifesteal) s.lifesteal += e.lifesteal;
    if (e.pierce) s.pierce += e.pierce;
  }
  const d = DIFFICULTY[difficulty];
  s.enemyHpMult *= d.enemyHpMult;
  s.enemySpdMult *= d.enemySpdMult;
  s.enemySpawnMult *= d.enemySpawnMult;
  s.enemyDmgBonus += (d.enemyDmgMult - 1) * 5;
  return s;
}
