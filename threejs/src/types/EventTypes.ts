import { DamageType } from './ItemTypes';

export type GameEventMap = {
  // Navigation & Spatial
  'ZONE_ENTER': { zoneId: string; spawnTile: [number, number] };
  'ZONE_LEAVE': { fromZoneId: string; toZoneId: string };
  'TILE_STEP': { x: number; y: number; tileType: number };

  // Combat
  'COMBAT_ENGAGE': { enemyId: string };
  'COMBAT_DISENGAGE': { enemyId: string };
  'DAMAGE_DEALT': { sourceId: string; targetId: string; amount: number; damageType: DamageType };
  'PARRY_SUCCESS': { sourceId: string; isHarmonic: boolean };
  'PLAYER_DEATH': { cause: string };

  // Quests & Story
  'QUEST_ACCEPTED': { questId: string };
  'QUEST_OBJECTIVE_COMPLETE': { questId: string; stepIndex: number };
  'QUEST_COMPLETED': { questId: string };

  // Puzzles
  'PUZZLE_ATTEMPT': { puzzleId: string; stepIndex: number; input: string };
  'PUZZLE_SOLVED': { puzzleId: string };
  'PUZZLE_FAILED': { puzzleId: string; damage: number };

  // Inventory & Economy
  'ITEM_ACQUIRED': { itemId: string; quantity: number };
  'ITEM_USED': { itemId: string };
  'ITEM_EQUIPPED': { itemId: string; slot: string };

  // Time & Environmental
  'TIME_TICK': { hour: number; minute: number; isNight: boolean };
  'MEMORY_SHARD_UNLOCKED': { shardIndex: number };
};
