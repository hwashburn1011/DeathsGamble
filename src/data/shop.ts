import type { ShopUpgradeDef } from '../types';

export const SHOP_UPGRADES: ShopUpgradeDef[] = [
  { id: 'hp',   name: 'Vigor',     desc: '+20 Max HP',                          cost: 50,  costMult: 1.5, max: 10 },
  { id: 'dmg',  name: 'Strength',  desc: '+5 Damage',                           cost: 50,  costMult: 1.5, max: 10 },
  { id: 'spd',  name: 'Swiftness', desc: '+0.4 Speed',                          cost: 60,  costMult: 1.6, max: 5 },
  { id: 'def',  name: 'Hardiness', desc: '+2 Defense',                          cost: 70,  costMult: 1.7, max: 5 },
  { id: 'crit', name: 'Fortune',   desc: '+5% Crit chance',                     cost: 80,  costMult: 1.8, max: 5 },
  { id: 'luck', name: 'Charm',     desc: '+0.2 Luck (better wheel rolls)',      cost: 100, costMult: 1.9, max: 5 },
  { id: 'cash', name: 'Greed',     desc: '+25% cash from raids',                cost: 120, costMult: 2.0, max: 5 },
];

export const SHOP_BY_ID: Record<string, ShopUpgradeDef> = Object.fromEntries(
  SHOP_UPGRADES.map((u) => [u.id, u])
);
