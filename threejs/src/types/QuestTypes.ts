export type QuestType = 'Main' | 'Side' | 'Hidden';

export type QuestStatus = 'Unassigned' | 'Active' | 'Completed' | 'Failed';

export interface QuestObjective {
  stepIndex: number;
  description: string;
  targetEntityId?: string;
  targetCount?: number;
  currentCount?: number;
  targetZoneId: string;
  isOptional: boolean;
}

export interface QuestReward {
  xp: number;
  moons: number;
  itemIds: string[];
  reputationFaction?: 'Servants' | 'Librarians' | 'Radiant Aegis' | 'Brigands';
  reputationAmount?: number;
  unlockedZoneId?: string;
  unlockedSummonId?: string;
}

export interface QuestDefinition {
  id: string; // e.g. 'M1', 'S27', 'H2'
  title: string;
  type: QuestType;
  act: 1 | 2 | 3 | 4;
  giver: string;
  giverZoneId: string;
  summary: string;
  objectives: QuestObjective[];
  rewards: QuestReward;
  dialogueQuote: string;
  prerequisiteQuestIds: string[];
  requiredLevel?: number;
  softlockSafeguardRule: string;
}
