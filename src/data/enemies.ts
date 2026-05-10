import type { EnemyTypeDef } from '../types';

export const ENEMY_TYPES: EnemyTypeDef[] = [
  { id: 'zombie',   hp: 8,  spd: 1.0, dmg: 6,  color: '#7a3030', size: 14, tier: 1, sprite: 'zombie' },
  { id: 'bat',      hp: 4,  spd: 2.2, dmg: 3,  color: '#5a3a5a', size: 10, tier: 1, sprite: 'bat' },
  { id: 'skeleton', hp: 12, spd: 1.3, dmg: 8,  color: '#c0b8a0', size: 14, tier: 1, sprite: 'skeleton' },
  { id: 'ghoul',    hp: 18, spd: 1.5, dmg: 10, color: '#5a7a4a', size: 16, tier: 2, sprite: 'ghoul' },
  { id: 'wraith',   hp: 10, spd: 2.5, dmg: 7,  color: '#809ac0', size: 13, tier: 2, sprite: 'wraith' },
  { id: 'tank',     hp: 50, spd: 0.6, dmg: 14, color: '#5a3a8a', size: 22, tier: 3, sprite: 'tank' },
  // Imp: spd was 3.0 (≈ player base 3.2) — slow builds (Brute 2.5, Arcanist/Soldier 3.0)
  // got chased down with no kiting room. Dropped to 2.7 so the Brute can outrun by 0.3.
  { id: 'imp',      hp: 6,  spd: 2.7, dmg: 4,  color: '#e04848', size: 11, tier: 1, sprite: 'imp' },
  { id: 'reaper',   hp: 80, spd: 1.0, dmg: 18, color: '#1a1a1a', size: 24, tier: 4, sprite: 'reaper' },

  // ----- Ranged enemies (#114) -----
  // Skeleton archer — slow, fragile, shoots arrows from a distance.
  { id: 'archer',   hp: 14, spd: 0.8, dmg: 9,  color: '#b8a880', size: 14, tier: 2, sprite: 'archer',
    ranged: { range: 320, cooldownMs: 1800, projectileSpd: 280, projectileColor: 0xd4ccb2 } },
  // Fire imp — fast, fragile, lobs slow fireballs.
  { id: 'fireImp',  hp: 9,  spd: 2.4, dmg: 7,  color: '#ff7030', size: 12, tier: 2, sprite: 'fireImp',
    ranged: { range: 260, cooldownMs: 1300, projectileSpd: 220, projectileColor: 0xff7030 } },

  // ----- Elite tier (#116) — between reaper (80HP) and final boss (1200HP) -----
  // Lich Acolyte — moderate hp, slow, casts arcane bolts.
  { id: 'lichAcolyte', hp: 240, spd: 0.9, dmg: 14, color: '#5060c0', size: 26, tier: 5, sprite: 'lichAcolyte',
    ranged: { range: 360, cooldownMs: 1500, projectileSpd: 240, projectileColor: 0x80b0ff } },
  // Bone Knight — heavy melee bruiser, hits hard.
  { id: 'boneKnight', hp: 320, spd: 1.0, dmg: 24, color: '#a09080', size: 28, tier: 5, sprite: 'boneKnight' },
];

export const FINAL_BOSS = {
  id: 'death',
  name: 'Death Itself',
  hp: 1200,
  spd: 0.8,
  // Iter5 telemetry: dmg 30 left zero margin for unbuffed Soldier (died 26s
  // into boss fight). Players DO get wheel buffs but the floor was too thin.
  // Phase-2 already adds AOE pulse + 3-bolt fan, so contact dmg can soften.
  dmg: 24,
  color: '#000000',
  // Was 55 — visually only ~33% larger than tier-4 reaper. Bumped so the
  // boss reads as 2× the largest regular enemy at scale.
  size: 88,
  sprite: 'boss' as const,
};
