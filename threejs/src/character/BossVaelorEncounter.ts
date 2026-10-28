export type VaelorEndingId =
  | 'thiefs_contract'
  | 'mercy_of_unmaking'
  | 'new_sovereign'
  | 'awakening_of_the_mind';

export interface BossPhaseSpec {
  phase: 1 | 2 | 3;
  title: string;
  hpThreshold: number;
  attackSpeedMultiplier: number;
  abilities: string[];
  arenaEffect: string;
}

export const BOSS_THREE_PHASE_TABLE: Record<string, BossPhaseSpec[]> = {
  ENC_GH3_CAPTAIN: [
    {
      phase: 1,
      title: 'Phase I: Disciplined Bastion',
      hpThreshold: 1.0,
      attackSpeedMultiplier: 1.0,
      abilities: ['Halberd Thrust', 'Shield Wall Advance'],
      arenaEffect: 'Standard Torchlight',
    },
    {
      phase: 2,
      title: 'Phase II: Iron Juggernaut',
      hpThreshold: 0.66,
      attackSpeedMultiplier: 1.22,
      abilities: ['Flaming Overhead Cleave (Red Unblockable)', 'Shield Bash Charge'],
      arenaEffect: 'Braziers Ignite Oil Channels',
    },
    {
      phase: 3,
      title: 'Phase III: Last Stand of the Gate',
      hpThreshold: 0.33,
      attackSpeedMultiplier: 1.45,
      abilities: ['360° Halberd Whirlwind', 'Portcullis Shockwave'],
      arenaEffect: 'Counterweight Cage Primed Above Center Grate',
    },
  ],
  ENC_WIZARD_FINAL: [
    {
      phase: 1,
      title: 'Phase I: Master of Mirrors',
      hpThreshold: 1.0,
      attackSpeedMultiplier: 1.0,
      abilities: ['Arcane Bolt Volley', 'Mirror Decoy Clone Summon'],
      arenaEffect: 'Octagonal Mirror Monoliths Active',
    },
    {
      phase: 2,
      title: 'Phase II: Chronomantic Fracture',
      hpThreshold: 0.66,
      attackSpeedMultiplier: 1.28,
      abilities: ['Temporal Slow Dome', 'Rotating Mirror Beam Sweep (Roll i-Frame Required)'],
      arenaEffect: 'Astrolabe Rings Spin in Reverse-Entropy',
    },
    {
      phase: 3,
      title: 'Phase III: Shattered Veil Reality Shift',
      hpThreshold: 0.33,
      attackSpeedMultiplier: 1.55,
      abilities: ['Astral Scythe Blink', 'Meteoric Glass Storm', 'Unmaking Nova'],
      arenaEffect: 'Sanctum Shifts to Astral Void (Conduit Sabotage Available)',
    },
  ],
};
