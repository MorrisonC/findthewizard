export type ItemRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export type ItemCategory = 
  | 'Weapon' 
  | 'Armor' 
  | 'Accessory' 
  | 'Relic' 
  | 'Consumable' 
  | 'Quest' 
  | 'Crafting';

export type DamageType = 'physical' | 'radiant' | 'void' | 'starlight' | 'sonic' | 'kinetic';

export interface WeaponStats {
  damageMin: number;
  damageMax: number;
  damageType: DamageType;
  attackSpeed: number; // Attacks per second
  range: number; // In grid units / tiles
  critMultiplier: number; // e.g. 1.5 = 150%
  scalingStat?: 'STR' | 'DEX' | 'INT';
}

export interface ArmorStats {
  physicalDef: number;
  etherealDef: number;
  dodgeBonus: number; // Percentage, e.g. 0.15 = 15%
  stealthBonus: number; // Footstep radius dampening
}

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  description: string;
  flavorText?: string;
  valueMoons: number;
  isConsumable: boolean;
  isKeyItem: boolean;
  maxStack: number;
  iconPath: string;
  weaponStats?: WeaponStats;
  armorStats?: ArmorStats;
  effectDescription?: string;
  tags: string[];
}
