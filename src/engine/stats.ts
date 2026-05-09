// Pure stat computation helpers — used by Wheels and Dungeon scenes.

import type {
  BuildDef,
  Difficulty,
  PlayerStats,
  WeaponDef,
} from '../types';
import { DIFFICULTY } from '../data/difficulty';
import { SPELLS_BY_ID } from '../data/spells';

export function baseStats(
  build: BuildDef,
  weapon: WeaponDef,
  spells: string[],
  difficulty: Difficulty
): PlayerStats {
  const s: PlayerStats = {
    hp: build.baseHp,
    hpMax: build.baseHp,
    dmg: 0, // additive bonus on top of weapon.dmg
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

export function effectiveDmg(stats: PlayerStats, weapon: WeaponDef): number {
  return (weapon.dmg + stats.dmg) * stats.dmgMult;
}

export function effectiveAtkspd(stats: PlayerStats): number {
  return stats.atkspd * stats.atkspdMult;
}

export function effectiveRange(stats: PlayerStats): number {
  return stats.range + stats.rangeBonus;
}
