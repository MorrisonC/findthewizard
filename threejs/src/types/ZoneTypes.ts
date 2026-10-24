export interface ZoneLightingConfig {
  ambientColor: string; // Hex color string, e.g. '#0f172a'
  ambientIntensity: number;
  directionalColor: string; // Edward Hopper key light, e.g. '#fef08a'
  directionalIntensity: number;
  directionalPosition: [number, number, number]; // [x, y, z]
  fogColor: string;
  fogNear: number;
  fogFar: number;
}

export interface ZoneAudioConfig {
  ambientMusicTrack: string; // Path or asset key
  ambientBpm?: number;
  combatMusicStem: string;
  reverbDecaySeconds: number;
}

export interface ZoneExit {
  direction: 'N' | 'S' | 'E' | 'W' | 'U' | 'D'; // North, South, East, West, Up, Down
  targetZoneId: string;
  targetSpawnTile: [number, number]; // [x, y]
  isLocked: boolean;
  requiredKeyItemId?: string;
  requiredQuestId?: string;
}

export interface ZoneDefinition {
  id: string; // e.g. 'outer', 'mirrors', 'eyrie', 'labyrinth'
  code: string; // Single letter or short code e.g. 'A', 'F', 'LB'
  name: string;
  act: 1 | 2 | 3 | 4;
  isPeripheral: boolean;
  description: string;
  svgDataId: string;
  adjacentZoneIds: string[];
  exits: ZoneExit[];
  lighting: ZoneLightingConfig;
  audio: ZoneAudioConfig;
  hazards: string[];
  puzzleIds: string[];
  questIds: string[];
  npcIds: string[];
  mockupImagePath?: string;
}
