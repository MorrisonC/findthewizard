import { QuestStatus } from './QuestTypes';

export interface PlayerAttributes {
  strength: number; // STR
  dexterity: number; // DEX
  intelligence: number; // INT
  maxHealth: number;
  currentHealth: number;
  maxStamina: number;
  currentStamina: number;
  maxFocusPoints: number; // FP for Arcane Trickster spells
  currentFocusPoints: number;
  level: number;
  xp: number;
  moons: number; // Currency
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
  isEquipped: boolean;
}

export interface EquippedGear {
  mainHandWeaponId?: string;
  offHandToolId?: string;
  armorId?: string;
  accessory1Id?: string;
  accessory2Id?: string;
}

export interface WorldClock {
  dayNumber: number;
  hour: number; // 0 to 23
  minute: number; // 0 to 59
  timeSpeedMultiplier: number;
}

export interface GameSaveState {
  version: string;
  timestamp: number;
  player: {
    name: string;
    attributes: PlayerAttributes;
    equipped: EquippedGear;
    inventory: InventorySlot[];
    activeSpells: string[];
  };
  currentZoneId: string;
  playerPosition: [number, number, number]; // [x, y, z]
  playerRotationY: number;
  quests: Record<string, { status: QuestStatus; currentStep: number }>;
  puzzlesSolved: Record<string, boolean>;
  doorsUnlocked: Record<string, boolean>;
  reputation: {
    Servants: number;
    Librarians: number;
    RadiantAegis: number;
    Brigands: number;
  };
  unlockedMemoryShards: number[]; // 1 to 7
  worldClock: WorldClock;
}
