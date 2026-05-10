// PixiJS-based Wheels scene engine — port of v0.5 wheels rendering.
// Renders the hooded Death figure + two wheels + skeletal finger fans,
// handles spin animation and per-segment resolution.

import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from 'pixi.js';
import type { WheelSegment, WheelMode } from '../../types';
import { SEG_ANGLE, SEG_COUNT } from '../../data/wheels';
import { pickSegmentWithLuck } from '../luck';
import { AudioManager } from '../audio/AudioManager';

interface WheelState {
  container: Container;        // rotates with `angle`
  pointer: Graphics;           // static pointer above the wheel
  segments: WheelSegment[];
  angle: number;
  spinning: boolean;
  spun: boolean;
  spinStart: number;
  spinTarget: number;
  t0: number;
  durMs: number;
  resultIdx: number;
  cx: number;                  // wheel center x in stage coords
  cy: number;
  radius: number;
  lastTickSegIdx: number;      // last segment index that was under the pointer (for tick SFX)
}

interface Geometry {
  w: number;
  h: number;
  cy: number;
  wheelR: number;
  buffCx: number;
  curseCx: number;
  deathCx: number;
}

export interface WheelsGameOptions {
  getLuck: () => number;
  onSpinComplete: (side: 'buff' | 'curse', segmentIdx: number) => void;
  /** 'wheel' (default) renders pie wheels; 'slot' renders vertical reels. */
  mode?: WheelMode;
}

export class WheelsGame {
  private app: Application;
  private opts: WheelsGameOptions;
  private mode: WheelMode;

  // Layers (stage children, rebuilt on resize)
  private bgLayer: Container = new Container();
  private deathBack: Container = new Container();    // cloak/hood/eyes (behind wheels)
  private wheelsLayer: Container = new Container();  // both wheels
  private deathFront: Container = new Container();   // skeletal finger fans (in front)

  // Wheel state
  private buff!: WheelState;
  private curse!: WheelState;

  private tickerCb: (() => void) | null = null;
  private buffSegments: WheelSegment[];
  private curseSegments: WheelSegment[];

  // Animated effect bookkeeping
  private eyeBlink: Graphics | null = null;
  private eyePulseT = 0;

  constructor(
    app: Application,
    buffSegments: WheelSegment[],
    curseSegments: WheelSegment[],
    opts: WheelsGameOptions
  ) {
    this.app = app;
    this.opts = opts;
    this.mode = opts.mode ?? 'wheel';
    this.buffSegments = buffSegments;
    this.curseSegments = curseSegments;

    app.stage.addChild(this.bgLayer);
    app.stage.addChild(this.deathBack);
    app.stage.addChild(this.wheelsLayer);
    app.stage.addChild(this.deathFront);
  }

  async start(): Promise<void> {
    // Preload the scythe sprite (#42) so it's available when drawDeathBack
    // creates the Sprite in layout(). Without this, Pixi returns an empty
    // texture and the sprite renders invisibly.
    const SCYTHE_URL = `${import.meta.env.BASE_URL}assets/tiles/dungeon-crawl/item/weapon/scythe2.png`;
    try {
      await Assets.load(SCYTHE_URL);
    } catch {
      /* missing asset — Death scythe will be invisible, not fatal */
    }
    this.layout();
    this.tickerCb = () => this.tick(this.app.ticker.deltaMS);
    this.app.ticker.add(this.tickerCb);

    // Re-layout on resize
    this.app.renderer.on('resize', this.onResize);
  }

  destroy(): void {
    if (this.tickerCb) this.app.ticker.remove(this.tickerCb);
    this.app.renderer.off('resize', this.onResize);
    this.bgLayer.destroy({ children: true });
    this.deathBack.destroy({ children: true });
    this.wheelsLayer.destroy({ children: true });
    this.deathFront.destroy({ children: true });
  }

  startSpin(side: 'buff' | 'curse'): void {
    const w = side === 'buff' ? this.buff : this.curse;
    if (w.spinning || w.spun) return;
    w.spinning = true;

    const segs = w.segments;
    const luck = this.opts.getLuck();
    const target = pickSegmentWithLuck(segs, luck);
    w.resultIdx = target;

    if (this.mode === 'slot') {
      // Slot mode — w.angle is a y-offset (px) of the reel strip.
      // Strip layout: each segment occupies SLOT_ROW_H. Centering segment 0
      // at the win line means the strip's y-offset is 0; segment N centered
      // means strip y = -N * SLOT_ROW_H. Add full strip-rotations for spin feel.
      const rowH = w.radius * 0.32;
      const baseTarget = -target * rowH;
      const fullCycles = 5 + Math.floor(Math.random() * 3);
      const jitter = (Math.random() - 0.5) * rowH * 0.4;
      let goal = baseTarget - fullCycles * SEG_COUNT * rowH + jitter;
      while (goal > w.angle - rowH * SEG_COUNT * 4) goal -= SEG_COUNT * rowH;
      w.spinStart = w.angle;
      w.spinTarget = goal;
    } else {
      // Wheel rotation that lands segment center under top pointer (-PI/2)
      const baseTarget = -Math.PI / 2 - target * SEG_ANGLE;
      const fullRotations = 5 + Math.floor(Math.random() * 3);
      const jitter = (Math.random() - 0.5) * SEG_ANGLE * 0.6;
      let goal = baseTarget + fullRotations * Math.PI * 2 + jitter;
      while (goal < w.angle + Math.PI * 4) goal += Math.PI * 2;
      w.spinStart = w.angle;
      w.spinTarget = goal;
    }
    w.t0 = performance.now();
    w.durMs = 3800 + Math.random() * 600;
  }

  isSpinning(side: 'buff' | 'curse'): boolean {
    return (side === 'buff' ? this.buff : this.curse).spinning;
  }
  isSpun(side: 'buff' | 'curse'): boolean {
    return (side === 'buff' ? this.buff : this.curse).spun;
  }

  // ============== Layout ==============
  private onResize = () => this.layout();

  private layout(): void {
    const g = this.geometry();

    // Clear and rebuild
    this.bgLayer.removeChildren();
    this.deathBack.removeChildren();
    this.wheelsLayer.removeChildren();
    this.deathFront.removeChildren();

    this.drawBackground(g);
    this.drawDeathBack(g);
    this.buff = this.createWheelState(g.buffCx, g.cy, g.wheelR, this.buffSegments, 'buff');
    this.curse = this.createWheelState(g.curseCx, g.cy, g.wheelR, this.curseSegments, 'curse');
    this.drawDeathFront(g);
  }

  private geometry(): Geometry {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const wheelR = Math.min(w * 0.14, h * 0.20);
    const cy = h * 0.6;
    const offset = wheelR * 1.95;
    return {
      w, h, cy, wheelR,
      buffCx: w / 2 - offset,
      curseCx: w / 2 + offset,
      deathCx: w / 2,
    };
  }

  // ============== Background atmosphere ==============
  private drawBackground(g: Geometry): void {
    const { w, h } = g;

    // Floor mist
    const mist = new Graphics();
    mist.rect(0, h * 0.7, w, h * 0.3);
    mist.fill({ color: 0x282838, alpha: 0.2 });
    this.bgLayer.addChild(mist);

    // Floor line
    const floor = new Graphics();
    floor.rect(0, h * 0.92, w, 3);
    floor.fill({ color: 0x0a0a0c });
    this.bgLayer.addChild(floor);

    // Ambient floor shadow under figure
    const shadow = new Graphics();
    const r = g.wheelR * 4.5;
    shadow.ellipse(g.deathCx, h * 0.93, r, r * 0.25);
    shadow.fill({ color: 0x000000, alpha: 0.45 });
    this.bgLayer.addChild(shadow);
  }

  // ============== Death back (cloak, hood, eyes) ==============
  // Layered silhouette + sculpted skull + gold-trimmed cloak + backlight halo.
  // All Pixi Graphics primitives — no external assets required.
  private drawDeathBack(g: Geometry): void {
    const { deathCx, cy, wheelR, h } = g;
    const headTopY    = cy - wheelR * 2.35;
    const headCenterY = cy - wheelR * 1.65;
    const collarY     = cy - wheelR * 0.95;
    const shoulderY   = cy - wheelR * 0.65;
    const robeBottom  = h + 30;

    const robeBottomHalf   = wheelR * 4.6;
    const robeMidHalf      = wheelR * 2.7;
    const robeShoulderHalf = wheelR * 2.1;

    // ---- 0. Backlight halo behind the head (cold moonlight) ----
    const halo = new Graphics();
    for (let i = 6; i >= 1; i--) {
      const t = i / 6;
      halo.circle(deathCx, headCenterY, wheelR * (1.4 + t * 1.3));
      halo.fill({ color: 0x6a8acc, alpha: 0.025 * t });
    }
    this.deathBack.addChild(halo);

    // (Scythe sprite added AFTER the cloak below so it visibly overlaps the
    // shoulder. See "Scythe overlay" block farther down.)

    // ---- 2. Cloak — three depth layers for a painted look ----
    // Outer (darkest) silhouette — slightly larger than the main shape.
    const buildCloakPath = (g0: Graphics, expand: number) => {
      g0.moveTo(deathCx, headTopY - expand);
      g0.bezierCurveTo(
        deathCx + wheelR * 0.95 + expand, headTopY + wheelR * 0.25,
        deathCx + wheelR * 1.35 + expand, collarY - wheelR * 0.05,
        deathCx + robeShoulderHalf + expand, shoulderY + wheelR * 0.1
      );
      g0.bezierCurveTo(
        deathCx + robeMidHalf + expand, cy + wheelR * 0.4,
        deathCx + robeBottomHalf + expand, cy + wheelR * 1.6,
        deathCx + robeBottomHalf + expand, robeBottom
      );
      g0.lineTo(deathCx - robeBottomHalf - expand, robeBottom);
      g0.bezierCurveTo(
        deathCx - robeBottomHalf - expand, cy + wheelR * 1.6,
        deathCx - robeMidHalf - expand, cy + wheelR * 0.4,
        deathCx - robeShoulderHalf - expand, shoulderY + wheelR * 0.1
      );
      g0.bezierCurveTo(
        deathCx - wheelR * 1.35 - expand, collarY - wheelR * 0.05,
        deathCx - wheelR * 0.95 - expand, headTopY + wheelR * 0.25,
        deathCx, headTopY - expand
      );
      g0.closePath();
    };

    // Outer dark shadow
    const cloakShadow = new Graphics();
    buildCloakPath(cloakShadow, 4);
    cloakShadow.fill({ color: 0x080812 });
    this.deathBack.addChild(cloakShadow);

    // Mid-tone body
    const cloak = new Graphics();
    buildCloakPath(cloak, 0);
    cloak.fill({ color: 0x1c1c2a });
    cloak.stroke({ color: 0x2e2e40, width: 1.5 });
    this.deathBack.addChild(cloak);

    // Inner highlight strip — narrower silhouette in a slightly lighter hue,
    // anchored down the centerline so the figure reads as 3D not flat.
    const innerLight = new Graphics();
    innerLight.moveTo(deathCx, headTopY + wheelR * 0.15);
    innerLight.bezierCurveTo(
      deathCx + wheelR * 0.45, collarY + wheelR * 0.05,
      deathCx + wheelR * 1.0, cy + wheelR * 0.5,
      deathCx + wheelR * 1.6, robeBottom
    );
    innerLight.lineTo(deathCx - wheelR * 1.6, robeBottom);
    innerLight.bezierCurveTo(
      deathCx - wheelR * 1.0, cy + wheelR * 0.5,
      deathCx - wheelR * 0.45, collarY + wheelR * 0.05,
      deathCx, headTopY + wheelR * 0.15
    );
    innerLight.closePath();
    innerLight.fill({ color: 0x2a2a3c, alpha: 0.55 });
    this.deathBack.addChild(innerLight);

    // ---- 3. Side rim lights (cool left, warm right for dramatic contrast) ----
    const rimL = new Graphics();
    rimL.moveTo(deathCx, headTopY);
    rimL.bezierCurveTo(
      deathCx - wheelR * 0.95, headTopY + wheelR * 0.25,
      deathCx - wheelR * 1.35, collarY - wheelR * 0.05,
      deathCx - robeShoulderHalf, shoulderY + wheelR * 0.1
    );
    rimL.bezierCurveTo(
      deathCx - robeMidHalf, cy + wheelR * 0.4,
      deathCx - robeBottomHalf, cy + wheelR * 1.6,
      deathCx - robeBottomHalf, robeBottom
    );
    rimL.lineTo(deathCx - robeBottomHalf + 14, robeBottom);
    rimL.bezierCurveTo(
      deathCx - robeBottomHalf + 14, cy + wheelR * 1.6,
      deathCx - robeMidHalf + 10, cy + wheelR * 0.4,
      deathCx - robeShoulderHalf + 8, shoulderY + wheelR * 0.1
    );
    rimL.bezierCurveTo(
      deathCx - wheelR * 1.27, collarY - wheelR * 0.05,
      deathCx - wheelR * 0.88, headTopY + wheelR * 0.25,
      deathCx, headTopY
    );
    rimL.closePath();
    rimL.fill({ color: 0x9aaee0, alpha: 0.32 });
    this.deathBack.addChild(rimL);

    const rimR = new Graphics();
    rimR.moveTo(deathCx, headTopY);
    rimR.bezierCurveTo(
      deathCx + wheelR * 0.95, headTopY + wheelR * 0.25,
      deathCx + wheelR * 1.35, collarY - wheelR * 0.05,
      deathCx + robeShoulderHalf, shoulderY + wheelR * 0.1
    );
    rimR.bezierCurveTo(
      deathCx + robeMidHalf, cy + wheelR * 0.4,
      deathCx + robeBottomHalf, cy + wheelR * 1.6,
      deathCx + robeBottomHalf, robeBottom
    );
    rimR.lineTo(deathCx + robeBottomHalf - 12, robeBottom);
    rimR.bezierCurveTo(
      deathCx + robeBottomHalf - 12, cy + wheelR * 1.6,
      deathCx + robeMidHalf - 8, cy + wheelR * 0.4,
      deathCx + robeShoulderHalf - 6, shoulderY + wheelR * 0.1
    );
    rimR.bezierCurveTo(
      deathCx + wheelR * 1.29, collarY - wheelR * 0.05,
      deathCx + wheelR * 0.90, headTopY + wheelR * 0.25,
      deathCx, headTopY
    );
    rimR.closePath();
    rimR.fill({ color: 0xc88a48, alpha: 0.20 });
    this.deathBack.addChild(rimR);

    // ---- 4. Cloak fold lines — more of them, varied weight ----
    const folds = new Graphics();
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      const xT = deathCx + i * wheelR * 0.5;
      const xB = deathCx + i * wheelR * 0.95;
      folds.moveTo(xT, shoulderY + wheelR * 0.4);
      folds.bezierCurveTo(xT, cy + wheelR * 0.5, xB, cy + wheelR * 1.4, xB, robeBottom * 0.95);
    }
    folds.stroke({ color: 0xffffff, alpha: 0.10, width: 1.2 });
    // Deeper shadow folds
    const foldShadow = new Graphics();
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      const xT = deathCx + i * wheelR * 0.5 + 2;
      const xB = deathCx + i * wheelR * 0.95 + 3;
      foldShadow.moveTo(xT, shoulderY + wheelR * 0.4);
      foldShadow.bezierCurveTo(xT, cy + wheelR * 0.5, xB, cy + wheelR * 1.4, xB, robeBottom * 0.95);
    }
    foldShadow.stroke({ color: 0x000000, alpha: 0.4, width: 2 });
    this.deathBack.addChild(foldShadow);
    this.deathBack.addChild(folds);

    // ---- 5. Gold-trimmed cloak hem at the bottom edge ----
    const hem = new Graphics();
    hem.moveTo(deathCx - robeBottomHalf, robeBottom - 6);
    hem.bezierCurveTo(
      deathCx - robeBottomHalf * 0.7, robeBottom - 14,
      deathCx - robeBottomHalf * 0.35, robeBottom - 10,
      deathCx, robeBottom - 8
    );
    hem.bezierCurveTo(
      deathCx + robeBottomHalf * 0.35, robeBottom - 10,
      deathCx + robeBottomHalf * 0.7, robeBottom - 14,
      deathCx + robeBottomHalf, robeBottom - 6
    );
    hem.stroke({ color: 0xc9a227, alpha: 0.55, width: 2.2 });
    this.deathBack.addChild(hem);

    // ---- 6. Hood — sharper rim highlight + interior shadow ring ----
    const rimLine = new Graphics();
    rimLine.moveTo(deathCx - wheelR * 1.35, collarY - wheelR * 0.05);
    rimLine.bezierCurveTo(
      deathCx - wheelR * 0.95, headTopY + wheelR * 0.25,
      deathCx - wheelR * 0.4,  headTopY - wheelR * 0.05,
      deathCx, headTopY
    );
    rimLine.bezierCurveTo(
      deathCx + wheelR * 0.4,  headTopY - wheelR * 0.05,
      deathCx + wheelR * 0.95, headTopY + wheelR * 0.25,
      deathCx + wheelR * 1.35, collarY - wheelR * 0.05
    );
    rimLine.stroke({ color: 0xeeeef2, alpha: 0.45, width: 2.2 });
    this.deathBack.addChild(rimLine);

    // Hood interior shadow band — gives the hood depth.
    const hoodShadow = new Graphics();
    hoodShadow.moveTo(deathCx - wheelR * 1.05, collarY - wheelR * 0.15);
    hoodShadow.bezierCurveTo(
      deathCx - wheelR * 0.75, headTopY + wheelR * 0.4,
      deathCx - wheelR * 0.3,  headTopY + wheelR * 0.18,
      deathCx, headTopY + wheelR * 0.18
    );
    hoodShadow.bezierCurveTo(
      deathCx + wheelR * 0.3,  headTopY + wheelR * 0.18,
      deathCx + wheelR * 0.75, headTopY + wheelR * 0.4,
      deathCx + wheelR * 1.05, collarY - wheelR * 0.15
    );
    hoodShadow.stroke({ color: 0x000000, alpha: 0.55, width: 4 });
    this.deathBack.addChild(hoodShadow);

    // ---- 7. Hood opening (face void) ----
    const hoodOpenW = wheelR * 0.6;
    const hoodOpenH = wheelR * 0.85;
    const faceVoid = new Graphics();
    faceVoid.ellipse(deathCx, headCenterY, hoodOpenW, hoodOpenH);
    faceVoid.fill({ color: 0x000000 });
    this.deathBack.addChild(faceVoid);

    // ---- 8. Warm interior glow inside hood (candle from below) ----
    const hoodGlow = new Graphics();
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      hoodGlow.ellipse(
        deathCx,
        headCenterY + hoodOpenH * 0.1,
        hoodOpenW * (1.2 - t * 0.25),
        hoodOpenH * (1.0 - t * 0.2)
      );
      hoodGlow.fill({ color: 0xb04820, alpha: 0.16 - t * 0.025 });
    }
    this.deathBack.addChild(hoodGlow);

    // ---- 9. Detailed skull — cranium, eye sockets, nose, jawline, teeth ----
    const skull = new Graphics();
    const skullColor = 0xd8cfba;
    const shadowColor = 0x4e463a;

    // Cranium — bone-colored ellipse.
    skull.ellipse(
      deathCx,
      headCenterY - hoodOpenH * 0.18,
      hoodOpenW * 0.55,
      hoodOpenH * 0.5
    );
    skull.fill({ color: skullColor, alpha: 0.25 });
    skull.stroke({ color: shadowColor, alpha: 0.55, width: 1.4 });

    // Eye sockets — deep dark voids (the glowing eyes go inside).
    const eyeSocketDx = hoodOpenW * 0.27;
    const eyeSocketY = headCenterY - hoodOpenH * 0.1;
    const eyeSocketR = hoodOpenW * 0.18;
    skull.circle(deathCx - eyeSocketDx, eyeSocketY, eyeSocketR);
    skull.fill({ color: 0x000000, alpha: 0.95 });
    skull.circle(deathCx + eyeSocketDx, eyeSocketY, eyeSocketR);
    skull.fill({ color: 0x000000, alpha: 0.95 });
    // Eye socket rims for definition.
    skull.circle(deathCx - eyeSocketDx, eyeSocketY, eyeSocketR);
    skull.stroke({ color: shadowColor, alpha: 0.7, width: 1.0 });
    skull.circle(deathCx + eyeSocketDx, eyeSocketY, eyeSocketR);
    skull.stroke({ color: shadowColor, alpha: 0.7, width: 1.0 });

    // Nose cavity — inverted triangle.
    const noseY = headCenterY + hoodOpenH * 0.05;
    skull.moveTo(deathCx - hoodOpenW * 0.06, noseY);
    skull.lineTo(deathCx + hoodOpenW * 0.06, noseY);
    skull.lineTo(deathCx, noseY + hoodOpenH * 0.16);
    skull.closePath();
    skull.fill({ color: 0x000000, alpha: 0.85 });
    skull.stroke({ color: shadowColor, alpha: 0.6, width: 0.9 });

    // Cheekbones — angled shadow lines under each socket.
    skull.moveTo(deathCx - eyeSocketDx - hoodOpenW * 0.05, eyeSocketY + eyeSocketR);
    skull.lineTo(deathCx - hoodOpenW * 0.10, headCenterY + hoodOpenH * 0.18);
    skull.stroke({ color: shadowColor, alpha: 0.45, width: 1.2 });
    skull.moveTo(deathCx + eyeSocketDx + hoodOpenW * 0.05, eyeSocketY + eyeSocketR);
    skull.lineTo(deathCx + hoodOpenW * 0.10, headCenterY + hoodOpenH * 0.18);
    skull.stroke({ color: shadowColor, alpha: 0.45, width: 1.2 });

    // Jaw — curved bottom.
    skull.moveTo(deathCx - hoodOpenW * 0.42, headCenterY + hoodOpenH * 0.20);
    skull.bezierCurveTo(
      deathCx - hoodOpenW * 0.35, headCenterY + hoodOpenH * 0.42,
      deathCx + hoodOpenW * 0.35, headCenterY + hoodOpenH * 0.42,
      deathCx + hoodOpenW * 0.42, headCenterY + hoodOpenH * 0.20
    );
    skull.stroke({ color: shadowColor, alpha: 0.65, width: 1.3 });

    // Teeth — three short vertical lines on the jaw line.
    const teethY = headCenterY + hoodOpenH * 0.30;
    for (let t = -2; t <= 2; t++) {
      const tx = deathCx + t * hoodOpenW * 0.10;
      skull.moveTo(tx, teethY - hoodOpenH * 0.06);
      skull.lineTo(tx, teethY + hoodOpenH * 0.05);
      skull.stroke({ color: shadowColor, alpha: 0.55, width: 1 });
    }

    this.deathBack.addChild(skull);

    // ---- 10. Eyes — store reference for animated alpha pulse ----
    this.eyeBlink = new Graphics();
    this.deathBack.addChild(this.eyeBlink);
    this.drawEyes(deathCx, eyeSocketY, eyeSocketDx, eyeSocketR * 0.7, 1);

    // ---- 11. Scythe overlay (#42) — real CC0 scythe2.png peeking past
    // the right shoulder. Drawn LAST so it visibly overlaps the cloak.
    // Source sprite is 32×32; use scale (not width/height) so it works
    // regardless of texture-load timing.
    const SCYTHE_URL = `${import.meta.env.BASE_URL}assets/tiles/dungeon-crawl/item/weapon/scythe2.png`;
    const scytheSprite = new Sprite(Texture.from(SCYTHE_URL));
    scytheSprite.anchor.set(0.1, 0.9); // handle-bottom-left
    // Scale 32px source up to roughly head-height (wheelR * 3 / 32 = 0.094 * wheelR).
    // For wheelR ≈ 100, scale ≈ 9.4 → ~300px sprite. Visible.
    scytheSprite.scale.set(wheelR * 0.10);
    // Position at upper-right of head/shoulder.
    scytheSprite.position.set(deathCx + wheelR * 1.5, headCenterY + wheelR * 0.5);
    // Tilt so blade points up-right
    scytheSprite.rotation = -Math.PI * 0.30;
    scytheSprite.tint = 0xeae6da;
    this.deathBack.addChild(scytheSprite);
  }

  private drawEyes(cx: number, cy: number, dx: number, r: number, alpha: number): void {
    const g = this.eyeBlink!;
    g.clear();
    // Outer aura — concentric circles fake the bloom (no GlowFilter dep)
    for (let layer = 6; layer >= 1; layer--) {
      const a = (alpha * 0.55 * layer) / 6;
      const rad = r * layer * 1.0;
      g.circle(cx - dx, cy, rad).fill({ color: 0xffc850, alpha: a * 0.35 });
      g.circle(cx + dx, cy, rad).fill({ color: 0xffc850, alpha: a * 0.35 });
    }
    // Bright cores
    g.circle(cx - dx, cy, r * 0.55).fill({ color: 0xffeebd, alpha });
    g.circle(cx + dx, cy, r * 0.55).fill({ color: 0xffeebd, alpha });
  }

  // ============== Wheels ==============
  private createWheelState(
    cx: number,
    cy: number,
    r: number,
    segments: WheelSegment[],
    kind: 'buff' | 'curse'
  ): WheelState {
    if (this.mode === 'slot') return this.createSlotState(cx, cy, r, segments, kind);
    return this.createPieWheelState(cx, cy, r, segments, kind);
  }

  /** Slot-machine reel — 12 vertical rows, scrolls past a center "win line". */
  private createSlotState(
    cx: number,
    cy: number,
    r: number,
    segments: WheelSegment[],
    kind: 'buff' | 'curse'
  ): WheelState {
    const rowH = r * 0.32;
    const reelW = r * 1.6;
    const reelHalfH = r * 1.05;        // visible window half-height
    const accent = kind === 'buff' ? 0x69b070 : 0xe04848;

    // Frame + window (drawn into wheelsLayer in stage coords, NOT scrolled).
    const frame = new Graphics();
    frame.roundRect(cx - reelW / 2 - 6, cy - reelHalfH - 6, reelW + 12, reelHalfH * 2 + 12, 10);
    frame.fill({ color: 0x0a0a10 });
    frame.roundRect(cx - reelW / 2 - 6, cy - reelHalfH - 6, reelW + 12, reelHalfH * 2 + 12, 10);
    frame.stroke({ color: kind === 'buff' ? 0x3a5a3a : 0x5a2a2a, width: 4 });
    this.wheelsLayer.addChild(frame);

    // Container holds all 12 rows; we translate it up/down for the spin.
    const container = new Container();
    container.position.set(cx, cy);
    // Repeat the segments so the reel always shows content within the
    // visible window, even with the wrapped-angle scroll trick. Row centers
    // sit at INTEGER multiples of rowH (no `+ rowH/2`) so the snap formula
    // `angle = -resultIdx * rowH` lands a row exactly on the win line.
    const REPEAT = 4;
    for (let cycle = 0; cycle < REPEAT; cycle++) {
      for (let i = 0; i < SEG_COUNT; i++) {
        const seg = segments[i];
        const y = (i + cycle * SEG_COUNT - (REPEAT * SEG_COUNT) / 2) * rowH;
        // Row background
        const bg = new Graphics();
        bg.roundRect(-reelW / 2, y - rowH / 2 + 2, reelW, rowH - 4, 4);
        bg.fill({ color: parseInt(seg.color.replace('#', ''), 16) });
        bg.stroke({ color: 0x0a0a0c, width: 1.5 });
        container.addChild(bg);
        // Label
        const label = new Text({
          text: seg.label,
          style: new TextStyle({
            fontFamily: 'Cinzel, Georgia, serif',
            fontSize: Math.max(11, Math.round(r * 0.11)),
            fill: 0x0a0a0c,
            fontWeight: 'bold',
            align: 'center',
          }),
        });
        label.anchor.set(0.5);
        label.position.set(0, y);
        container.addChild(label);
      }
    }

    // Mask the container to the visible window so off-screen rows clip cleanly.
    const mask = new Graphics();
    mask.rect(cx - reelW / 2, cy - reelHalfH, reelW, reelHalfH * 2);
    mask.fill({ color: 0xffffff });
    this.wheelsLayer.addChild(mask);
    container.mask = mask;

    this.wheelsLayer.addChild(container);

    // Win line — horizontal accent stripe across the center of the window.
    const winLine = new Graphics();
    winLine.rect(cx - reelW / 2 - 4, cy - rowH / 2, reelW + 8, rowH);
    winLine.stroke({ color: accent, width: 2.5, alpha: 0.85 });
    this.wheelsLayer.addChild(winLine);

    // Side ticker pointers (left + right arrows pointing inward at the win line)
    const pointer = new Graphics();
    const tipX = cx + reelW / 2 + 4;
    const baseX = cx + reelW / 2 + 22;
    pointer.moveTo(tipX, cy);
    pointer.lineTo(baseX, cy - 10);
    pointer.lineTo(baseX, cy + 10);
    pointer.closePath();
    pointer.fill({ color: accent });
    pointer.stroke({ color: 0x0a0a0c, width: 2 });
    // Mirror on the left
    pointer.moveTo(cx - reelW / 2 - 4, cy);
    pointer.lineTo(cx - reelW / 2 - 22, cy - 10);
    pointer.lineTo(cx - reelW / 2 - 22, cy + 10);
    pointer.closePath();
    pointer.fill({ color: accent });
    pointer.stroke({ color: 0x0a0a0c, width: 2 });
    this.wheelsLayer.addChild(pointer);

    return {
      container,
      pointer,
      segments,
      angle: 0,
      spinning: false,
      spun: false,
      spinStart: 0,
      spinTarget: 0,
      t0: 0,
      durMs: 0,
      resultIdx: -1,
      cx,
      cy,
      radius: r,
      lastTickSegIdx: -1,
    };
  }

  /** Original pie-wheel renderer (kept intact so 'wheel' mode is unchanged). */
  private createPieWheelState(
    cx: number,
    cy: number,
    r: number,
    segments: WheelSegment[],
    kind: 'buff' | 'curse'
  ): WheelState {
    // Container that we rotate
    const container = new Container();
    container.position.set(cx, cy);

    // Backplate / outer ring
    const ring = new Graphics();
    ring.circle(0, 0, r * 1.04);
    ring.fill({ color: 0x0a0a10 });
    ring.circle(0, 0, r * 1.04);
    ring.stroke({ color: kind === 'buff' ? 0x3a5a3a : 0x5a2a2a, width: 4 });
    container.addChild(ring);

    // Slices
    for (let i = 0; i < SEG_COUNT; i++) {
      const seg = segments[i];
      const start = i * SEG_ANGLE - SEG_ANGLE / 2;
      const end = start + SEG_ANGLE;
      const slice = new Graphics();
      slice.moveTo(0, 0);
      slice.arc(0, 0, r, start, end);
      slice.closePath();
      slice.fill({ color: parseInt(seg.color.replace('#', ''), 16) });
      slice.stroke({ color: 0x0a0a0c, width: 2 });
      container.addChild(slice);

      // Label (Pixi Text rotated to match the slice)
      const label = new Text({
        text: seg.label,
        style: new TextStyle({
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: Math.max(10, Math.round(r * 0.085)),
          fill: 0x0a0a0c,
          fontWeight: 'bold',
          align: 'center',
        }),
      });
      label.anchor.set(0.5);
      const midA = start + SEG_ANGLE / 2;
      label.position.set(Math.cos(midA) * r * 0.62, Math.sin(midA) * r * 0.62);
      label.rotation = midA;
      container.addChild(label);
    }

    // Hub
    const hub = new Graphics();
    hub.circle(0, 0, r * 0.10);
    hub.fill({ color: 0x0a0a0c });
    hub.circle(0, 0, r * 0.10);
    hub.stroke({ color: kind === 'buff' ? 0x69b070 : 0xe04848, width: 2 });
    container.addChild(hub);

    this.wheelsLayer.addChild(container);

    // Pointer — sits in stage coords, NOT rotated with the wheel
    const pointer = new Graphics();
    const tipY = cy - r + 8;
    const baseY = cy - r - 18;
    const halfW = 12;
    pointer.moveTo(cx, tipY);
    pointer.lineTo(cx - halfW, baseY);
    pointer.lineTo(cx + halfW, baseY);
    pointer.closePath();
    pointer.fill({ color: kind === 'buff' ? 0x69b070 : 0xe04848 });
    pointer.stroke({ color: 0x0a0a0c, width: 2 });
    this.wheelsLayer.addChild(pointer);

    return {
      container,
      pointer,
      segments,
      angle: 0,
      spinning: false,
      spun: false,
      spinStart: 0,
      spinTarget: 0,
      t0: 0,
      durMs: 0,
      resultIdx: -1,
      cx,
      cy,
      radius: r,
      lastTickSegIdx: -1,
    };
  }

  // ============== Death front (skeletal finger fans) ==============
  private drawDeathFront(g: Geometry): void {
    // In slot mode the reels are rectangles, not circles, so the curved
    // finger-grip-around-wheel composition doesn't work — skip the fingers
    // and let Death simply stand behind the slot frames.
    if (this.mode === 'slot') return;
    this.drawFingers(g, -1, this.buff.cx, this.buff.cy, this.buff.radius);
    this.drawFingers(g, +1, this.curse.cx, this.curse.cy, this.curse.radius);
  }

  private drawFingers(
    _g: Geometry,
    sign: -1 | 1,
    wheelCx: number,
    wheelCy: number,
    wheelR: number
  ): void {
    const gripAngle = sign < 0 ? Math.PI * 0.78 : Math.PI * 0.22;
    const gripX = wheelCx + Math.cos(gripAngle) * (wheelR * 0.96);
    const gripY = wheelCy + Math.sin(gripAngle) * (wheelR * 0.96);
    const fanCenter = gripAngle;
    const fanSpread = Math.PI * 0.55;
    const fingerCount = 5;
    const lengthScales = [0.75, 1.05, 1.25, 1.10, 0.80];

    const layer = new Graphics();

    for (let i = 0; i < fingerCount; i++) {
      const t = i / (fingerCount - 1);
      const fingerAngle = fanCenter - fanSpread / 2 + t * fanSpread;
      const len = wheelR * lengthScales[i];
      const tipX = gripX + Math.cos(fingerAngle) * len;
      const tipY = gripY + Math.sin(fingerAngle) * len;
      const bendDir = sign < 0 ? -1 : 1;
      const perpX = Math.cos(fingerAngle + Math.PI / 2);
      const perpY = Math.sin(fingerAngle + Math.PI / 2);
      const ctrlX = (gripX + tipX) / 2 + perpX * len * 0.07 * bendDir;
      const ctrlY = (gripY + tipY) / 2 + perpY * len * 0.07 * bendDir;

      // Shadow
      layer.moveTo(gripX + 1, gripY + 2);
      layer.quadraticCurveTo(ctrlX + 1, ctrlY + 2, tipX + 1, tipY + 2);
      layer.stroke({ color: 0x000000, alpha: 0.55, width: 5, cap: 'round' });

      // Bone
      layer.moveTo(gripX, gripY);
      layer.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      layer.stroke({ color: 0xd4ccb2, width: 3.5, cap: 'round' });

      // Highlight
      layer.moveTo(gripX, gripY - 1);
      layer.quadraticCurveTo(ctrlX, ctrlY - 1, tipX, tipY - 1);
      layer.stroke({ color: 0xffffff, alpha: 0.35, width: 0.9, cap: 'round' });

      // Knuckle bump (mid)
      const u = 0.55;
      const kx = (1 - u) * (1 - u) * gripX + 2 * (1 - u) * u * ctrlX + u * u * tipX;
      const ky = (1 - u) * (1 - u) * gripY + 2 * (1 - u) * u * ctrlY + u * u * tipY;
      layer.circle(kx, ky, 2.3);
      layer.fill({ color: 0xdcd4ba });
      layer.circle(kx, ky, 2.3);
      layer.stroke({ color: 0x7a7260, width: 0.6 });

      // Claw nail at tip
      layer.circle(tipX, tipY, 1.8);
      layer.fill({ color: 0x1a1a1f });
    }

    // Palm joint at the grip
    layer.circle(gripX, gripY, wheelR * 0.085);
    layer.fill({ color: 0xdcd4ba });
    layer.circle(gripX, gripY, wheelR * 0.085);
    layer.stroke({ color: 0x6d6450, width: 1.4 });

    // Sleeve cuff — draws a dark cloak-colored band behind the palm so the
    // hand visibly emerges from a sleeve (and reads as "attached to body"
    // even when the cloak silhouette is partially obscured).
    const cuffOffset = wheelR * 0.18;
    const cuffAngle = sign < 0 ? Math.PI * 1.0 : Math.PI * 0.0; // toward body center
    const cuffX = gripX + Math.cos(cuffAngle) * cuffOffset;
    const cuffY = gripY + Math.sin(cuffAngle) * cuffOffset;
    layer.ellipse(cuffX, cuffY, wheelR * 0.22, wheelR * 0.13);
    layer.fill({ color: 0x1c1c2a });
    layer.ellipse(cuffX, cuffY, wheelR * 0.22, wheelR * 0.13);
    layer.stroke({ color: 0x2a2a3a, width: 1.2 });

    this.deathFront.addChild(layer);
  }

  // ============== Tick ==============
  private tick(deltaMs: number): void {
    const now = performance.now();
    this.eyePulseT += deltaMs / 1000;

    // Eye pulse — must mirror the geometry from drawDeathBack().
    if (this.eyeBlink) {
      const g = this.geometry();
      const headCenterY = g.cy - g.wheelR * 1.65;
      const hoodOpenW = g.wheelR * 0.6;
      const hoodOpenH = g.wheelR * 0.85;
      const eyeSocketDx = hoodOpenW * 0.27;
      const eyeSocketY = headCenterY - hoodOpenH * 0.1;
      const eyeSocketR = hoodOpenW * 0.18;
      const a = 0.7 + 0.3 * Math.sin(this.eyePulseT * 2.4);
      this.drawEyes(g.deathCx, eyeSocketY, eyeSocketDx, eyeSocketR * 0.7, a);
    }

    // Spin animation — branches by mode (rotation for wheel, y-translate for slot)
    for (const w of [this.buff, this.curse]) {
      if (!w.spinning) continue;
      const t = Math.min(1, (now - w.t0) / w.durMs);
      const eased = 1 - Math.pow(1 - t, 3);
      w.angle = w.spinStart + (w.spinTarget - w.spinStart) * eased;

      let segIdx: number;
      if (this.mode === 'slot') {
        // w.angle is the y-offset of the reel strip in px. After several
        // long spins the raw value would scroll past the bottom of the
        // 48-row strip and show black — wrap it to one strip-height for
        // rendering so the visible window always sees content.
        const rowH = w.radius * 0.32;
        const stripH = SEG_COUNT * rowH;
        const wrapped = ((w.angle % stripH) + stripH) % stripH - stripH;
        w.container.position.y = w.cy + wrapped;
        // The row currently centered on the win line is at index = -w.angle / rowH
        const rowFloat = -w.angle / rowH;
        segIdx = ((Math.round(rowFloat) % SEG_COUNT) + SEG_COUNT) % SEG_COUNT;
      } else {
        w.container.rotation = w.angle;
        const pointerSegFloat = (-Math.PI / 2 - w.angle) / SEG_ANGLE;
        segIdx = ((Math.round(pointerSegFloat) % SEG_COUNT) + SEG_COUNT) % SEG_COUNT;
      }

      if (segIdx !== w.lastTickSegIdx) {
        w.lastTickSegIdx = segIdx;
        // (#176) Slot-machine slowdown — pitch + volume ramp during last 30%
        // of the spin so the player HEARS the wheel decelerating.
        const slowdownT = Math.max(0, (t - 0.7) / 0.3); // 0 → 1 over last 30%
        const pitch = 1.0 + slowdownT * 0.4;
        const vol = 0.5 + slowdownT * 0.3;
        AudioManager.play('wheel_tick', { volume: vol, pitch });
      }

      if (t >= 1) {
        w.spinning = false;
        w.spun = true;
        if (this.mode === 'slot') {
          // Snap the y-offset to a clean row position so the result row
          // sits perfectly on the win line. Use the wrapped value so the
          // rendered position stays inside the strip's extent.
          const rowH = w.radius * 0.32;
          w.angle = -w.resultIdx * rowH;
          const stripH = SEG_COUNT * rowH;
          const wrapped = ((w.angle % stripH) + stripH) % stripH - stripH;
          w.container.position.y = w.cy + wrapped;
        } else {
          w.angle = ((w.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          w.container.rotation = w.angle;
        }

        // (#177) Near-miss tease — buff side only, when the result lands
        // adjacent to JACKPOT (segment with luckScore=12 = the gold one).
        // Plays a tense bell sting + flashes the JACKPOT slot gold so the
        // player sees what they almost won.
        const side: 'buff' | 'curse' = w === this.buff ? 'buff' : 'curse';
        const jackpotIdx = w.segments.findIndex((s) => s.label === 'JACKPOT');
        const isNearMiss =
          side === 'buff' &&
          jackpotIdx >= 0 &&
          w.resultIdx !== jackpotIdx &&
          (Math.abs(w.resultIdx - jackpotIdx) === 1 ||
            Math.abs(w.resultIdx - jackpotIdx) === SEG_COUNT - 1);
        if (isNearMiss) {
          AudioManager.play('boss_intro', { volume: 0.45, pitch: 0.7 });
          this.flashJackpotSlot(w, jackpotIdx);
        } else {
          AudioManager.play('wheel_stop', { volume: 0.7 });
        }

        this.opts.onSpinComplete(side, w.resultIdx);
      }
    }
  }

  /**
   * Briefly flash the JACKPOT segment with a gold edge — used on a near-miss
   * spin to signal "you almost won" (#177).
   */
  private flashJackpotSlot(w: WheelState, jackpotIdx: number): void {
    if (this.mode === 'slot') return; // visual hard to localize in slot mode
    const flash = new Graphics();
    const start = jackpotIdx * SEG_ANGLE - SEG_ANGLE / 2;
    const end = start + SEG_ANGLE;
    flash.moveTo(0, 0);
    flash.arc(0, 0, w.radius * 1.08, start, end);
    flash.closePath();
    flash.stroke({ color: 0xffe070, width: 6, alpha: 1 });
    flash.position.set(0, 0); // local to container which is rotated
    w.container.addChild(flash);
    const t0 = performance.now();
    const dur = 700;
    const animate = () => {
      const t = (performance.now() - t0) / dur;
      if (t >= 1) {
        flash.parent?.removeChild(flash);
        flash.destroy();
        return;
      }
      flash.alpha = 1 - t;
      requestAnimationFrame(animate);
    };
    animate();
  }
}
