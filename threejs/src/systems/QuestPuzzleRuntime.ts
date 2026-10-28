import worldManifest from '../data/world_manifest.json';
import encountersData from '../data/encounters.json';
import originsData from '../data/origins.json';

export interface MultiStepPuzzleState {
  puzzleId: string;
  name: string;
  zoneId: string;
  requiredSequence: string[];
  currentProgress: string[];
  solved: boolean;
  clueText: string;
}

export interface QuestPuzzleSolution {
  method: string;
  requires: string[];
  available: boolean;
}

export interface QuestPuzzleView {
  id: string;
  sceneId: string;
  runtimePuzzleId: string;
  anchor: [number, number];
  solutions: QuestPuzzleSolution[];
  solved: boolean;
}

export interface QuestPickupView {
  id: string;
  sceneId: string;
  position: [number, number, number];
  requires: string[];
  reusable: boolean;
  collected: boolean;
}

export interface EncounterResolution {
  approach: 'lethal' | 'non-lethal';
  method: string;
  rewards: string[];
}

export interface EncounterView {
  id: string;
  sceneId: string;
  name: string;
  human: boolean;
  anchor: [number, number];
  lethal: { method: string; requires: string[] };
  nonLethal: { method: string; requires: string[] }[];
  rewards: string[];
  questId: string | null;
  resolved: EncounterResolution | null;
}

export interface ResolutionOutcome {
  ok: boolean;
  outcome: string;
  missing: string[];
  rewards: string[];
  questId: string | null;
}

export interface AttemptOutcome {
  ok: boolean;
  outcome: string;
  missing: string[];
  runtimePuzzleId?: string;
}

export interface PickupOutcome {
  ok: boolean;
  outcome: string;
  missing: string[];
}

export interface MirrorRotation {
  accepted: boolean;
  angle: number;
  solved: boolean;
}

export interface LeverOutcome {
  ok: boolean;
  outcome: string;
  leverId: string;
  stepIndex: number;
  totalSteps: number;
  message: string;
  solved: boolean;
}

export interface SteamJamState {
  sceneId: string;
  x: number;
  z: number;
}

export interface OriginLoadout {
  id: string;
  label: string;
  tag: string;
  statMods: Record<string, number>;
  startingItems: string[];
  flags: Record<string, boolean | number>;
  puzzleMethod: string | null;
}

export interface QuestRuntimeSnapshot {
  kills: number;
  humanKills: number;
  skills: Record<string, number>;
  flags: Record<string, boolean | number>;
  completedQuests: string[];
  traits: string[];
  originId: string;
  mirrorAngle: number;
  encounters: Record<string, EncounterResolution>;
  pickups: string[];
  shards: string[];
  levers: Record<string, string[]>;
}

export interface QuestPuzzleRuntimeOptions {
  inventory: Set<string>;
  abilities: Set<string>;
  solvedPuzzles: Set<string>;
  stats: Record<string, number>;
  originId?: string | (() => string);
  socialDisguise?: () => boolean;
}

interface ManifestSolution {
  method: string;
  requires?: string[];
}

interface ManifestPuzzle {
  id: string;
  anchor?: number[];
  runtimePuzzleId?: string;
  solutions?: ManifestSolution[];
}

interface ManifestPickup {
  id: string;
  position?: number[];
  requires?: string[];
  reusable?: boolean;
}

interface ManifestScene {
  id: string;
  pickups?: ManifestPickup[];
  puzzles?: ManifestPuzzle[];
}

interface EncounterDef {
  id: string;
  sceneId: string;
  name: string;
  human: boolean;
  anchor?: number[];
  lethal?: { method: string; requires?: string[] };
  nonLethal?: { method: string; requires?: string[] }[];
  rewards?: string[];
  questId?: string | null;
}

interface PuzzleDef {
  id: string;
  sceneId: string;
  runtimePuzzleId: string;
  anchor: [number, number];
  solutions: { method: string; requires: string[] }[];
}

interface PickupDef {
  id: string;
  sceneId: string;
  position: [number, number, number];
  requires: string[];
  reusable: boolean;
}

interface TraitDef {
  id: string;
  flags?: Record<string, boolean | number>;
}

interface OriginDef {
  id: string;
  label?: string;
  tag?: string;
  statMods?: Record<string, number>;
  startingItems?: string[];
  flags?: Record<string, boolean | number>;
  puzzleMethod?: string | null;
}

const SCENES = (worldManifest as unknown as { mvpVerticalSliceScenes: ManifestScene[] }).mvpVerticalSliceScenes;
const ENCOUNTER_DEFS = (encountersData as unknown as { encounters: EncounterDef[] }).encounters;
const ORIGINS_DATA = originsData as unknown as {
  maxTraits: number;
  baseStats: Record<string, number>;
  origins: OriginDef[];
  traits: TraitDef[];
};

const MIRROR_PUZZLE_ID = 'PUZ_GH2_MIRROR_LOCK';
const MIRROR_TARGET_DEGREES = 135;

/** Lever orders retained from the hand-authored multi-stage puzzles. */
const LEVER_ORDERS: Record<string, MultiStepPuzzleState> = {
  P12_LIBRARY_CIPHER: {
    puzzleId: 'P12_LIBRARY_CIPHER',
    name: 'Four-Tome Elemental Cipher',
    zoneId: 'L1',
    requiredSequence: ['lectern_ignis', 'lectern_aer', 'lectern_aqua', 'lectern_terra'],
    currentProgress: [],
    solved: false,
    clueText:
      'Archivist Orin whispers: "No mere conversation unlocks the Sanctum Index. Read the four elemental lecterns in the order of Creation: Flame (Ignis) rises to Wind (Aer), condenses to Water (Aqua), and settles as Stone (Terra)."',
  },
  P23_HEDGE_MAZE_LABYRINTH: {
    puzzleId: 'P23_HEDGE_MAZE_LABYRINTH',
    name: 'Labyrinth Moon-Rune Sequence & Clockwork Gate',
    zoneId: 'HM1',
    requiredSequence: ['maze_plate_1', 'maze_plate_2', 'maze_plate_3'],
    currentProgress: [],
    solved: false,
    clueText:
      'Bramble Warden notes: "The Iron Thorn Gate only retracts when a traveler physically treads the three Moon-Rune Pressure Plates hidden in the Southwest, Northeast, and Northwest dead-ends of the Hedge Maze."',
  },
  P30_CRYPT_HYDRAULICS: {
    puzzleId: 'P30_CRYPT_HYDRAULICS',
    name: 'Flooded Crypt Sluice-Gate Pressure Balance',
    zoneId: 'CR01',
    requiredSequence: ['sluice_valve_intake', 'sluice_valve_bypass', 'sluice_valve_drain'],
    currentProgress: [],
    solved: false,
    clueText:
      'Crypt Inscription: "To drain the Sunken Wyrm basin to 40 PSI, turn the West Intake Wheel first, then the Center Bypass, and finally the East Drain Sluice."',
  },
  P29_SANCTUM_CONDUITS: {
    puzzleId: 'P29_SANCTUM_CONDUITS',
    name: 'Aether Conduit Resonance Seal',
    zoneId: 'T05',
    requiredSequence: ['aether_conduit_1', 'aether_conduit_2', 'aether_conduit_3', 'aether_conduit_4'],
    currentProgress: [],
    solved: false,
    clueText:
      'Mirror Inscription: "Strike all four cardinal Aether Conduits with resonant force to sever Vaelor\'s illusion tethers."',
  },
};

/**
 * Data-backed runtime for manifest puzzles, pickups, encounters, skill checks,
 * memory shards and environmental hazards.
 *
 * All authoritative content lives in `src/data/*.json`; this class only keeps
 * the mutable per-run state (what the player has solved, collected, spent).
 * `main.ts` owns the long-lived `inventory` / `abilities` / `solvedPuzzles`
 * sets so save/restore and the quest journal stay in sync.
 */
export class QuestPuzzleRuntime {
  private readonly inventory: Set<string>;
  private readonly abilities: Set<string>;
  private readonly solvedPuzzles: Set<string>;
  private readonly stats: Record<string, number>;
  private readonly originOption: string | (() => string) | undefined;

  private readonly puzzleDefs = new Map<string, PuzzleDef>();
  private readonly pickupDefs = new Map<string, PickupDef>();
  private readonly encounterDefs = new Map<string, EncounterDef>();

  private readonly flags = new Map<string, boolean | number>();
  private readonly skills = new Map<string, number>();
  private readonly traits: string[] = [];
  private readonly completedQuests = new Set<string>();
  private readonly collectedPickups = new Set<string>();
  private readonly shards = new Set<string>();
  private readonly encounterResults = new Map<string, EncounterResolution>();
  private readonly leverProgress = new Map<string, string[]>();
  private readonly legacyPuzzles = new Map<string, MultiStepPuzzleState>();

  private originOverride: string | null = null;
  private mirrorDegrees = 0;
  private killCount = 0;
  private humanKillCount = 0;
  private jam: SteamJamState | null = null;

  constructor(options: QuestPuzzleRuntimeOptions) {
    this.inventory = options.inventory;
    this.abilities = options.abilities;
    this.solvedPuzzles = options.solvedPuzzles;
    this.stats = options.stats;
    this.originOption = options.originId;

    this.indexManifest();
    for (const def of ENCOUNTER_DEFS) this.encounterDefs.set(def.id, def);
    for (const [id, state] of Object.entries(LEVER_ORDERS)) {
      this.legacyPuzzles.set(id, { ...state, currentProgress: [] });
    }
  }

  // ------------------------------------------------------------ static data

  private indexManifest(): void {
    for (const scene of SCENES) {
      for (const puzzle of scene.puzzles ?? []) {
        this.puzzleDefs.set(puzzle.id, {
          id: puzzle.id,
          sceneId: scene.id,
          runtimePuzzleId: puzzle.runtimePuzzleId ?? puzzle.id,
          anchor: [puzzle.anchor?.[0] ?? 0, puzzle.anchor?.[1] ?? 0],
          solutions: (puzzle.solutions ?? []).map((solution) => ({
            method: solution.method,
            requires: [...(solution.requires ?? [])],
          })),
        });
      }
      for (const pickup of scene.pickups ?? []) {
        this.pickupDefs.set(pickup.id, {
          id: pickup.id,
          sceneId: scene.id,
          position: [pickup.position?.[0] ?? 0, pickup.position?.[1] ?? 0, pickup.position?.[2] ?? 0],
          requires: [...(pickup.requires ?? [])],
          reusable: pickup.reusable === true,
        });
      }
    }
  }

  public get baseStats(): Record<string, number> {
    return { ...ORIGINS_DATA.baseStats };
  }

  public get maxTraits(): number {
    return ORIGINS_DATA.maxTraits;
  }

  public origin(id: string): OriginLoadout | undefined {
    const def = ORIGINS_DATA.origins.find((entry) => entry.id === id);
    if (!def) return undefined;
    return {
      id: def.id,
      label: def.label ?? def.id,
      tag: def.tag ?? '',
      statMods: { ...(def.statMods ?? {}) },
      startingItems: [...(def.startingItems ?? [])],
      flags: { ...(def.flags ?? {}) },
      puzzleMethod: def.puzzleMethod ?? null,
    };
  }

  public origins(): OriginLoadout[] {
    return ORIGINS_DATA.origins.map((def) => this.origin(def.id)!).filter(Boolean);
  }

  public setOrigin(id: string): boolean {
    if (id && !ORIGINS_DATA.origins.some((entry) => entry.id === id)) return false;
    this.originOverride = id || null;
    return true;
  }

  private currentOriginId(): string {
    if (this.originOverride !== null) return this.originOverride;
    if (typeof this.originOption === 'function') return this.originOption();
    return this.originOption ?? '';
  }

  // ---------------------------------------------------------------- traits

  public setTraits(ids: string[]): string[] {
    const accepted: string[] = [];
    for (const id of ids) {
      if (accepted.length >= ORIGINS_DATA.maxTraits) break;
      if (!ORIGINS_DATA.traits.some((trait) => trait.id === id)) continue;
      if (accepted.includes(id)) continue;
      accepted.push(id);
    }
    this.traits.length = 0;
    this.traits.push(...accepted);
    return [...this.traits];
  }

  public trait(id: string): TraitDef | undefined {
    return ORIGINS_DATA.traits.find((entry) => entry.id === id);
  }

  public get activeTraits(): string[] {
    return [...this.traits];
  }

  // ------------------------------------------------------ flags & quest log

  public setFlag(id: string, value: boolean | number): void {
    this.flags.set(id, value);
  }

  public flag(id: string): boolean | number | undefined {
    return this.flags.get(id);
  }

  public completeQuest(id: string): { ok: boolean; id: string; alreadyComplete: boolean } {
    const alreadyComplete = this.completedQuests.has(id);
    this.completedQuests.add(id);
    this.flags.set(`QUEST_${id}_COMPLETE`, true);
    return { ok: true, id, alreadyComplete };
  }

  public get completedQuestIds(): string[] {
    return [...this.completedQuests];
  }

  // ------------------------------------------------------------- skill/stat

  public skillLevel(name: string): number {
    return this.skills.get(name) ?? 0;
  }

  public setSkill(name: string, level: number): number {
    const clamped = Math.max(0, Math.min(5, Math.round(level)));
    this.skills.set(name, clamped);
    return clamped;
  }

  private requirementMet(requirement: string): boolean {
    const stat = /^STAT_([A-Z]{3})_(\d+)$/.exec(requirement);
    if (stat) return (this.stats[stat[1]] ?? 0) >= Number(stat[2]);

    const skill = /^SKILL_([A-Z0-9_]+)_(\d+)$/.exec(requirement);
    if (skill) return this.skillLevel(skill[1]) >= Number(skill[2]);

    if (requirement.startsWith('ORIGIN_')) return this.currentOriginId() === requirement;
    if (requirement.startsWith('ITEM_')) return this.inventory.has(requirement);
    if (requirement.startsWith('ABILITY_')) return this.abilities.has(requirement);
    if (requirement.startsWith('PUZ_') || requirement.startsWith('PUZZLE_')) return this.solvedPuzzles.has(requirement);
    if (requirement.startsWith('FLAG_')) return Boolean(this.flags.get(requirement.slice(5)));

    return Boolean(this.flags.get(requirement));
  }

  public missingRequirements(requires: string[] | undefined): string[] {
    if (!requires || requires.length === 0) return [];
    return requires.filter((requirement) => !this.requirementMet(requirement));
  }

  // ---------------------------------------------------------------- puzzles

  private isPuzzleSolved(def: { id: string; runtimePuzzleId: string }): boolean {
    return this.solvedPuzzles.has(def.id) || this.solvedPuzzles.has(def.runtimePuzzleId);
  }

  private viewPuzzle(def: PuzzleDef): QuestPuzzleView {
    return {
      id: def.id,
      sceneId: def.sceneId,
      runtimePuzzleId: def.runtimePuzzleId,
      anchor: [...def.anchor],
      solutions: def.solutions.map((solution) => ({
        method: solution.method,
        requires: [...solution.requires],
        available: this.missingRequirements(solution.requires).length === 0,
      })),
      solved: this.isPuzzleSolved(def),
    };
  }

  public puzzles(): QuestPuzzleView[] {
    return [...this.puzzleDefs.values()].map((def) => this.viewPuzzle(def));
  }

  public puzzle(id: string): QuestPuzzleView | null {
    const def = this.puzzleDefs.get(id);
    return def ? this.viewPuzzle(def) : null;
  }

  public puzzleAt(sceneId: string, x: number, z: number, radius = 2.4): QuestPuzzleView | null {
    let best: { def: PuzzleDef; distance: number } | null = null;
    for (const def of this.puzzleDefs.values()) {
      if (def.sceneId !== sceneId) continue;
      const distance = Math.hypot(def.anchor[0] - x, def.anchor[1] - z);
      if (distance > radius) continue;
      if (!best || distance < best.distance) best = { def, distance };
    }
    return best ? this.viewPuzzle(best.def) : null;
  }

  public attempt(puzzleId: string, method: string): AttemptOutcome {
    const def = this.puzzleDefs.get(puzzleId);
    if (!def) return { ok: false, outcome: 'unknown-puzzle', missing: [] };
    if (this.isPuzzleSolved(def)) return { ok: false, outcome: 'already-solved', missing: [] };

    const solution = def.solutions.find((entry) => entry.method === method);
    if (!solution) return { ok: false, outcome: 'unknown-method', missing: [] };

    // The mirror rig is a mechanical puzzle: the method only lands once the
    // dial has actually been turned to 135 degrees.
    if (method === 'ROTATE_MIRRORS_45_90_135' && this.mirrorDegrees !== MIRROR_TARGET_DEGREES) {
      return { ok: false, outcome: 'align the mirror rig to 135 degrees first', missing: [] };
    }

    const missing = this.missingRequirements(solution.requires);
    if (missing.length > 0) return { ok: false, outcome: 'locked', missing };

    this.solvedPuzzles.add(def.id);
    this.solvedPuzzles.add(def.runtimePuzzleId);
    this.flags.set(`${def.runtimePuzzleId}_SOLVED`, true);
    this.flags.set(`${def.runtimePuzzleId}_METHOD`, 1);
    return { ok: true, outcome: 'solved', missing: [], runtimePuzzleId: def.runtimePuzzleId };
  }

  public interactLever(puzzleId: string, leverId: string): LeverOutcome {
    const legacy = this.legacyPuzzles.get(puzzleId);
    if (legacy) {
      const result = this.interactWithNode(puzzleId, leverId);
      const solved = result.status === 'puzzle_solved' || result.status === 'already_solved';
      if (solved) this.flags.set(`${puzzleId}_SOLVED`, true);
      return {
        ok: result.status !== 'wrong_order_reset',
        outcome: result.status,
        leverId,
        stepIndex: result.stepIndex,
        totalSteps: result.totalSteps,
        message: result.message,
        solved,
      };
    }

    const def = this.puzzleDefs.get(puzzleId);
    if (!def) {
      return {
        ok: false,
        outcome: 'unknown-puzzle',
        leverId,
        stepIndex: 0,
        totalSteps: 0,
        message: 'Unknown puzzle.',
        solved: false,
      };
    }
    if (this.isPuzzleSolved(def)) {
      return {
        ok: true,
        outcome: 'already-solved',
        leverId,
        stepIndex: 1,
        totalSteps: 1,
        message: `${def.id} is already solved.`,
        solved: true,
      };
    }

    const progress = this.leverProgress.get(puzzleId) ?? [];
    progress.push(leverId);
    this.leverProgress.set(puzzleId, progress);
    this.solvedPuzzles.add(def.id);
    this.solvedPuzzles.add(def.runtimePuzzleId);
    this.flags.set(`${def.runtimePuzzleId}_SOLVED`, true);
    return {
      ok: true,
      outcome: 'puzzle_solved',
      leverId,
      stepIndex: 1,
      totalSteps: 1,
      message: `Mechanism engaged (${leverId}). ${def.id} released.`,
      solved: true,
    };
  }

  public rotateMirror(degrees: number): MirrorRotation {
    if (![45, 90, 135].includes(degrees)) {
      return { accepted: false, angle: this.mirrorDegrees, solved: this.mirrorSolved() };
    }
    this.mirrorDegrees = (this.mirrorDegrees + degrees) % 360;
    const solved = this.mirrorDegrees === MIRROR_TARGET_DEGREES;
    if (solved) {
      const def = this.puzzleDefs.get(MIRROR_PUZZLE_ID);
      if (def) {
        this.solvedPuzzles.add(def.id);
        this.solvedPuzzles.add(def.runtimePuzzleId);
      }
      this.flags.set('PUZZLE_MIRROR_LOCK_SOLVED', true);
    }
    return { accepted: true, angle: this.mirrorDegrees, solved };
  }

  public get mirrorAngle(): number {
    return this.mirrorDegrees;
  }

  public resetMirror(): number {
    this.mirrorDegrees = 0;
    return this.mirrorDegrees;
  }

  private mirrorSolved(): boolean {
    const def = this.puzzleDefs.get(MIRROR_PUZZLE_ID);
    return def ? this.isPuzzleSolved(def) : false;
  }

  // ---------------------------------------------------------------- pickups

  private pickupView(def: PickupDef): QuestPickupView {
    return {
      id: def.id,
      sceneId: def.sceneId,
      position: [...def.position],
      requires: [...def.requires],
      reusable: def.reusable,
      collected: this.pickupCollected(def.id),
    };
  }

  public pickupAt(sceneId: string, x: number, z: number, radius = 1.9): QuestPickupView | null {
    let best: { def: PickupDef; distance: number } | null = null;
    for (const def of this.pickupDefs.values()) {
      if (def.sceneId !== sceneId) continue;
      const distance = Math.hypot(def.position[0] - x, def.position[2] - z);
      if (distance > radius) continue;
      if (!best || distance < best.distance) best = { def, distance };
    }
    return best ? this.pickupView(best.def) : null;
  }

  public pickupCollected(id: string): boolean {
    const def = this.pickupDefs.get(id);
    if (!def) return this.collectedPickups.has(id);
    if (def.reusable) return false;
    return this.collectedPickups.has(id);
  }

  public collectPickup(id: string): PickupOutcome {
    const def = this.pickupDefs.get(id);
    if (!def) return { ok: false, outcome: 'unknown-pickup', missing: [] };
    if (this.pickupCollected(id)) return { ok: false, outcome: 'already-collected', missing: [] };

    const missing = this.missingRequirements(def.requires);
    if (missing.length > 0) return { ok: false, outcome: 'locked', missing };

    this.inventory.add(def.id);
    if (!def.reusable) this.collectedPickups.add(def.id);
    if (def.id.startsWith('SHARD_')) {
      this.shards.add(def.id);
      this.flags.set(`SHARD_${def.id}_COLLECTED`, true);
    }
    return { ok: true, outcome: 'collected', missing: [] };
  }

  public collectShard(id: string): PickupOutcome {
    if (!id.startsWith('SHARD_')) return { ok: false, outcome: 'unknown-shard', missing: [] };
    const def = this.pickupDefs.get(id);
    if (def) return this.collectPickup(id);
    this.shards.add(id);
    this.inventory.add(id);
    return { ok: true, outcome: 'collected', missing: [] };
  }

  public get memoryShards(): string[] {
    return [...this.shards];
  }

  public get memoryShardCount(): number {
    return this.shards.size;
  }

  // ------------------------------------------------------------- encounters

  private encounterView(def: EncounterDef): EncounterView {
    return {
      id: def.id,
      sceneId: def.sceneId,
      name: def.name,
      human: def.human,
      anchor: [def.anchor?.[0] ?? 0, def.anchor?.[1] ?? 0],
      lethal: { method: def.lethal?.method ?? 'MELEE_PARRY', requires: [...(def.lethal?.requires ?? [])] },
      nonLethal: (def.nonLethal ?? []).map((entry) => ({ method: entry.method, requires: [...(entry.requires ?? [])] })),
      rewards: [...(def.rewards ?? [])],
      questId: def.questId ?? null,
      resolved: this.encounterResults.get(def.id) ?? null,
    };
  }

  public encounters(): EncounterView[] {
    return [...this.encounterDefs.values()].map((def) => this.encounterView(def));
  }

  public encounterAt(sceneId: string, x: number, z: number, radius = 2.0): EncounterView | null {
    let best: { def: EncounterDef; distance: number } | null = null;
    for (const def of this.encounterDefs.values()) {
      if (def.sceneId !== sceneId) continue;
      const ax = def.anchor?.[0] ?? 0;
      const az = def.anchor?.[1] ?? 0;
      const distance = Math.hypot(ax - x, az - z);
      if (distance > radius) continue;
      if (!best || distance < best.distance) best = { def, distance };
    }
    return best ? this.encounterView(best.def) : null;
  }

  public encounterResult(id: string): EncounterResolution | null {
    return this.encounterResults.get(id) ?? null;
  }

  public resolve(encounterId: string, approach: 'lethal' | 'non-lethal', method?: string): ResolutionOutcome {
    const def = this.encounterDefs.get(encounterId);
    if (!def) {
      return { ok: false, outcome: 'unknown-encounter', missing: [], rewards: [], questId: null };
    }
    if (this.encounterResults.has(encounterId)) {
      return { ok: false, outcome: 'already-resolved', missing: [], rewards: [], questId: def.questId ?? null };
    }

    let chosenMethod: string;
    let requires: string[] = [];
    if (approach === 'lethal') {
      chosenMethod = method ?? def.lethal?.method ?? 'MELEE_PARRY';
      requires = [...(def.lethal?.requires ?? [])];
    } else {
      const options = def.nonLethal ?? [];
      if (!def.human || options.length === 0) {
        return { ok: false, outcome: 'not-available', missing: [], rewards: [], questId: def.questId ?? null };
      }
      const chosen = method ? options.find((entry) => entry.method === method) : options[0];
      if (!chosen) {
        return { ok: false, outcome: 'unknown-method', missing: [], rewards: [], questId: def.questId ?? null };
      }
      chosenMethod = chosen.method;
      requires = [...(chosen.requires ?? [])];
    }

    const missing = this.missingRequirements(requires);
    if (missing.length > 0) {
      return { ok: false, outcome: 'locked', missing, rewards: [], questId: def.questId ?? null };
    }

    const rewards = [...(def.rewards ?? [])];
    for (const reward of rewards) this.grantReward(reward);
    this.encounterResults.set(encounterId, { approach, method: chosenMethod, rewards });
    this.flags.set(`ENC_${encounterId}_${approach.toUpperCase()}`, true);
    if (approach === 'lethal') this.recordKill(def.human);
    if (def.questId) this.completeQuest(def.questId);

    return { ok: true, outcome: approach === 'lethal' ? 'lethal-resolved' : 'non-lethal-resolved', missing: [], rewards, questId: def.questId ?? null };
  }

  private grantReward(reward: string): void {
    if (reward.startsWith('ITEM_')) {
      this.inventory.add(reward);
      return;
    }
    if (reward.startsWith('ABILITY_')) {
      this.abilities.add(reward);
      return;
    }
    const skill = /^SKILL_([A-Z0-9_]+)_(\d+)$/.exec(reward);
    if (skill) this.setSkill(skill[1], Number(skill[2]));
  }

  public recordKill(human: boolean): { kills: number; humanKills: number } {
    this.killCount += 1;
    if (human) this.humanKillCount += 1;
    return { kills: this.killCount, humanKills: this.humanKillCount };
  }

  public get kills(): number {
    return this.killCount;
  }

  public get humanKills(): number {
    return this.humanKillCount;
  }

  // ----------------------------------------------------------- achievements

  public get achievements(): string[] {
    const unlocked: string[] = [];
    if (this.killCount >= 1) unlocked.push('ACH_FIRST_BLOOD');
    if (this.humanKillCount === 0 && this.killCount >= 3) unlocked.push('ACH_QUIET_BLADE');
    if ([...this.encounterResults.values()].some((entry) => entry.approach === 'non-lethal')) {
      unlocked.push('ACH_THIEF_TRADECRAFT');
    }
    if (this.solvedPuzzles.size >= 3) unlocked.push('ACH_PUZZLER');
    if (this.shards.size >= 1) unlocked.push('ACH_SHARDKEEPER');
    if (this.completedQuests.size >= 1) unlocked.push('ACH_DEBT_PAID');
    return unlocked;
  }

  public hasAchievement(id: string): boolean {
    return this.achievements.includes(id);
  }

  // ------------------------------------------------------ hazards / gates

  public triggerSteamJam(sceneId: string, x: number, z: number): SteamJamState {
    this.jam = { sceneId, x, z };
    this.flags.set('STEAM_JAM_ACTIVE', true);
    return { ...this.jam };
  }

  public clearSteamJam(): void {
    this.jam = null;
    this.flags.set('STEAM_JAM_ACTIVE', false);
  }

  public get steamJam(): SteamJamState | null {
    return this.jam ? { ...this.jam } : null;
  }

  public hazardDamageAt(sceneId: string, x: number, z: number): number {
    if (!this.jam || this.jam.sceneId !== sceneId) return 0;
    return Math.hypot(this.jam.x - x, this.jam.z - z) <= 1.6 ? 8 : 0;
  }

  public get portcullisPassable(): boolean {
    return (
      this.solvedPuzzles.has('PUZZLE_RETROCAUSAL_PORTCULLIS') ||
      this.flag('PORTCULLIS_OPEN') === true
    );
  }

  // ----------------------------------------------------- legacy clue engine

  public getNpcClueForZone(zoneId: string): string {
    for (const p of this.legacyPuzzles.values()) {
      if (p.zoneId === zoneId) return p.clueText;
    }
    return 'Inspect the mechanical contraptions in this room carefully.';
  }

  public interactWithNode(
    puzzleId: string,
    nodeId: string,
  ): {
    status: 'step_advanced' | 'wrong_order_reset' | 'puzzle_solved' | 'already_solved';
    stepIndex: number;
    totalSteps: number;
    message: string;
  } {
    const p = this.legacyPuzzles.get(puzzleId);
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
    }

    p.currentProgress = [];
    return {
      status: 'wrong_order_reset',
      stepIndex: 0,
      totalSteps: p.requiredSequence.length,
      message: `Incorrect sequence on ${p.name}! Runes reset\u2014consult the room clues.`,
    };
  }

  // ------------------------------------------------------- save / restore

  public serialize(): QuestRuntimeSnapshot {
    return {
      kills: this.killCount,
      humanKills: this.humanKillCount,
      skills: Object.fromEntries(this.skills),
      flags: Object.fromEntries(this.flags),
      completedQuests: [...this.completedQuests],
      traits: [...this.traits],
      originId: this.currentOriginId(),
      mirrorAngle: this.mirrorDegrees,
      encounters: Object.fromEntries(this.encounterResults),
      pickups: [...this.collectedPickups],
      shards: [...this.shards],
      levers: Object.fromEntries(this.leverProgress),
    };
  }

  public restore(data: Partial<QuestRuntimeSnapshot> | null | undefined): void {
    this.reset();
    if (!data) return;

    this.killCount = Math.max(0, Number(data.kills ?? 0));
    this.humanKillCount = Math.max(0, Number(data.humanKills ?? 0));
    for (const [name, level] of Object.entries(data.skills ?? {})) this.setSkill(name, Number(level));
    for (const [id, value] of Object.entries(data.flags ?? {})) this.flags.set(id, value);
    for (const id of data.completedQuests ?? []) this.completedQuests.add(id);
    this.setTraits(data.traits ?? []);
    if (data.originId) this.originOverride = data.originId;
    this.mirrorDegrees = Number(data.mirrorAngle ?? 0);
    for (const [id, resolution] of Object.entries(data.encounters ?? {})) {
      this.encounterResults.set(id, resolution);
    }
    for (const id of data.pickups ?? []) this.collectedPickups.add(id);
    for (const id of data.shards ?? []) this.shards.add(id);
    for (const [id, levers] of Object.entries(data.levers ?? {})) this.leverProgress.set(id, [...levers]);
  }

  public reset(): void {
    this.flags.clear();
    this.skills.clear();
    this.traits.length = 0;
    this.completedQuests.clear();
    this.collectedPickups.clear();
    this.shards.clear();
    this.encounterResults.clear();
    this.leverProgress.clear();
    this.originOverride = null;
    this.mirrorDegrees = 0;
    this.killCount = 0;
    this.humanKillCount = 0;
    this.jam = null;
    for (const p of this.legacyPuzzles.values()) {
      p.currentProgress = [];
      p.solved = false;
    }
  }
}
