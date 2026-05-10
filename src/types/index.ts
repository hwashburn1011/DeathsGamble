// ============== Game type definitions ==============

export type SceneName =
  | 'title'
  | 'intro'
  | 'modeselect'
  | 'buildpicker'
  | 'wheels'
  | 'dungeon'
  | 'shop'
  | 'gameover'
  | 'win'
  | 'credits';

export type GameMode = 'story' | 'infinite' | 'daily';
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
  /** Atmospheric one-liner shown as italic flavor under the mechanical hook (#178). */
  desc: string;
  /** Concrete gameplay one-liner — what this build actually does (#178). */
  mechanicalHook: string;
  /** Build-defined active ability cast on Q (#152). */
  active: ActiveSpellDef;
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
  // Flat-stat fields (legacy / still used by Tank for hp bonus baseline).
  dmgMult?: number;
  atkspdMult?: number;
  rangeBonus?: number;
  hpBonus?: number;
  critBonus?: number;
  lifesteal?: number;       // % of dmg dealt healed per hit
  pierce?: number;
  // Conditional / playstyle effects (#157/#158) — engine reads these at the
  // matching trigger point. All optional; spells set the few they care about.
  /** Overkill: multiplier when hitting an enemy at FULL HP (e.g. 3 = ×3 dmg). */
  fullHpHitMult?: number;
  /** Tank: defense multiplier when player HP < 30% (e.g. 1.8 = +80% def). */
  defLowHpMult?: number;
  /** Crit: when a crit hits, also deal `crit * critChainPct` to nearest other enemy. */
  critChainPct?: number;
  /** Pierce: pierce N enemies for 0.5s after a kill (kill streak). */
  killStreakPierce?: number;
  /** Haste: max bonus atkspd from sustained continuous fire (e.g. 0.5 = +50%). */
  sustainedFireRamp?: number;
  /** Reach: range bonus per kill (e.g. 10 px), capped at 200; resets on player hit. */
  killStreakRange?: number;
  /** Lifesteal: % of MAX HP healed on kill (e.g. 0.05 = 5%). */
  killHealPct?: number;
}

// Build-defined active abilities cast on Q (#152). Each build gets one
// signature ability; `frostNova` becomes the Witch's, all others are new.
export type ActiveSpellId =
  | 'coinFlip'      // Gambler
  | 'riposte'       // Duelist
  | 'earthquake'    // Brute
  | 'arcaneBolt'    // Arcanist
  | 'smokeBomb'     // Rogue
  | 'huntersMark'   // Huntsman
  | 'frostNova'     // Witch
  | 'suppression';  // Soldier

export interface ActiveSpellDef {
  id: ActiveSpellId;
  name: string;
  desc: string;
  cooldownSec: number;
  /** Hotkey hint shown in HUD. */
  key: string;
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
  | 'boss'
  | 'archer'
  | 'fireImp'
  | 'lichAcolyte'
  | 'boneKnight';

export interface EnemyTypeDef {
  id: string;
  hp: number;
  spd: number;
  dmg: number;
  color: string;
  size: number;
  tier: number;             // 1 (early) to 5 (elite)
  sprite: EnemySprite;
  /** Optional ranged-attack profile. */
  ranged?: {
    range: number;          // px — fires when within this distance
    cooldownMs: number;     // between shots
    projectileSpd: number;  // px/sec
    projectileColor: number; // hex
  };
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
  // Per-run shop economy — cash currently held + upgrade levels purchased
  // this run. Reset to zero on startNewRun. No upgrade caps; cost scales
  // exponentially per-level via SHOP_UPGRADES.costMult.
  cash: number;
  upgrades: PersistentUpgrades;
  // Last spin labels for HUD display in the dungeon. Cleared between rounds.
  activeBuff: string | null;
  activeCurse: string | null;
  // One-shot consumables purchased in the shop, applied at next raid init.
  pendingPotions: number;     // each grants +50 starting HP at the next raid
  // Post-death summary captured from the last completed raid / death (#180-#182).
  lastRunSummary: {
    lastDamageSource: string;
    biggestHit: number;
    favoriteKill: string;
    timeAlive: number;
    /** Souls awarded for this run (#173) — shown on gameover/win scenes. */
    soulsEarned?: number;
  } | null;
  /** Bargains taken this raid (#167) — IDs from BARGAINS. Reset per raid so
   *  the player gets a fresh pool of options each time. */
  bargainsTaken: string[];
}

// ----- Persistent (localStorage) -----
export interface PersistentUpgrades {
  hp: number;
  dmg: number;
  atkspd: number;
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
  /** Render quality — caps the Pixi resolution multiplier on Hi-DPI screens. */
  renderQuality: 'low' | 'medium' | 'high';
  volumeMaster: number;   // 0..1
  volumeSfx: number;      // 0..1
  volumeMusic: number;    // 0..1
}
