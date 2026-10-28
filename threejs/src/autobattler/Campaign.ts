/**
 * Campaign data for the Veilkeep auto-battler.
 *
 * Every scene in the fortress gets a short, ordered task list. The auto-battler
 * walks the list, clears hostile guards, loots quest items, solves the room
 * puzzle and then routes to the next scene through the exit graph.
 *
 * Task coordinates mirror the proximity checks inside `interact()` in main.ts,
 * so the automaton always stands where the hand-authored interaction expects
 * the player to stand.
 */

export type TaskKind = 'clear' | 'collect' | 'solve' | 'talk';

export interface AutoTask {
  id: string;
  kind: TaskKind;
  label: string;
  /** World position used for navigation (interaction checks are proximity based). */
  x?: number;
  z?: number;
  /** Item id expected in the inventory. */
  item?: string;
  /** Puzzle id expected in the solved-puzzle set. */
  puzzle?: string;
  /** Dialogue NPC key. */
  npc?: string;
  /** For talk tasks: considered done when a flag is set and any grant appears. */
  grantsAny?: string[];
  /** Extra rewards granted as a side effect of completing the task. */
  grants?: string[];
  /** Items / puzzles / abilities needed before the task is attempted. */
  requires?: string[];
  /** How close the automaton must be before it presses interact. */
  radius?: number;
}

export interface ScenePlan {
  sceneId: string;
  title: string;
  tasks: AutoTask[];
}

export interface AutoProgressState {
  inventory: ReadonlySet<string>;
  solvedPuzzles: ReadonlySet<string>;
  abilities: ReadonlySet<string>;
  /** Scene ids the automaton has physically entered. */
  visited: ReadonlySet<string>;
  /** Scene ids whose hostiles have been cleared. */
  cleared: ReadonlySet<string>;
  /** Auto-battler bookkeeping flags (`talk:<npc>`, etc.). */
  flags: ReadonlySet<string>;
}

/** Shortest sensible order that respects every gameplay gate. */
export const CAMPAIGN_ORDER: readonly string[] = [
  // Prologue + the gatehouse run (unlocks Mirror Phase in HM1).
  'S00', 'OW1', 'GH1', 'GH2', 'GH3', 'WR1', 'HM1',
  // Side wings reachable from the courtyard / outer wards / gatehouse.
  'CR1', 'MS3', 'B1', 'SQ1', 'GH4', 'BT1',
  'U1', 'U2', 'U3', 'U4',
  'TR1', 'TR2', 'TR3', 'TR4',
  'AT1', 'AT2', 'AT3',
  'AL1', 'AL2', 'AL3',
  'PB1', 'PB2', 'PB3', 'PB4',
  'RG1', 'RG2', 'RG3', 'RG4',
  'VR1', 'VR2', 'VR3',
  'RS1', 'RS2', 'RS3', 'RS4', 'RS5', 'RS6',
  'RC1',
  // Main storyline finale (feeds off AG1 and MH1).
  'BQ1', 'AG1', 'MH1', 'CO1', 'CO3',
  'SAN1',
];

export const SCENE_PLANS: Record<string, ScenePlan> = {
  S00: {
    sceneId: 'S00',
    title: 'The Approach & Sunken Courtyard',
    tasks: [
      { id: 's00:sable', kind: 'talk', npc: 'sable', label: 'Speak with the Starlight Raven', x: -2.5, z: -4.8, radius: 1.8 },
    ],
  },
  OW1: {
    sceneId: 'OW1',
    title: 'Outer Wards Courtyard',
    tasks: [
      { id: 'ow1:clear', kind: 'clear', label: 'Neutralise the ward patrol' },
      { id: 'ow1:nail', kind: 'collect', item: 'ITEM_IRON_NAIL', label: 'Claim the Iron Nail', x: 2, z: -1, radius: 0.6 },
    ],
  },
  GH1: {
    sceneId: 'GH1',
    title: 'Gatehouse Exterior',
    tasks: [
      { id: 'gh1:ledger', kind: 'collect', item: 'ITEM_CAPTAIN_LEDGER', label: "Loot the Captain's Patrol Ledger", x: 2, z: -1, radius: 1.2 },
      {
        id: 'gh1:clear', kind: 'solve', puzzle: 'PUZZLE_GATEHOUSE_EXTERIOR',
        label: 'Clear the gatehouse exterior', x: 0, z: 0, radius: 1.6,
        requires: ['ITEM_CAPTAIN_LEDGER'],
      },
    ],
  },
  GH2: {
    sceneId: 'GH2',
    title: 'Gatehouse Mirror Lock',
    tasks: [
      {
        id: 'gh2:mirror', kind: 'solve', puzzle: 'PUZZLE_MIRROR_LOCK',
        label: 'Shatter the Mirror Lock', x: 0, z: -1.4, radius: 1.9,
        requires: ['ITEM_IRON_NAIL'],
      },
    ],
  },
  GH3: {
    sceneId: 'GH3',
    title: 'Barbican Captain',
    tasks: [{ id: 'gh3:clear', kind: 'clear', label: 'Defeat the Barbican Captain', grants: ['ABILITY_WALL_LEAP', 'ITEM_GATEHOUSE_KEY'] }],
  },
  HM1: {
    sceneId: 'HM1',
    title: 'Halls of Mirrors',
    tasks: [
      { id: 'hm1:clear', kind: 'clear', label: 'Banish the Mirror Wraith' },
      {
        id: 'hm1:mirror', kind: 'solve', puzzle: 'PUZZLE_TRUE_MIRROR',
        label: 'Shatter the True Mirror', x: 0, z: -4.0, radius: 1.6,
        grants: ['ABILITY_MIRROR_PHASE'],
      },
    ],
  },
  CR1: {
    sceneId: 'CR1',
    title: 'Chronomantic Scriptorium',
    tasks: [
      { id: 'cr1:phial', kind: 'collect', item: 'ITEM_TACHYON_PHIAL', label: 'Claim the Tachyon Phial', x: 2, z: -1, radius: 1.2 },
      { id: 'cr1:gate', kind: 'solve', puzzle: 'PUZZLE_RETROCAUSAL_PORTCULLIS', label: 'Unlock the Retrocausal Portcullis', x: 0, z: 0, radius: 1.6, requires: ['ITEM_TACHYON_PHIAL'] },
    ],
  },
  MS3: {
    sceneId: 'MS3',
    title: 'Music Salon',
    tasks: [
      { id: 'ms3:mallet', kind: 'collect', item: 'ITEM_GLASS_MALLET', label: 'Claim the Glass-Armonica Mallet', x: 2, z: -1, radius: 1.2 },
      { id: 'ms3:chord', kind: 'solve', puzzle: 'PUZZLE_RESONANT_HARMONIES', label: 'Perform the Resonant Harmonies', x: 0, z: 0, radius: 1.6, requires: ['ITEM_GLASS_MALLET'] },
    ],
  },
  B1: {
    sceneId: 'B1',
    title: 'Barracks Hall',
    tasks: [
      { id: 'b1:clear', kind: 'clear', label: 'Clear the barracks guard' },
      { id: 'b1:key', kind: 'collect', item: 'ITEM_ARMORY_KEY', label: 'Steal the Armory Key', x: 0, z: 2, radius: 1.2 },
      { id: 'b1:raid', kind: 'solve', puzzle: 'PUZZLE_BARRACKS_RAID', label: 'Raid the Barracks Armory', x: 0, z: 0, radius: 1.6, requires: ['ITEM_ARMORY_KEY'] },
    ],
  },
  SQ1: {
    sceneId: 'SQ1',
    title: 'Servants Quarters',
    tasks: [
      { id: 'sq1:diary', kind: 'collect', item: 'ITEM_SERVANT_DIARY', label: "Recover the Servant's Diary", x: -2, z: 1, radius: 1.2 },
      { id: 'sq1:secret', kind: 'solve', puzzle: 'PUZZLE_SERVANT_SECRET', label: 'Uncover the Servant Secret', x: 0, z: 0, radius: 1.6, requires: ['ITEM_SERVANT_DIARY'] },
    ],
  },
  GH4: {
    sceneId: 'GH4',
    title: 'Vent Passage',
    tasks: [
      { id: 'gh4:key', kind: 'collect', item: 'ITEM_VENT_KEY', label: 'Claim the Vent Grate Key', x: 1, z: 0, radius: 1.0 },
      { id: 'gh4:vent', kind: 'solve', puzzle: 'PUZZLE_VENT_ASCENT', label: 'Ascend the Vent Passage', x: 0, z: 0, radius: 1.6, requires: ['ITEM_VENT_KEY'] },
    ],
  },
  BT1: {
    sceneId: 'BT1',
    title: 'Bell Tower',
    tasks: [
      { id: 'bt1:chime', kind: 'solve', puzzle: 'PUZZLE_AEOLIAN_CHIME', label: 'Tune the Aeolian Baffles', x: 0, z: 0, radius: 1.6 },
    ],
  },
  U1: {
    sceneId: 'U1',
    title: 'Undercrypt — Ossuary',
    tasks: [{ id: 'u1:beads', kind: 'collect', item: 'ITEM_PRAYER_BEADS', label: 'Take the Prayer Beads', x: 0, z: 0, radius: 1.0 }],
  },
  U2: {
    sceneId: 'U2',
    title: 'Undercrypt — Monk Tombs',
    tasks: [
      { id: 'u2:clear', kind: 'clear', label: 'Put the tomb guardian down' },
      { id: 'u2:tombs', kind: 'solve', puzzle: 'PUZZLE_MONK_TOMBS', label: 'Lay the monk spirits to rest', x: 0, z: 0, radius: 1.6, requires: ['ITEM_PRAYER_BEADS'] },
    ],
  },
  U3: {
    sceneId: 'U3',
    title: 'Undercrypt — Echo Chamber',
    tasks: [{ id: 'u3:echo', kind: 'solve', puzzle: 'PUZZLE_ECHO_CHAMBER', label: 'Resonate the Echo Bell', x: 0, z: -1.5, radius: 1.6 }],
  },
  U4: {
    sceneId: 'U4',
    title: 'Undercrypt — Sealed Vault',
    tasks: [
      { id: 'u4:clear', kind: 'clear', label: 'Destroy the vault sentinel' },
      { id: 'u4:vault', kind: 'solve', puzzle: 'PUZZLE_MIRROR_VAULT', label: 'Phase through the sealed vault', x: 0, z: 0, radius: 1.6, requires: ['ABILITY_MIRROR_PHASE'] },
    ],
  },
  TR1: { sceneId: 'TR1', title: 'Trophy Hall — Vestibule', tasks: [{ id: 'tr1:clear', kind: 'clear', label: 'Clear the trophy curator' }] },
  TR2: {
    sceneId: 'TR2',
    title: 'Trophy Hall — Mimic Chest',
    tasks: [
      { id: 'tr2:clear', kind: 'clear', label: 'Clear the trophy curator' },
      { id: 'tr2:trophy', kind: 'collect', item: 'ITEM_CURATOR_TROPHY', label: "Open the mimic chest", x: 0, z: 0, radius: 1.0 },
    ],
  },
  TR3: { sceneId: 'TR3', title: 'Trophy Hall — Gallery', tasks: [{ id: 'tr3:clear', kind: 'clear', label: 'Clear the trophy curator' }] },
  TR4: {
    sceneId: 'TR4',
    title: "Trophy Hall — Hunter's Lie",
    tasks: [
      { id: 'tr4:clear', kind: 'clear', label: 'Clear the trophy curator' },
      { id: 'tr4:lie', kind: 'solve', puzzle: 'PUZZLE_HUNTERS_LIE', label: "Expose the Hunter's Lie", x: 0, z: 0, radius: 1.6, requires: ['ITEM_CURATOR_TROPHY'] },
    ],
  },
  AT1: {
    sceneId: 'AT1',
    title: 'Astronomy Tower — Observatory',
    tasks: [{ id: 'at1:lens', kind: 'collect', item: 'ITEM_ASTROMANCERS_LENS', label: "Claim the Astromancer's Lens", x: 0, z: 0, radius: 1.0 }],
  },
  AT2: {
    sceneId: 'AT2',
    title: 'Astronomy Tower — Constellation Floor',
    tasks: [{ id: 'at2:constellation', kind: 'solve', puzzle: 'PUZZLE_CONSTELLATION', label: 'Align the constellation', x: 0, z: -1.5, radius: 1.6 }],
  },
  AT3: {
    sceneId: 'AT3',
    title: 'Astronomy Tower — Star Map',
    tasks: [{ id: 'at3:starmap', kind: 'solve', puzzle: 'PUZZLE_STAR_MAP', label: 'Align the Star Map', x: 0, z: 0, radius: 1.6, requires: ['ITEM_ASTROMANCERS_LENS'] }],
  },
  AL1: {
    sceneId: 'AL1',
    title: "Alchemist's Lab — Workshop",
    tasks: [{ id: 'al1:sulfur', kind: 'collect', item: 'ITEM_VOLATILE_SULFUR', label: 'Bottle the Volatile Sulfur', x: 0, z: 0, radius: 1.0 }],
  },
  AL2: { sceneId: 'AL2', title: "Alchemist's Lab — Reagents", tasks: [] },
  AL3: {
    sceneId: 'AL3',
    title: "Alchemist's Lab — Formula",
    tasks: [{ id: 'al3:formula', kind: 'solve', puzzle: 'PUZZLE_UNSTABLE_FORMULA', label: 'Stabilise the Unstable Formula', x: 0, z: 0, radius: 1.6, requires: ['ITEM_VOLATILE_SULFUR'] }],
  },
  PB1: {
    sceneId: 'PB1',
    title: 'Abyssal Prison — Cell Block',
    tasks: [
      { id: 'pb1:clear', kind: 'clear', label: 'Clear the prison warden' },
      { id: 'pb1:keyring', kind: 'collect', item: 'ITEM_WARDEN_KEYRING', label: "Take the Warden's Keyring", x: 3, z: -2, radius: 1.2 },
    ],
  },
  PB2: { sceneId: 'PB2', title: 'Abyssal Prison — Interrogation', tasks: [{ id: 'pb2:clear', kind: 'clear', label: 'Clear the interrogation guard' }] },
  PB3: { sceneId: 'PB3', title: 'Abyssal Prison — Oubliette', tasks: [{ id: 'pb3:clear', kind: 'clear', label: 'Clear the oubliette guard' }] },
  PB4: {
    sceneId: 'PB4',
    title: "Abyssal Prison — Warden's Office",
    tasks: [
      { id: 'pb4:clear', kind: 'clear', label: 'Clear the warden' },
      { id: 'pb4:escape', kind: 'solve', puzzle: 'PUZZLE_PRISON_ESCAPE', label: 'Liberate the prison block', x: 0, z: 0, radius: 1.6, requires: ['ITEM_WARDEN_KEYRING'] },
    ],
  },
  RG1: { sceneId: 'RG1', title: 'Rooftop Gardens — Terrace', tasks: [] },
  RG2: {
    sceneId: 'RG2',
    title: 'Rooftop Gardens — Wind Vane',
    tasks: [{ id: 'rg2:vane', kind: 'collect', item: 'ITEM_WIND_VANE', label: 'Claim the Wind Vane', x: 2, z: -1, radius: 1.2 }],
  },
  RG3: { sceneId: 'RG3', title: 'Rooftop Gardens — Parapet', tasks: [] },
  RG4: {
    sceneId: 'RG4',
    title: "Rooftop Gardens — Wind's Secret",
    tasks: [{ id: 'rg4:secret', kind: 'solve', puzzle: 'PUZZLE_WIND_SECRET', label: "Reveal the Wind's Secret", x: 0, z: 0, radius: 1.6, requires: ['ITEM_WIND_VANE'] }],
  },
  VR1: { sceneId: 'VR1', title: 'Void Realm — Threshold', tasks: [] },
  VR2: {
    sceneId: 'VR2',
    title: 'Void Realm — Dream Core',
    tasks: [{ id: 'vr2:core', kind: 'collect', item: 'ITEM_DREAM_CORE', label: 'Claim the Dream Core', x: 0, z: 0, radius: 1.0 }],
  },
  VR3: {
    sceneId: 'VR3',
    title: 'Void Realm — Dream Descent',
    tasks: [{ id: 'vr3:descent', kind: 'solve', puzzle: 'PUZZLE_DREAM_DESCENT', label: 'Complete the Dream Descent', x: 0, z: 0, radius: 1.6, requires: ['ITEM_DREAM_CORE'] }],
  },
  RS1: {
    sceneId: 'RS1',
    title: 'Relativity Cloister — Escher Stairs',
    tasks: [{ id: 'rs1:stairs', kind: 'solve', puzzle: 'PUZZLE_RELATIVITY_STAIRS', label: 'Anchor the Escher Stairs', x: 0, z: 0, radius: 1.6, requires: ['ITEM_IRON_NAIL'] }],
  },
  RS2: { sceneId: 'RS2', title: 'Relativity Cloister — Inverted Landing', tasks: [] },
  RS3: { sceneId: 'RS3', title: 'Relativity Cloister — Mobius Walk', tasks: [] },
  RS4: { sceneId: 'RS4', title: 'Relativity Cloister — Crooked Step', tasks: [] },
  RS5: { sceneId: 'RS5', title: 'Relativity Cloister — Folded Span', tasks: [] },
  RS6: { sceneId: 'RS6', title: 'Relativity Cloister — Vanishing Point', tasks: [] },
  RC1: {
    sceneId: 'RC1',
    title: 'Relativity Cloister — Anchor Chamber',
    tasks: [
      { id: 'rc1:nails', kind: 'collect', item: 'ITEM_IRON_NAILS', label: 'Claim the Iron Nail Bundle', x: 0, z: -2, radius: 1.2 },
      { id: 'rc1:anchor', kind: 'solve', puzzle: 'PUZZLE_RELATIVITY_ANCHOR', label: 'Anchor the Relativity Cloister', x: 0, z: 0, radius: 1.6, requires: ['ITEM_IRON_NAILS'] },
    ],
  },
  BQ1: {
    sceneId: 'BQ1',
    title: 'Cenacle of Eternal Satiety',
    tasks: [
      { id: 'bq1:morvath', kind: 'talk', npc: 'morvath', label: 'Treat with Lord Morvath', x: 1.6, z: -1.8, radius: 1.8, grantsAny: ['ITEM_TANTALUS_GOBLET', 'PUZZLE_FEAST_SATIETY'] },
      { id: 'bq1:feast', kind: 'solve', puzzle: 'PUZZLE_FEAST_SATIETY', label: 'Dispel the phantom feast', x: 0, z: 0, radius: 2.0, requires: ['ITEM_TANTALUS_GOBLET'] },
    ],
  },
  AG1: {
    sceneId: 'AG1',
    title: 'The Ancient Bough',
    tasks: [
      { id: 'ag1:clear', kind: 'clear', label: 'Uproot the Tree Guardian', grants: ['ABILITY_STARLIGHT_DASH'] },
      { id: 'ag1:yggdra', kind: 'talk', npc: 'yggdra', label: 'Commune with Yggdra', x: 0, z: -2.1, radius: 2.0, grantsAny: ['ABILITY_STARLIGHT_DASH', 'PUZZLE_ARBOREAL_WEAVE'] },
    ],
  },
  MH1: {
    sceneId: 'MH1',
    title: "Mother Hazel's Hearth",
    tasks: [
      { id: 'mh1:hazel', kind: 'talk', npc: 'hazel', label: 'Treat with Mother Hazel', x: 1.8, z: -1.8, radius: 1.8, grantsAny: ['ITEM_SUGAR_SPOON', 'PUZZLE_HOSPITALITY_GAMBIT'] },
      { id: 'mh1:kettle', kind: 'solve', puzzle: 'PUZZLE_HOSPITALITY_GAMBIT', label: 'Stir the Confectionery Kettle', x: 0, z: -3.2, radius: 1.6 },
    ],
  },
  CO1: { sceneId: 'CO1', title: 'Crystal Opera — Foyer', tasks: [{ id: 'co1:clear', kind: 'clear', label: 'Clear the crystal captain' }] },
  CO3: {
    sceneId: 'CO3',
    title: 'Crystal Opera — Mirror Stage',
    tasks: [{ id: 'co3:theater', kind: 'solve', puzzle: 'PUZZLE_CRYSTAL_THEATER', label: 'Unveil the Crystal Theater', x: 0, z: 0, radius: 1.6, requires: ['ABILITY_MIRROR_PHASE'] }],
  },
  SAN1: {
    sceneId: 'SAN1',
    title: 'Sanctum of the Glass Heart',
    tasks: [
      { id: 'san1:vaelor', kind: 'clear', label: 'Defeat Archillusionist Vaelor', grants: ['ABILITY_GRAVITON_INVERSION'] },
      { id: 'san1:cynthia', kind: 'talk', npc: 'cynthia', label: 'Commune with Liberated Cynthia', x: 0, z: -1, radius: 1.8, grantsAny: ['PUZZLE_HOLLOW_GLASS'] },
    ],
  },
  WR1: {
    sceneId: 'WR1',
    title: "Wayfarer's Rest",
    tasks: [],
  },
};

export const FINALE_SCENE = 'S00';

/** Total number of actionable tasks, used for the HUD progress readout. */
export const TOTAL_TASKS: number = Object.values(SCENE_PLANS).reduce(
  (sum, plan) => sum + plan.tasks.length,
  0,
);

export function grantPresent(grants: readonly string[] | undefined, state: AutoProgressState): boolean {
  if (!grants) return true;
  return grants.some((id) => {
    if (id.startsWith('ITEM_')) return state.inventory.has(id);
    if (id.startsWith('PUZZLE_')) return state.solvedPuzzles.has(id);
    if (id.startsWith('ABILITY_')) return state.abilities.has(id);
    return false;
  });
}

export function requirementMet(id: string, state: AutoProgressState): boolean {
  if (id.startsWith('ITEM_')) return state.inventory.has(id);
  if (id.startsWith('PUZZLE_')) return state.solvedPuzzles.has(id);
  if (id.startsWith('ABILITY_')) return state.abilities.has(id);
  return false;
}

export function taskDone(task: AutoTask, sceneId: string, state: AutoProgressState): boolean {
  switch (task.kind) {
    case 'clear':
      return state.cleared.has(sceneId);
    case 'collect':
      return !!task.item && state.inventory.has(task.item);
    case 'solve':
      return !!task.puzzle && state.solvedPuzzles.has(task.puzzle);
    case 'talk':
      if (!state.flags.has(`talk:${task.npc}`)) return false;
      return grantPresent(task.grantsAny, state);
  }
}

export function taskReady(task: AutoTask, state: AutoProgressState): boolean {
  return (task.requires ?? []).every((req) => requirementMet(req, state));
}

export function scenePlanDone(sceneId: string, state: AutoProgressState): boolean {
  const plan = SCENE_PLANS[sceneId];
  if (!plan) return true;
  return plan.tasks.every((task) => taskDone(task, sceneId, state));
}

export function nextPendingTask(sceneId: string, state: AutoProgressState): AutoTask | null {
  const plan = SCENE_PLANS[sceneId];
  if (!plan) return null;
  for (const task of plan.tasks) {
    if (taskDone(task, sceneId, state)) continue;
    return task;
  }
  return null;
}

/**
 * First scene in the campaign that still needs work.
 *
 * Rooms with an empty task list (corridors, landings, puzzle galleries) are
 * still campaign goals the first time: the automaton has to physically cross
 * them, which is how it reaches the rooms beyond. Without the visit check the
 * planner would BFS straight past those corridors and leave them unexplored.
 */
export function nextGoal(state: AutoProgressState): string | null {
  for (const sceneId of CAMPAIGN_ORDER) {
    if (!state.visited.has(sceneId)) return sceneId;
    if (!scenePlanDone(sceneId, state)) return sceneId;
  }
  return null;
}

export function completedTaskCount(state: AutoProgressState): number {
  let done = 0;
  for (const plan of Object.values(SCENE_PLANS)) {
    for (const task of plan.tasks) {
      if (taskDone(task, plan.sceneId, state)) done++;
    }
  }
  return done;
}

export interface RouteDoor {
  to: string;
  /** Gate requirements carried by the door, when the caller supplies them. */
  requires?: readonly string[];
}

/**
 * Breadth-first route through the fortress door graph.
 *
 * Doors the automaton cannot open yet are excluded, so the route always
 * respects story gates (e.g. the Mirror Lock in GH2 or the Glass Heart exit in
 * SAN1). Returns scene ids beginning with `from`, or null when unreachable.
 */
export function planRoute(
  from: string,
  to: string,
  doors: Record<string, readonly RouteDoor[]>,
  canUse: (door: RouteDoor) => boolean = () => true,
): string[] | null {
  if (from === to) return [from];
  const queue: string[] = [from];
  const previous = new Map<string, string | null>([[from, null]]);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const links = doors[current] ?? [];
    for (const door of links) {
      if (!door || !door.to) continue;
      if (previous.has(door.to)) continue;
      if (!canUse(door)) continue;
      previous.set(door.to, current);
      if (door.to === to) {
        const route: string[] = [to];
        let cursor: string | null = current;
        while (cursor) {
          route.unshift(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        return route;
      }
      queue.push(door.to);
    }
  }
  return null;
}
