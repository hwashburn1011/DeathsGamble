// ============== Game type definitions ==============

export type SceneName =
  | 'title'
  | 'modeselect'
  | 'buildpicker'
  | 'wheels'
  | 'dungeon'
  | 'shop'
  | 'gameover'
  | 'win'
  | 'credits';

export type GameMode = 'story' | 'infinite';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type WheelMode = 'wheel' | 'slot';

export interface Look {
  robe: string;
  accent: string;
}

export interface BuildDef {
  id: string;
  name: string;
  weapon: string;     // weapon id
  spells: string[];   // spell ids
  baseHp: number;
  baseSpd: number;
  baseDef: number;
  baseLuck: number;
  look: Look;
  desc: string;
}

export type WeaponType = 'melee' | 'ranged' | 'magic';

export interface WeaponDef {
  id: string;
  name: string;
  type: WeaponType;
  dmg: number;
  atkspd: number;       // attacks per second
  range: number;        // px
  projectiles: number;
  spread?: number;      // radians (when projectiles > 1)
  color: string;
  icon: string;
  aoe?: number;         // explosion radius (rocket)
}

export interface SpellEffect {
  dmgMult?: number;
  atkspdMult?: number;
  rangeBonus?: number;
  hpBonus?: number;
  critBonus?: number;
  lifesteal?: number;
  pierce?: number;
}

export interface SpellDef {
  id: string;
  name: string;
  desc: string;
  effect: SpellEffect;
}

export type EnemySprite =
  | 'zombie'
  | 'bat'
  | 'skeleton'
  | 'ghoul'
  | 'wraith'
  | 'tank'
  | 'imp'
  | 'reaper'
  | 'boss';

export interface EnemyTypeDef {
  id: string;
  hp: number;
  spd: number;
  dmg: number;
  color: string;
  size: number;
  tier: number;       // 1 (early) to 4 (late)
  sprite: EnemySprite;
}

export interface ShopUpgradeDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  costMult: number;
  max: number;
}

export interface WheelSegment {
  label: string;
  color: string;
  luckScore: number;          // higher = player-favorable; biases spin RNG
  apply: (s: PlayerStats, mult?: number) => void;
}

export interface DifficultyDef {
  storyRaids: number;
  curseMult: number;
  enemyHpMult: number;
  enemySpdMult: number;
  enemySpawnMult: number;
  enemyDmgMult: number;
  cashMult: number;
}

// ----- Per-run player stats (mutable, recomputed each raid) -----
export interface PlayerStats {
  hp: number;
  hpMax: number;
  dmg: number;
  def: number;
  spd: number;
  atkspd: number;
  range: number;
  crit: number;
  luck: number;
  pickup: number;
  // Enemy modifiers (curse-driven)
  enemyHpMult: number;
  enemySpdMult: number;
  enemySpawnMult: number;
  enemyDmgBonus: number;
  // Spell-derived
  dmgMult: number;
  atkspdMult: number;
  rangeBonus: number;
  lifesteal: number;
  pierce: number;
  aoe: number;
}

// ----- Per-run state -----
export interface RunState {
  mode: GameMode;
  raid: number;
  totalRaids: number;
  endlessRound: number;
  build: BuildDef | null;
  weapon: WeaponDef | null;
  spells: string[];
  cashEarned: number;
  killsTotal: number;
}

// ----- Persistent (localStorage) -----
export interface PersistentUpgrades {
  hp: number;
  dmg: number;
  spd: number;
  def: number;
  crit: number;
  luck: number;
  cash: number;
}

export interface PersistentState {
  cash: number;
  upgrades: PersistentUpgrades;
}

// ----- Settings -----
export interface SettingsState {
  brightness: number;
  difficulty: Difficulty;
  wheelMode: WheelMode;
  blood: boolean;
  motionIntensity: 'off' | 'low' | 'normal' | 'high';
}
