import type { WeaponDef } from '../types';

export const WEAPONS: WeaponDef[] = [
  // Balance pass — DPS targets:
  //   melee 18-30 (close-range risk premium), ranged 22-28 (with positioning),
  //   magic 21-26 (tradeoffs in projectile shape), heavy 22-32 (slow + powerful).
  //   Outliers (rocket AOE, sniper range, scythe theme) earn extra DPS.
  // Melee carries a "contact tax" — playtest data showed Brute (club) only got
  // 6 kills/25s vs Soldier (rifle) 19 because every swing puts you in damage
  // range. Bumped melee DPS to ~1.4× ranged baseline to compensate.
  { id: 'fists',    name: 'Fists',           type: 'melee',  dmg: 10, atkspd: 2.0, range: 60,  projectiles: 1, color: '#dcd4ba', icon: '✊' },
  // Club: 22 → 28 (28 DPS, slow heavy melee).
  { id: 'club',     name: 'Club',            type: 'melee',  dmg: 28, atkspd: 1.0, range: 75,  projectiles: 1, color: '#8a5a30', icon: '🦴' },
  // Sword: 18 → 24 (33.6 DPS, balanced fast melee — Duelist).
  { id: 'sword',    name: 'Sword',           type: 'melee',  dmg: 24, atkspd: 1.4, range: 85,  projectiles: 1, color: '#c0c0d0', icon: '⚔' },
  // Axe: 26 → 36 (28.8 DPS, big slow swing).
  { id: 'axe',      name: 'Axe',             type: 'melee',  dmg: 36, atkspd: 0.8, range: 80,  projectiles: 1, color: '#80b0a0', icon: '🪓' },
  // Spear: 16 → 26 (31.2 DPS — already had reach 130, now hits hard too).
  { id: 'spear',    name: 'Spear',           type: 'melee',  dmg: 26, atkspd: 1.2, range: 130, projectiles: 1, color: '#b09060', icon: '🗡' },
  { id: 'pistol',   name: 'Pistol',          type: 'ranged', dmg: 11, atkspd: 2.0, range: 300, projectiles: 1, color: '#f0c84a', icon: '🔫' },
  { id: 'shotgun',  name: 'Shotgun',         type: 'ranged', dmg: 5,  atkspd: 0.8, range: 200, projectiles: 5, spread: 0.5, color: '#e08030', icon: '💥' },
  // SMG: was 15 DPS — bumped to 25 (5 × 5) for a sustained-fire-but-fragile pick.
  { id: 'smg',      name: 'SMG',             type: 'ranged', dmg: 5,  atkspd: 5.0, range: 240, projectiles: 1, color: '#f06070', icon: '🔫' },
  { id: 'sniper',   name: 'Sniper',          type: 'ranged', dmg: 45, atkspd: 0.5, range: 600, projectiles: 1, color: '#80c0f0', icon: '🎯' },
  { id: 'rifle',    name: 'Rifle',           type: 'ranged', dmg: 9,  atkspd: 3.0, range: 340, projectiles: 1, color: '#a08050', icon: '🔫' },
  { id: 'staff',    name: 'Staff',           type: 'magic',  dmg: 14, atkspd: 1.5, range: 320, projectiles: 1, color: '#5a8af0', icon: '✨' },
  { id: 'wand',     name: 'Wand',            type: 'magic',  dmg: 6,  atkspd: 4.0, range: 260, projectiles: 1, color: '#d050ff', icon: '✨' },
  // Orb: was 64.8 DPS (3 projectiles × 18 × 1.2) — outpacing every other weapon by 2.5×.
  // Cut per-projectile damage so the spread shape is the value, not raw DPS.
  { id: 'orb',      name: 'Crystal Orb',     type: 'magic',  dmg: 11, atkspd: 1.2, range: 280, projectiles: 3, spread: 0.5, color: '#80ffff', icon: '🔮' },
  { id: 'bow',      name: 'Bow',             type: 'ranged', dmg: 18, atkspd: 1.5, range: 380, projectiles: 1, color: '#a0d080', icon: '🏹' },
  { id: 'crossbow', name: 'Crossbow',        type: 'ranged', dmg: 24, atkspd: 1.0, range: 420, projectiles: 1, color: '#806040', icon: '🏹' },
  { id: 'knives',   name: 'Throwing Knives', type: 'ranged', dmg: 7,  atkspd: 3.5, range: 260, projectiles: 1, color: '#b0b0b0', icon: '🗡' },
  { id: 'flamer',   name: 'Flamethrower',    type: 'ranged', dmg: 4,  atkspd: 6.0, range: 160, projectiles: 1, color: '#ff8030', icon: '🔥' },
  // Minigun: was 16 DPS — bumped to 32 (4 × 8) so the spool-up rapid-fire is actually viable.
  { id: 'minigun',  name: 'Minigun',         type: 'ranged', dmg: 4,  atkspd: 8.0, range: 300, projectiles: 1, color: '#a0a0a0', icon: '🔫' },
  { id: 'rocket',   name: 'Rocket',          type: 'ranged', dmg: 55, atkspd: 0.4, range: 380, projectiles: 1, color: '#c08040', icon: '🚀', aoe: 60 },
  { id: 'scythe',   name: "Death's Scythe",  type: 'melee',  dmg: 30, atkspd: 1.5, range: 110, projectiles: 1, color: '#e0d8c0', icon: '☠' },
];

export const WEAPONS_BY_ID: Record<string, WeaponDef> = Object.fromEntries(
  WEAPONS.map((w) => [w.id, w])
);
