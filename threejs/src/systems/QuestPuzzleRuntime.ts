export interface MultiStepPuzzleState {
  puzzleId: string;
  name: string;
  zoneId: string;
  requiredSequence: string[];
  currentProgress: string[];
  solved: boolean;
  clueText: string;
}

/**
 * Multi-Step Spatial & Mechanical Puzzle Runtime (`QuestPuzzleRuntime.ts`)
 * Replaces single-click or "talk-to-NPC-to-solve" shortcuts with real multi-stage
 * physical manipulation state machines. Talking to an NPC only reveals the lore clue!
 */
export class QuestPuzzleRuntime {
  private puzzles: Map<string, MultiStepPuzzleState> = new Map();

  constructor() {
    this.registerDefaultPuzzles();
  }

  private registerDefaultPuzzles(): void {
    const defs: MultiStepPuzzleState[] = [
      {
        puzzleId: 'P12_LIBRARY_CIPHER',
        name: 'Four-Tome Elemental Cipher',
        zoneId: 'L1',
        requiredSequence: ['lectern_ignis', 'lectern_aer', 'lectern_aqua', 'lectern_terra'],
        currentProgress: [],
        solved: false,
        clueText:
          'Archivist Orin whispers: "No mere conversation unlocks the Sanctum Index. Read the four elemental lecterns in the order of Creation: Flame (Ignis) rises to Wind (Aer), condenses to Water (Aqua), and settles as Stone (Terra)."',
      },
      {
        puzzleId: 'P23_HEDGE_MAZE_LABYRINTH',
        name: 'Labyrinth Moon-Rune Sequence & Clockwork Gate',
        zoneId: 'HM1',
        requiredSequence: ['maze_plate_1', 'maze_plate_2', 'maze_plate_3'],
        currentProgress: [],
        solved: false,
        clueText:
          'Bramble Warden notes: "The Iron Thorn Gate only retracts when a traveler physically treads the three Moon-Rune Pressure Plates hidden in the Southwest, Northeast, and Northwest dead-ends of the Hedge Maze."',
      },
      {
        puzzleId: 'P30_CRYPT_HYDRAULICS',
        name: 'Flooded Crypt Sluice-Gate Pressure Balance',
        zoneId: 'CR01',
        requiredSequence: ['sluice_valve_intake', 'sluice_valve_bypass', 'sluice_valve_drain'],
        currentProgress: [],
        solved: false,
        clueText:
          'Crypt Inscription: "To drain the Sunken Wyrm basin to 40 PSI, turn the West Intake Wheel first, then the Center Bypass, and finally the East Drain Sluice."',
      },
      {
        puzzleId: 'P29_SANCTUM_CONDUITS',
        name: 'Aether Conduit Resonance Seal',
        zoneId: 'T05',
        requiredSequence: ['aether_conduit_1', 'aether_conduit_2', 'aether_conduit_3', 'aether_conduit_4'],
        currentProgress: [],
        solved: false,
        clueText:
          'Mirror Inscription: "Strike all four cardinal Aether Conduits with resonant force to sever Vaelor\'s illusion tethers."',
      },
    ];

    for (const d of defs) {
      this.puzzles.set(d.puzzleId, d);
    }
  }

  public getNpcClueForZone(zoneId: string): string {
    for (const p of this.puzzles.values()) {
      if (p.zoneId === zoneId) {
        return p.clueText;
      }
    }
    return 'Inspect the mechanical contraptions in this room carefully.';
  }

  public interactWithNode(
    puzzleId: string,
    nodeId: string
  ): {
    status: 'step_advanced' | 'wrong_order_reset' | 'puzzle_solved' | 'already_solved';
    stepIndex: number;
    totalSteps: number;
    message: string;
  } {
    const p = this.puzzles.get(puzzleId);
    if (!p) {
      return { status: 'already_solved', stepIndex: 0, totalSteps: 0, message: 'Unknown puzzle.' };
    }
    if (p.solved) {
      return {
        status: 'already_solved',
        stepIndex: p.requiredSequence.length,
        totalSteps: p.requiredSequence.length,
        message: `${p.name} is already solved.`,
      };
    }

    const expectedNode = p.requiredSequence[p.currentProgress.length];
    if (nodeId === expectedNode) {
      p.currentProgress.push(nodeId);
      if (p.currentProgress.length === p.requiredSequence.length) {
        p.solved = true;
        return {
          status: 'puzzle_solved',
          stepIndex: p.currentProgress.length,
          totalSteps: p.requiredSequence.length,
          message: `SOLVED: ${p.name}! Mechanical locks disengaged.`,
        };
      }
      return {
        status: 'step_advanced',
        stepIndex: p.currentProgress.length,
        totalSteps: p.requiredSequence.length,
        message: `${p.name}: Step ${p.currentProgress.length}/${p.requiredSequence.length} aligned (${nodeId}).`,
      };
    } else {
      p.currentProgress = [];
      return {
        status: 'wrong_order_reset',
        stepIndex: 0,
        totalSteps: p.requiredSequence.length,
        message: `Incorrect sequence on ${p.name}! Runes reset—consult the room clues.`,
      };
    }
  }
}
