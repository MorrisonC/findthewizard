/**
 * Single source of truth for the fortress door graph.
 *
 * `main.ts` consumes this table for collision-trigger exits, and the
 * auto-battler routes across the same graph. Keeping it in one file means the
 * unit tests can prove every room is reachable without duplicating data.
 */

export interface DoorSpawn {
  x: number;
  y: number;
  z: number;
}

export interface DoorDef {
  x: number;
  z: number;
  to: string;
  requires: string[];
  spawn?: DoorSpawn;
}

export const FORTRESS_EXITS: Record<string, DoorDef[]> = {
  S00: [
    { x: 0, z: -4.8, to: 'OW1', requires: [] },
    { x: 5.0, z: 0, to: 'CR1', requires: [] },
    { x: -5.0, z: 0, to: 'MS3', requires: [] },
    { x: 4.6, z: -3.4, to: 'VR1', requires: [] },
    { x: -4.6, z: -3.4, to: 'RS1', requires: [] },
    { x: -4.6, z: 3.4, to: 'RC1', requires: [] },
  ],
  OW1: [
    { x: 0, z: 5.0, to: 'S00', requires: [] },
    { x: 0, z: -5.0, to: 'GH1', requires: [] },
    { x: 5.0, z: 0, to: 'B1', requires: [] },
    { x: -5.0, z: 0, to: 'SQ1', requires: [] },
    { x: -4.6, z: -3.4, to: 'U1', requires: [] },
    { x: 4.6, z: -3.4, to: 'TR1', requires: [] },
    { x: -4.6, z: 3.4, to: 'AT1', requires: [] },
    { x: 4.6, z: 3.4, to: 'AL1', requires: [] },
  ],
  GH1: [
    { x: 0, z: 5.0, to: 'OW1', requires: [] },
    { x: 0, z: -5.0, to: 'GH2', requires: ['ITEM_IRON_NAIL'] },
    { x: -4.6, z: -3.4, to: 'GH4', requires: [] },
    { x: 4.6, z: -3.4, to: 'BT1', requires: [] },
    { x: -4.6, z: 3.4, to: 'PB1', requires: [] },
    { x: 4.6, z: 3.4, to: 'RG1', requires: [] },
  ],
  GH2: [
    { x: 0, z: 5.0, to: 'GH1', requires: [] },
    { x: 0, z: -5.0, to: 'GH3', requires: ['PUZZLE_MIRROR_LOCK'] },
  ],
  GH3: [
    { x: 0, z: 5.0, to: 'GH2', requires: [] },
    { x: 0, z: -5.0, to: 'HM1', requires: [] },
  ],
  GH4: [{ x: 0, z: 5.0, to: 'GH1', requires: [] }],
  SQ1: [{ x: 0, z: 5.0, to: 'GH1', requires: [] }],
  B1: [{ x: 0, z: 5.0, to: 'OW1', requires: [] }],
  RC1: [{ x: 0, z: 5.0, to: 'S00', requires: [] }],
  CR1: [{ x: 0, z: 5.0, to: 'S00', requires: [] }],
  MS3: [{ x: 0, z: 5.0, to: 'S00', requires: [] }],
  HM1: [
    { x: 0, z: 5.0, to: 'GH3', requires: [] },
    { x: 0, z: -5.0, to: 'BQ1', requires: ['PUZZLE_TRUE_MIRROR'] },
  ],
  BQ1: [
    { x: 0, z: 5.0, to: 'HM1', requires: [] },
    { x: 0, z: -5.0, to: 'AG1', requires: ['PUZZLE_FEAST_SATIETY'] },
  ],
  AG1: [
    { x: 0, z: 5.0, to: 'BQ1', requires: [] },
    { x: 0, z: -5.0, to: 'MH1', requires: ['PUZZLE_ARBOREAL_WEAVE'] },
  ],
  MH1: [
    { x: 0, z: 5.0, to: 'AG1', requires: [] },
    { x: 0, z: -5.0, to: 'SAN1', requires: ['PUZZLE_HOSPITALITY_GAMBIT'] },
    { x: -4.6, z: 3.4, to: 'CO1', requires: [] },
  ],
  SAN1: [
    { x: 0, z: 5.0, to: 'MH1', requires: [] },
    { x: 0, z: -5.0, to: 'S00', requires: ['PUZZLE_HOLLOW_GLASS'] },
  ],
  BT1: [{ x: 0, z: 5.0, to: 'OW1', requires: [] }],
  CO1: [
    { x: 0, z: 5.0, to: 'MH1', requires: [] },
    { x: 4.6, z: -3.4, to: 'CO3', requires: [] },
  ],
  CO3: [
    { x: 0, z: 5.0, to: 'CO1', requires: [] },
    { x: 0, z: -5.0, to: 'S00', requires: [] },
  ],
  U1: [
    { x: 0, z: 5.0, to: 'OW1', requires: [] },
    { x: 0, z: -5.0, to: 'U2', requires: [] },
  ],
  U2: [
    { x: 0, z: 5.0, to: 'U1', requires: [] },
    { x: 0, z: -5.0, to: 'U3', requires: [] },
  ],
  U3: [
    { x: 0, z: 5.0, to: 'U2', requires: [] },
    { x: 0, z: -5.0, to: 'U4', requires: ['PUZZLE_ECHO_CHAMBER'] },
  ],
  U4: [
    { x: 0, z: 5.0, to: 'U3', requires: [] },
    { x: 0, z: -5.0, to: 'S00', requires: [] },
  ],
  TR1: [
    { x: 0, z: 5.0, to: 'OW1', requires: [] },
    { x: 0, z: -5.0, to: 'TR2', requires: [] },
  ],
  TR2: [
    { x: 0, z: 5.0, to: 'TR1', requires: [] },
    { x: 0, z: -5.0, to: 'TR3', requires: [] },
  ],
  TR3: [
    { x: 0, z: 5.0, to: 'TR2', requires: [] },
    { x: 0, z: -5.0, to: 'TR4', requires: [] },
  ],
  TR4: [
    { x: 0, z: 5.0, to: 'TR3', requires: [] },
    { x: 0, z: -5.0, to: 'U2', requires: [] },
  ],
  AT1: [
    { x: 0, z: 5.0, to: 'OW1', requires: [] },
    { x: 0, z: -5.0, to: 'AT2', requires: [] },
  ],
  AT2: [
    { x: 0, z: 5.0, to: 'AT1', requires: [] },
    { x: 0, z: -5.0, to: 'AT3', requires: ['PUZZLE_CONSTELLATION'] },
  ],
  AT3: [
    { x: 0, z: 5.0, to: 'AT2', requires: [] },
    { x: 0, z: -5.0, to: 'S00', requires: [] },
  ],
  AL1: [
    { x: 0, z: 5.0, to: 'OW1', requires: [] },
    { x: 0, z: -5.0, to: 'AL2', requires: [] },
  ],
  AL2: [
    { x: 0, z: 5.0, to: 'AL1', requires: [] },
    { x: 0, z: -5.0, to: 'AL3', requires: [] },
  ],
  AL3: [
    { x: 0, z: 5.0, to: 'AL2', requires: [] },
    { x: 0, z: -5.0, to: 'S00', requires: [] },
  ],
  PB1: [
    { x: 0, z: 5.0, to: 'OW1', requires: [] },
    { x: 0, z: -5.0, to: 'PB2', requires: [] },
  ],
  PB2: [
    { x: 0, z: 5.0, to: 'PB1', requires: [] },
    { x: 0, z: -5.0, to: 'PB3', requires: [] },
  ],
  PB3: [
    { x: 0, z: 5.0, to: 'PB2', requires: [] },
    { x: 0, z: -5.0, to: 'PB4', requires: [] },
  ],
  PB4: [
    { x: 0, z: 5.0, to: 'PB3', requires: [] },
    { x: 0, z: -5.0, to: 'S00', requires: [] },
  ],
  RG1: [
    { x: 0, z: 5.0, to: 'OW1', requires: [] },
    { x: 0, z: -5.0, to: 'RG2', requires: [] },
  ],
  RG2: [
    { x: 0, z: 5.0, to: 'RG1', requires: [] },
    { x: 0, z: -5.0, to: 'RG3', requires: [] },
  ],
  RG3: [
    { x: 0, z: 5.0, to: 'RG2', requires: [] },
    { x: 0, z: -5.0, to: 'RG4', requires: [] },
  ],
  RG4: [
    { x: 0, z: 5.0, to: 'RG3', requires: [] },
    { x: 0, z: -5.0, to: 'S00', requires: [] },
  ],
  VR1: [
    { x: 0, z: 5.0, to: 'OW1', requires: [] },
    { x: 0, z: -5.0, to: 'VR2', requires: [] },
  ],
  VR2: [
    { x: 0, z: 5.0, to: 'VR1', requires: [] },
    { x: 0, z: -5.0, to: 'VR3', requires: [] },
  ],
  VR3: [
    { x: 0, z: 5.0, to: 'VR2', requires: [] },
    { x: 0, z: -5.0, to: 'S00', requires: [] },
  ],
  RS1: [
    { x: 0, z: 5.0, to: 'OW1', requires: [] },
    { x: 0, z: -5.0, to: 'RS2', requires: [] },
  ],
  RS2: [
    { x: 0, z: 5.0, to: 'RS1', requires: [] },
    { x: 0, z: -5.0, to: 'RS3', requires: [] },
  ],
  RS3: [
    { x: 0, z: 5.0, to: 'RS2', requires: [] },
    { x: 0, z: -5.0, to: 'RS4', requires: [] },
  ],
  RS4: [
    { x: 0, z: 5.0, to: 'RS3', requires: [] },
    { x: 0, z: -5.0, to: 'RS5', requires: [] },
  ],
  RS5: [
    { x: 0, z: 5.0, to: 'RS4', requires: [] },
    { x: 0, z: -5.0, to: 'RS6', requires: [] },
  ],
  RS6: [
    { x: 0, z: 5.0, to: 'RS5', requires: [] },
    { x: 0, z: -5.0, to: 'S00', requires: [] },
  ],
};

export function doorRequirementsMet(requires: readonly string[], inventory: ReadonlySet<string>, puzzles: ReadonlySet<string>, abilities: ReadonlySet<string>): boolean {
  return requires.every((req) => {
    if (req.startsWith('ITEM_')) return inventory.has(req);
    if (req.startsWith('PUZZLE_')) return puzzles.has(req);
    if (req.startsWith('ABILITY_')) return abilities.has(req);
    return false;
  });
}
