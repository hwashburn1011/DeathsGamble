// Per-build character sprite drawing — ported from v0.5.
// Each character has a distinct silhouette so the player visibly differs from
// the big hooded Death figure on the wheels scene.
// These are placeholder canvas-drawn sprites; we'll replace them with proper
// pixel-art sprite sheets in a follow-up task.

import type { BuildDef, Look } from '../types';

type Ctx = CanvasRenderingContext2D;

export function drawCharacter(ctx: Ctx, x: number, y: number, s: number, build: BuildDef): void {
  const look = build.look;
  switch (build.id) {
    case 'gambler':  return drawCharGambler(ctx, x, y, s, look);
    case 'duelist':  return drawCharDuelist(ctx, x, y, s, look);
    case 'brute':    return drawCharBrute(ctx, x, y, s, look);
    case 'arcanist': return drawCharArcanist(ctx, x, y, s, look);
    case 'rogue':    return drawCharRogue(ctx, x, y, s, look);
    case 'huntsman': return drawCharHuntsman(ctx, x, y, s, look);
    case 'witch':    return drawCharWitch(ctx, x, y, s, look);
    case 'soldier':  return drawCharSoldier(ctx, x, y, s, look);
    default:         return drawCharHooded(ctx, x, y, s, look);
  }
}

function drawCharGambler(ctx: Ctx, x: number, y: number, s: number, look: Look) {
  ctx.fillStyle = look.robe;
  ctx.fillRect(x - 7 * s, y - 4 * s, 14 * s, 18 * s);
  ctx.fillStyle = '#e8e0c0';
  ctx.beginPath();
  ctx.moveTo(x - 3 * s, y - 4 * s);
  ctx.lineTo(x, y);
  ctx.lineTo(x + 3 * s, y - 4 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = look.accent;
  ctx.fillRect(x - 1 * s, y - 3 * s, 2 * s, 5 * s);
  ctx.fillStyle = '#d8c8a8';
  ctx.beginPath();
  ctx.arc(x, y - 9 * s, 4.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(x - 2.5 * s, y - 9 * s, 1.4 * s, 1.2 * s);
  ctx.fillRect(x + 1.1 * s, y - 9 * s, 1.4 * s, 1.2 * s);
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(x - 2.5 * s, y - 7 * s, 5 * s, 0.8 * s);
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(x - 6 * s, y - 13 * s, 12 * s, 1.2 * s);
  ctx.fillRect(x - 4 * s, y - 19 * s, 8 * s, 6 * s);
  ctx.fillStyle = look.accent;
  ctx.fillRect(x - 4 * s, y - 14.5 * s, 8 * s, 1 * s);
}

function drawCharDuelist(ctx: Ctx, x: number, y: number, s: number, look: Look) {
  ctx.fillStyle = look.robe;
  ctx.fillRect(x - 6 * s, y - 4 * s, 12 * s, 18 * s);
  ctx.fillStyle = look.accent;
  ctx.beginPath();
  ctx.moveTo(x - 7 * s, y - 6 * s);
  ctx.lineTo(x - 11 * s, y + 12 * s);
  ctx.lineTo(x - 4 * s, y + 4 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 7 * s, y - 6 * s);
  ctx.lineTo(x + 11 * s, y + 12 * s);
  ctx.lineTo(x + 4 * s, y + 4 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = look.accent;
  ctx.fillRect(x - 6 * s, y, 12 * s, 2 * s);
  ctx.fillStyle = '#d0c0a0';
  ctx.beginPath();
  ctx.arc(x, y - 9 * s, 4 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a0a0b0';
  ctx.beginPath();
  ctx.moveTo(x - 5 * s, y - 10 * s);
  ctx.lineTo(x, y - 18 * s);
  ctx.lineTo(x + 5 * s, y - 10 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(x - 3 * s, y - 9 * s, 6 * s, 1 * s);
  ctx.strokeStyle = '#c0c0c0';
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(x + 7 * s, y);
  ctx.lineTo(x + 7 * s, y + 10 * s);
  ctx.stroke();
  ctx.fillStyle = look.accent;
  ctx.fillRect(x + 5.5 * s, y - 1 * s, 3 * s, 1.2 * s);
}

function drawCharBrute(ctx: Ctx, x: number, y: number, s: number, look: Look) {
  ctx.fillStyle = '#d0b890';
  ctx.beginPath();
  ctx.ellipse(x, y, 9 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.robe;
  ctx.fillRect(x - 6 * s, y + 4 * s, 12 * s, 10 * s);
  ctx.fillStyle = look.accent;
  ctx.fillRect(x - 7 * s, y + 3 * s, 14 * s, 2 * s);
  ctx.fillStyle = '#d0b890';
  ctx.beginPath();
  ctx.arc(x, y - 8 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x - 3 * s, y - 10.5 * s, 2.5 * s, 0.8 * s);
  ctx.fillRect(x + 0.5 * s, y - 10.5 * s, 2.5 * s, 0.8 * s);
  ctx.fillRect(x - 2.5 * s, y - 8.5 * s, 1.5 * s, 0.7 * s);
  ctx.fillRect(x + 1 * s, y - 8.5 * s, 1.5 * s, 0.7 * s);
  ctx.strokeStyle = '#8a3030';
  ctx.lineWidth = 0.7 * s;
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y - 11 * s);
  ctx.lineTo(x + 4 * s, y - 5 * s);
  ctx.stroke();
}

function drawCharArcanist(ctx: Ctx, x: number, y: number, s: number, look: Look) {
  ctx.fillStyle = look.robe;
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y - 4 * s);
  ctx.lineTo(x - 9 * s, y + 14 * s);
  ctx.lineTo(x + 9 * s, y + 14 * s);
  ctx.lineTo(x + 4 * s, y - 4 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a2a10';
  ctx.fillRect(x - 5 * s, y + 1 * s, 10 * s, 1.5 * s);
  ctx.fillStyle = look.accent;
  ctx.fillRect(x - 1 * s, y + 0.5 * s, 2 * s, 2.5 * s);
  ctx.fillStyle = '#d8d0c0';
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y - 7 * s);
  ctx.bezierCurveTo(x - 4 * s, y - 1 * s, x + 4 * s, y - 1 * s, x + 4 * s, y - 7 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d0c0a0';
  ctx.beginPath();
  ctx.arc(x, y - 9 * s, 4 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.accent;
  ctx.fillRect(x - 2.5 * s, y - 9 * s, 1.4 * s, 1 * s);
  ctx.fillRect(x + 1.1 * s, y - 9 * s, 1.4 * s, 1 * s);
  ctx.fillStyle = look.robe;
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y - 12 * s);
  ctx.lineTo(x + 6 * s, y - 12 * s);
  ctx.lineTo(x + 1 * s, y - 22 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 7 * s, y - 12.5 * s, 14 * s, 1.5 * s);
  ctx.fillStyle = look.accent;
  ctx.fillRect(x - 0.6 * s, y - 17 * s, 1.2 * s, 1.2 * s);
}

function drawCharRogue(ctx: Ctx, x: number, y: number, s: number, look: Look) {
  ctx.fillStyle = look.robe;
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y + 14 * s);
  ctx.lineTo(x - 5 * s, y - 6 * s);
  ctx.bezierCurveTo(x - 5 * s, y - 13 * s, x + 5 * s, y - 13 * s, x + 5 * s, y - 6 * s);
  ctx.lineTo(x + 6 * s, y + 14 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y - 8 * s, 3 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.accent;
  ctx.fillRect(x - 1.7 * s, y - 8 * s, 1.1 * s, 0.7 * s);
  ctx.fillRect(x + 0.6 * s, y - 8 * s, 1.1 * s, 0.7 * s);
  ctx.strokeStyle = '#c0c0c0';
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y + 1 * s);
  ctx.lineTo(x - 1 * s, y + 6 * s);
  ctx.moveTo(x + 6 * s, y + 1 * s);
  ctx.lineTo(x + 1 * s, y + 6 * s);
  ctx.stroke();
  ctx.fillStyle = look.accent;
  ctx.beginPath();
  ctx.arc(x - 6 * s, y + 1 * s, 0.9 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 6 * s, y + 1 * s, 0.9 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawCharHuntsman(ctx: Ctx, x: number, y: number, s: number, look: Look) {
  ctx.fillStyle = look.robe;
  ctx.fillRect(x - 6 * s, y - 3 * s, 12 * s, 17 * s);
  ctx.fillStyle = look.robe;
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y - 4 * s);
  ctx.bezierCurveTo(x - 7 * s, y - 14 * s, x + 7 * s, y - 14 * s, x + 6 * s, y - 4 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d8c0a0';
  ctx.beginPath();
  ctx.arc(x, y - 8 * s, 3.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(x - 2 * s, y - 8 * s, 1.2 * s, 1 * s);
  ctx.fillRect(x + 0.8 * s, y - 8 * s, 1.2 * s, 1 * s);
  ctx.fillStyle = '#5a3010';
  ctx.fillRect(x - 7 * s, y + 3 * s, 14 * s, 1.5 * s);
  ctx.strokeStyle = look.accent;
  ctx.lineWidth = 1.3 * s;
  ctx.beginPath();
  ctx.arc(x + 9 * s, y + 2 * s, 8 * s, -Math.PI * 0.32, Math.PI * 0.32);
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 0.4 * s;
  const a1 = -0.32 * Math.PI;
  const a2 = 0.32 * Math.PI;
  ctx.beginPath();
  ctx.moveTo(x + 9 * s + Math.cos(a1) * 8 * s, y + 2 * s + Math.sin(a1) * 8 * s);
  ctx.lineTo(x + 9 * s + Math.cos(a2) * 8 * s, y + 2 * s + Math.sin(a2) * 8 * s);
  ctx.stroke();
}

function drawCharWitch(ctx: Ctx, x: number, y: number, s: number, look: Look) {
  ctx.fillStyle = look.robe;
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y - 4 * s);
  ctx.lineTo(x - 8 * s, y + 14 * s);
  ctx.lineTo(x + 8 * s, y + 14 * s);
  ctx.lineTo(x + 4 * s, y - 4 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = look.accent;
  ctx.fillRect(x - 0.6 * s, y + 4 * s, 1.2 * s, 1.2 * s);
  ctx.fillStyle = '#e8d0c8';
  ctx.beginPath();
  ctx.arc(x, y - 8 * s, 3.8 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.accent;
  ctx.fillRect(x - 2 * s, y - 8 * s, 1.2 * s, 1 * s);
  ctx.fillRect(x + 0.8 * s, y - 8 * s, 1.2 * s, 1 * s);
  ctx.fillStyle = '#0a0a0c';
  ctx.beginPath();
  ctx.moveTo(x - 7 * s, y - 11 * s);
  ctx.lineTo(x + 7 * s, y - 11 * s);
  ctx.lineTo(x + 3 * s, y - 23 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = look.accent;
  ctx.fillRect(x - 6 * s, y - 12.5 * s, 12 * s, 1.5 * s);
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(x - 8.5 * s, y - 11.2 * s, 17 * s, 1.4 * s);
}

function drawCharSoldier(ctx: Ctx, x: number, y: number, s: number, look: Look) {
  ctx.fillStyle = look.robe;
  ctx.fillRect(x - 6 * s, y - 3 * s, 12 * s, 17 * s);
  ctx.fillStyle = '#1a2a1a';
  ctx.fillRect(x - 5 * s, y - 1 * s, 10 * s, 8 * s);
  ctx.fillStyle = look.accent;
  ctx.fillRect(x - 7 * s, y - 3 * s, 3 * s, 2 * s);
  ctx.fillRect(x + 4 * s, y - 3 * s, 3 * s, 2 * s);
  ctx.fillStyle = '#3a2a10';
  ctx.fillRect(x - 7 * s, y + 6 * s, 14 * s, 1.5 * s);
  ctx.fillStyle = '#d0b890';
  ctx.beginPath();
  ctx.arc(x, y - 8 * s, 4 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(x - 2 * s, y - 8 * s, 1.2 * s, 1 * s);
  ctx.fillRect(x + 0.8 * s, y - 8 * s, 1.2 * s, 1 * s);
  ctx.fillStyle = look.accent;
  ctx.beginPath();
  ctx.ellipse(x, y - 11 * s, 5.5 * s, 3.8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2a10';
  ctx.fillRect(x - 5 * s, y - 8 * s, 10 * s, 0.6 * s);
  ctx.strokeStyle = '#5a3a10';
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(x - 7 * s, y - 1 * s);
  ctx.lineTo(x + 7 * s, y + 11 * s);
  ctx.stroke();
}

function drawCharHooded(ctx: Ctx, x: number, y: number, s: number, look: Look) {
  ctx.fillStyle = look.robe;
  ctx.beginPath();
  ctx.moveTo(x - 11 * s, y - 14 * s);
  ctx.bezierCurveTo(x - 17 * s, y - 4 * s, x - 15 * s, y + 12 * s, x - 11 * s, y + 16 * s);
  ctx.lineTo(x + 11 * s, y + 16 * s);
  ctx.bezierCurveTo(x + 15 * s, y + 12 * s, x + 17 * s, y - 4 * s, x + 11 * s, y - 14 * s);
  ctx.bezierCurveTo(x + 9 * s, y - 18 * s, x - 9 * s, y - 18 * s, x - 11 * s, y - 14 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y - 9 * s, 6 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.accent;
  ctx.beginPath();
  ctx.arc(x - 2.4 * s, y - 9 * s, 1.2 * s, 0, Math.PI * 2);
  ctx.arc(x + 2.4 * s, y - 9 * s, 1.2 * s, 0, Math.PI * 2);
  ctx.fill();
}
