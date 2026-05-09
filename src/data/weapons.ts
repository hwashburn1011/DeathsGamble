import type { WeaponDef } from '../types';

export const WEAPONS: WeaponDef[] = [
  { id: 'fists',    name: 'Fists',           type: 'melee',  dmg: 6,  atkspd: 2.0, range: 60,  projectiles: 1, color: '#dcd4ba', icon: '✊' },
  { id: 'club',     name: 'Club',            type: 'melee',  dmg: 14, atkspd: 1.0, range: 75,  projectiles: 1, color: '#8a5a30', icon: '🦴' },
  { id: 'sword',    name: 'Sword',           type: 'melee',  dmg: 18, atkspd: 1.4, range: 85,  projectiles: 1, color: '#c0c0d0', icon: '⚔' },
  { id: 'axe',      name: 'Axe',             type: 'melee',  dmg: 26, atkspd: 0.8, range: 80,  projectiles: 1, color: '#80b0a0', icon: '🪓' },
  { id: 'spear',    name: 'Spear',           type: 'melee',  dmg: 16, atkspd: 1.2, range: 130, projectiles: 1, color: '#b09060', icon: '🗡' },
  { id: 'pistol',   name: 'Pistol',          type: 'ranged', dmg: 11, atkspd: 2.0, range: 300, projectiles: 1, color: '#f0c84a', icon: '🔫' },
  { id: 'shotgun',  name: 'Shotgun',         type: 'ranged', dmg: 5,  atkspd: 0.8, range: 200, projectiles: 5, spread: 0.5, color: '#e08030', icon: '💥' },
  { id: 'smg',      name: 'SMG',             type: 'ranged', dmg: 3,  atkspd: 5.0, range: 240, projectiles: 1, color: '#f06070', icon: '🔫' },
  { id: 'sniper',   name: 'Sniper',          type: 'ranged', dmg: 45, atkspd: 0.5, range: 600, projectiles: 1, color: '#80c0f0', icon: '🎯' },
  { id: 'rifle',    name: 'Rifle',           type: 'ranged', dmg: 9,  atkspd: 3.0, range: 340, projectiles: 1, color: '#a08050', icon: '🔫' },
  { id: 'staff',    name: 'Staff',           type: 'magic',  dmg: 14, atkspd: 1.5, range: 320, projectiles: 1, color: '#5a8af0', icon: '✨' },
  { id: 'wand',     name: 'Wand',            type: 'magic',  dmg: 6,  atkspd: 4.0, range: 260, projectiles: 1, color: '#d050ff', icon: '✨' },
  { id: 'orb',      name: 'Crystal Orb',     type: 'magic',  dmg: 18, atkspd: 1.2, range: 280, projectiles: 3, spread: 0.5, color: '#80ffff', icon: '🔮' },
  { id: 'bow',      name: 'Bow',             type: 'ranged', dmg: 18, atkspd: 1.5, range: 380, projectiles: 1, color: '#a0d080', icon: '🏹' },
  { id: 'crossbow', name: 'Crossbow',        type: 'ranged', dmg: 24, atkspd: 1.0, range: 420, projectiles: 1, color: '#806040', icon: '🏹' },
  { id: 'knives',   name: 'Throwing Knives', type: 'ranged', dmg: 7,  atkspd: 3.5, range: 260, projectiles: 1, color: '#b0b0b0', icon: '🗡' },
  { id: 'flamer',   name: 'Flamethrower',    type: 'ranged', dmg: 4,  atkspd: 6.0, range: 160, projectiles: 1, color: '#ff8030', icon: '🔥' },
  { id: 'minigun',  name: 'Minigun',         type: 'ranged', dmg: 2,  atkspd: 8.0, range: 300, projectiles: 1, color: '#a0a0a0', icon: '🔫' },
  { id: 'rocket',   name: 'Rocket',          type: 'ranged', dmg: 55, atkspd: 0.4, range: 380, projectiles: 1, color: '#c08040', icon: '🚀', aoe: 60 },
  { id: 'scythe',   name: "Death's Scythe",  type: 'melee',  dmg: 30, atkspd: 1.5, range: 110, projectiles: 1, color: '#e0d8c0', icon: '☠' },
];

export const WEAPONS_BY_ID: Record<string, WeaponDef> = Object.fromEntries(
  WEAPONS.map((w) => [w.id, w])
);
