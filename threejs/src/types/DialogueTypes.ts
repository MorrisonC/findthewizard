export interface DialogueChoice {
  text: string;
  nextDialogueNodeId?: string;
  requiredStat?: { stat: 'STR' | 'DEX' | 'INT'; minVal: number };
  requiredItemId?: string;
  actionTrigger?: 'ACCEPT_QUEST' | 'GIVE_ITEM' | 'START_COMBAT' | 'TRIGGER_PUZZLE' | 'CLOSE';
  actionPayload?: string;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  speakerTitle?: string;
  text: string;
  audioVoiceBark?: string;
  choices: DialogueChoice[];
}

export interface DialogueTree {
  npcId: string;
  rootNodeId: string;
  nodes: Record<string, DialogueNode>;
}
