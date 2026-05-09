import type { EnemyTypeDef } from '../types';

export const ENEMY_TYPES: EnemyTypeDef[] = [
  { id: 'zombie',   hp: 8,  spd: 1.0, dmg: 6,  color: '#7a3030', size: 14, tier: 1, sprite: 'zombie' },
  { id: 'bat',      hp: 4,  spd: 2.2, dmg: 3,  color: '#5a3a5a', size: 10, tier: 1, sprite: 'bat' },
  { id: 'skeleton', hp: 12, spd: 1.3, dmg: 8,  color: '#c0b8a0', size: 14, tier: 1, sprite: 'skeleton' },
  { id: 'ghoul',    hp: 18, spd: 1.5, dmg: 10, color: '#5a7a4a', size: 16, tier: 2, sprite: 'ghoul' },
  { id: 'wraith',   hp: 10, spd: 2.5, dmg: 7,  color: '#809ac0', size: 13, tier: 2, sprite: 'wraith' },
  { id: 'tank',     hp: 50, spd: 0.6, dmg: 14, color: '#5a3a8a', size: 22, tier: 3, sprite: 'tank' },
  { id: 'imp',      hp: 6,  spd: 3.0, dmg: 4,  color: '#e04848', size: 11, tier: 1, sprite: 'imp' },
  { id: 'reaper',   hp: 80, spd: 1.0, dmg: 18, color: '#1a1a1a', size: 24, tier: 4, sprite: 'reaper' },
];

export const FINAL_BOSS = {
  id: 'death',
  name: 'Death Itself',
  hp: 1200,
  spd: 0.8,
  dmg: 30,
  color: '#000000',
  size: 55,
  sprite: 'boss' as const,
};
