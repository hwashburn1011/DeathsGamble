import type { Difficulty, DifficultyDef } from '../types';

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  easy: {
    storyRaids: 2,
    curseMult: 0.5,
    enemyHpMult: 0.7,
    enemySpdMult: 0.9,
    enemySpawnMult: 0.7,
    enemyDmgMult: 0.7,
    cashMult: 1.5,
  },
  normal: {
    storyRaids: 3,
    curseMult: 1.0,
    enemyHpMult: 1.0,
    enemySpdMult: 1.0,
    enemySpawnMult: 1.0,
    enemyDmgMult: 1.0,
    cashMult: 1.0,
  },
  hard: {
    storyRaids: 5,
    curseMult: 1.4,
    enemyHpMult: 1.4,
    enemySpdMult: 1.15,
    enemySpawnMult: 1.4,
    enemyDmgMult: 1.3,
    cashMult: 0.7,
  },
};
