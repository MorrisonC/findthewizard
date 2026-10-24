export type PuzzleDifficulty = 'Introductory' | 'Moderate' | 'Complex' | 'Master';

export interface PuzzleStep {
  stepNumber: number;
  actionDescription: string;
  requiredToolId?: string;
  expectedInput?: string;
  stateTriggerFlag: string;
}

export interface PuzzleDefinition {
  id: string; // e.g. 'P1', 'P27'
  name: string;
  roomCode: string; // e.g. 'C3', 'HA4', 'PB3'
  zoneId: string; // matches ZoneTypes id
  difficulty: PuzzleDifficulty;
  mechanicCategory: 
    | 'Light & Mirror Reflection' 
    | 'Acoustic / Rhythm' 
    | 'Reverse-Entropy Chronomancy' 
    | 'Hydraulic Pressure Balancing' 
    | 'Belief / Illusion Dissolve' 
    | 'Clockwork Gear Teeth' 
    | 'Spatial / Non-Euclidean Navigation';
  summary: string;
  fullSolution: string;
  requiredToolIds: string[];
  steps: PuzzleStep[];
  hazardDamageOnMistake: number;
  rewardItemIds: string[];
  rewardQuestId?: string;
  rewardUnlocksDoorId?: string;
}
