// PixiJS-based Wheels scene engine — port of v0.5 wheels rendering.
// Renders the hooded Death figure + two wheels + skeletal finger fans,
// handles spin animation and per-segment resolution.

import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
} from 'pixi.js';
import type { WheelSegment } from '../../types';
import { SEG_ANGLE, SEG_COUNT } from '../../data/wheels';
import { pickSegmentWithLuck } from '../luck';

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
}

export class WheelsGame {
  private app: Application;
  private opts: WheelsGameOptions;

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
    this.buffSegments = buffSegments;
    this.curseSegments = curseSegments;

    app.stage.addChild(this.bgLayer);
    app.stage.addChild(this.deathBack);
    app.stage.addChild(this.wheelsLayer);
    app.stage.addChild(this.deathFront);
  }

  start(): void {
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

    // Wheel rotation that lands segment center under top pointer (-PI/2)
    const baseTarget = -Math.PI / 2 - target * SEG_ANGLE;
    const fullRotations = 5 + Math.floor(Math.random() * 3);
    const jitter = (Math.random() - 0.5) * SEG_ANGLE * 0.6;
    let goal = baseTarget + fullRotations * Math.PI * 2 + jitter;
    while (goal < w.angle + Math.PI * 4) goal += Math.PI * 2;

    w.spinStart = w.angle;
    w.spinTarget = goal;
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

    // Cloak silhouette — solid (Pixi v8 doesn't trivially do gradients)
    const cloak = new Graphics();
    cloak.moveTo(deathCx, headTopY);
    cloak.bezierCurveTo(
      deathCx + wheelR * 0.95, headTopY + wheelR * 0.25,
      deathCx + wheelR * 1.35, collarY - wheelR * 0.05,
      deathCx + robeShoulderHalf, shoulderY + wheelR * 0.1
    );
    cloak.bezierCurveTo(
      deathCx + robeMidHalf, cy + wheelR * 0.4,
      deathCx + robeBottomHalf, cy + wheelR * 1.6,
      deathCx + robeBottomHalf, robeBottom
    );
    cloak.lineTo(deathCx - robeBottomHalf, robeBottom);
    cloak.bezierCurveTo(
      deathCx - robeBottomHalf, cy + wheelR * 1.6,
      deathCx - robeMidHalf, cy + wheelR * 0.4,
      deathCx - robeShoulderHalf, shoulderY + wheelR * 0.1
    );
    cloak.bezierCurveTo(
      deathCx - wheelR * 1.35, collarY - wheelR * 0.05,
      deathCx - wheelR * 0.95, headTopY + wheelR * 0.25,
      deathCx, headTopY
    );
    cloak.closePath();
    cloak.fill({ color: 0x0e0e16 });
    this.deathBack.addChild(cloak);

    // Side rim light (cool moonlight on left edge) — overlay shape
    const rim = new Graphics();
    rim.moveTo(deathCx, headTopY);
    rim.bezierCurveTo(
      deathCx - wheelR * 0.95, headTopY + wheelR * 0.25,
      deathCx - wheelR * 1.35, collarY - wheelR * 0.05,
      deathCx - robeShoulderHalf, shoulderY + wheelR * 0.1
    );
    rim.bezierCurveTo(
      deathCx - robeMidHalf, cy + wheelR * 0.4,
      deathCx - robeBottomHalf, cy + wheelR * 1.6,
      deathCx - robeBottomHalf, robeBottom
    );
    rim.lineTo(deathCx, robeBottom);
    rim.lineTo(deathCx, headTopY);
    rim.closePath();
    rim.fill({ color: 0x8aa0d0, alpha: 0.06 });
    this.deathBack.addChild(rim);

    // Cloak fold lines
    const folds = new Graphics();
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const xT = deathCx + i * wheelR * 0.55;
      const xB = deathCx + i * wheelR * 0.95;
      folds.moveTo(xT, shoulderY + wheelR * 0.4);
      folds.bezierCurveTo(xT, cy + wheelR * 0.5, xB, cy + wheelR * 1.4, xB, robeBottom * 0.95);
    }
    folds.stroke({ color: 0xffffff, alpha: 0.05, width: 1.2 });
    this.deathBack.addChild(folds);

    // Hood rim highlight
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
    rimLine.stroke({ color: 0xdcdcdf, alpha: 0.1, width: 1.5 });
    this.deathBack.addChild(rimLine);

    // Hood opening (face void)
    const hoodOpenW = wheelR * 0.55;
    const hoodOpenH = wheelR * 0.8;
    const faceVoid = new Graphics();
    faceVoid.ellipse(deathCx, headCenterY, hoodOpenW, hoodOpenH);
    faceVoid.fill({ color: 0x000000 });
    this.deathBack.addChild(faceVoid);

    // Warm interior glow inside hood
    const hoodGlow = new Graphics();
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      hoodGlow.ellipse(
        deathCx,
        headCenterY,
        hoodOpenW * (1.3 - t * 0.3),
        hoodOpenH * (1.3 - t * 0.3)
      );
      hoodGlow.fill({ color: 0x963c1e, alpha: 0.12 - t * 0.025 });
    }
    this.deathBack.addChild(hoodGlow);

    // Faint skull silhouette inside hood
    const skull = new Graphics();
    skull.ellipse(
      deathCx,
      headCenterY - hoodOpenH * 0.05,
      hoodOpenW * 0.55,
      hoodOpenH * 0.5
    );
    skull.stroke({ color: 0xbeb4a0, alpha: 0.32, width: 1.1 });
    skull.moveTo(deathCx - hoodOpenW * 0.40, headCenterY + hoodOpenH * 0.15);
    skull.bezierCurveTo(
      deathCx - hoodOpenW * 0.32, headCenterY + hoodOpenH * 0.45,
      deathCx + hoodOpenW * 0.32, headCenterY + hoodOpenH * 0.45,
      deathCx + hoodOpenW * 0.40, headCenterY + hoodOpenH * 0.15
    );
    skull.stroke({ color: 0xbeb4a0, alpha: 0.32, width: 1.1 });
    skull.moveTo(deathCx, headCenterY + hoodOpenH * 0.10);
    skull.lineTo(deathCx - hoodOpenW * 0.06, headCenterY + hoodOpenH * 0.22);
    skull.lineTo(deathCx + hoodOpenW * 0.06, headCenterY + hoodOpenH * 0.22);
    skull.closePath();
    skull.fill({ color: 0x000000, alpha: 0.55 });
    this.deathBack.addChild(skull);

    // Eyes — store reference for animated alpha pulse
    this.eyeBlink = new Graphics();
    this.deathBack.addChild(this.eyeBlink);
    this.drawEyes(deathCx, headCenterY - hoodOpenH * 0.08, hoodOpenW * 0.32, hoodOpenW * 0.10, 1);
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
    // Container that we rotate
    const container = new Container();
    container.position.set(cx, cy);

    // Backplate / outer ring (drawn into container so it rotates with — actually
    // we'll keep ring stationary by drawing into wheelsLayer above)
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
    };
  }

  // ============== Death front (skeletal finger fans) ==============
  private drawDeathFront(g: Geometry): void {
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

    this.deathFront.addChild(layer);
  }

  // ============== Tick ==============
  private tick(deltaMs: number): void {
    const now = performance.now();
    this.eyePulseT += deltaMs / 1000;

    // Eye pulse
    if (this.eyeBlink) {
      // Re-derive the params we used originally; need to recompute geometry
      const g = this.geometry();
      const headCenterY = g.cy - g.wheelR * 1.65;
      const hoodOpenW = g.wheelR * 0.55;
      const a = 0.7 + 0.3 * Math.sin(this.eyePulseT * 2.4);
      this.drawEyes(
        g.deathCx,
        headCenterY - g.wheelR * 0.8 * 0.08,
        hoodOpenW * 0.32,
        hoodOpenW * 0.10,
        a
      );
    }

    // Spin animation
    for (const w of [this.buff, this.curse]) {
      if (!w.spinning) continue;
      const t = Math.min(1, (now - w.t0) / w.durMs);
      const eased = 1 - Math.pow(1 - t, 3);
      w.angle = w.spinStart + (w.spinTarget - w.spinStart) * eased;
      w.container.rotation = w.angle;
      if (t >= 1) {
        w.spinning = false;
        w.spun = true;
        w.angle = ((w.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        w.container.rotation = w.angle;
        const side: 'buff' | 'curse' = w === this.buff ? 'buff' : 'curse';
        this.opts.onSpinComplete(side, w.resultIdx);
      }
    }
  }
}
