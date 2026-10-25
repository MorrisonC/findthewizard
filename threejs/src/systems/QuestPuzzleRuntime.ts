/**
 * Quest, puzzle and encounter runtime.
 *
 * The GDD (`5b.1`, `5`, `42-46`) and `world_manifest.json` describe far more
 * CRPG state than the action loop used to keep: multi-solution puzzles, origin
 * loadouts, lethal/non-lethal boss resolutions, kill accounting for the
 * "Shadowhand" pacifist path, Memory Shards, and the failing-forward
 * `EVENT_ORIN_PANIC_STEAM_JAM` hazard. This module is the single authority for
 * that state.
 *
 * It is deliberately UI-free. `main.ts` owns the DOM, audio and physics; this
 * class owns the rules, so the same code path is used by gameplay hooks and by
 * the Playwright `__veilkeep.qa` hooks.
 *
 * Design guarantees the verification suite relies on:
 *
 * - `attempt()` is pure with respect to failure. A locked or unknown method
 *   never consumes an item, never marks a puzzle failed, and can be retried.
 * - Mirror rotation is modular (45/90/135 on a 180-degree ring), so no ordering
 *   of lever or mirror interactions can strand the player outside the reachable
 *   solution (90 degrees is a multiple of gcd(45, 90, 135, 180) = 45).
 * - `resolve()` is idempotent per encounter; calling the lethal hook twice (once
 *   from the death pipeline, once from a QA shortcut) cannot double-count a
 *   kill or double-award a reward.
 * - `serialize()` / `restore()` round-trip every mutable field so a reload
 *   cannot silently drop a solved puzzle, shard or conviction-relevant quest.
 */

import originsData from '../data/origins.json';
import encountersData from '../data/encounters.json';
import worldManifest from '../data/world_manifest.json';

export type StatKey = 'STR' | 'AGI' | 'VIT' | 'INT' | 'CHA' | 'LCK';

export interface OriginDefinition {
  id: string;
  label: string;
  desc: string;
  statMods: Partial<Record<StatKey, number>>;
  tag: string;
  startingItems: string[];
  flags: Record<string, boolean | number>;
  passive: string;
  puzzleMethod: string | null;
}

export interface TraitDefinition {
  id: string;
  label: string;
  desc: string;
  flags: Record<string, boolean | number>;
}

export interface RequirementSet {
  method: string;
  requires: string[];
}

export interface EncounterDefinition {
  id: string;
  sceneId: string;
  name: string;
  human: boolean;
  anchor: [number, number];
  lethal: RequirementSet;
  nonLethal: RequirementSet[];
  rewards: string[];
  questId: string | null;
}

export interface PuzzleDefinition {
  id: string;
  sceneId: string;
  anchor: [number, number];
  solutions: RequirementSet[];
  runtimePuzzleId: string | null;
}

export interface PickupDefinition {
  id: string;
  sceneId: string;
  position: [number, number, number];
  requires: string[];
  reusable: boolean;
}

export interface QuestRuntimeContext {
  inventory: Set<string>;
  abilities: Set<string>;
  solvedPuzzles: Set<string>;
  stats: Record<string, number>;
  originId: () => string;
  socialDisguise: () => boolean;
}

export type PuzzleOutcome =
  | 'solved'
  | 'already-solved'
  | 'unknown-puzzle'
  | 'unknown-method'
  | 'locked';

export interface PuzzleAttempt {
  ok: boolean;
  outcome: PuzzleOutcome;
  puzzleId: string;
  method: string;
  missing: string[];
  runtimePuzzleId: string | null;
}

export interface PuzzleSolutionView extends RequirementSet {
  available: boolean;
  missing: string[];
}

export interface PuzzleView {
  id: string;
  sceneId: string;
  anchor: [number, number];
  solved: boolean;
  chosenMethod: string | null;
  solutions: PuzzleSolutionView[];
}

export type EncounterApproach = 'lethal' | 'non-lethal';

export type EncounterOutcome =
  | 'resolved'
  | 'already-resolved'
  | 'unknown-encounter'
  | 'unknown-method'
  | 'not-available'
  | 'locked';

export interface EncounterResult {
  encounterId: string;
  approach: EncounterApproach;
  method: string;
  rewards: string[];
  human: boolean;
}

export interface EncounterResolution {
  ok: boolean;
  outcome: EncounterOutcome;
  encounterId: string;
  approach: EncounterApproach | null;
  method: string | null;
  missing: string[];
  rewards: string[];
  result: EncounterResult | null;
}

export interface SteamJamState {
  active: boolean;
  sceneId: string;
  x: number;
  z: number;
  radius: number;
  dps: number;
  portcullisHalfOpen: boolean;
}

export interface KillLedger {
  human: number;
  nonHuman: number;
  spared: number;
}

export interface QuestRuntimeSave {
  version: number;
  originId: string;
  traits: string[];
  solvedPuzzles: string[];
  puzzleMethods: Record<string, string>;
  mirrorAngle: number;
  levers: Record<string, boolean>;
  flags: Record<string, boolean | number>;
  skills: Record<string, number>;
  kills: KillLedger;
  achievements: string[];
  shards: string[];
  quests: string[];
  encounters: Record<string, EncounterResult>;
  steamJam: SteamJamState | null;
}

/** Canonical item ids and the legacy ids still written by older data files. */
const ITEM_ALIAS_GROUPS: readonly (readonly string[])[] = [
  ['ITEM_GATEHOUSE_KEY', 'key_gatehouse'],
  ['ITEM_IRON_NAIL', 'relic_iron_nails'],
  ['SHARD_01_GATE', 'shard_gate'],
];

const SHARD_CANONICAL: Record<string, string> = {
  shard_gate: 'SHARD_01_GATE',
  SHARD_01_GATE: 'SHARD_01_GATE',
};

const SHARD_ITEM: Record<string, string> = {
  SHARD_01_GATE: 'shard_gate',
};

const SHARD_ACHIEVEMENT_ORDER = [
  'SHARD_01_GATE',
  'shard_hearth',
  'shard_glass',
  'shard_garden',
  'shard_spire',
  'shard_crypt',
  'shard_void',
];

interface ManifestPuzzle {
  id: string;
  solutions: RequirementSet[];
  anchor?: number[];
  runtimePuzzleId?: string;
}

interface ManifestPickup {
  id: string;
  position: number[];
  requires?: string[];
  reusable?: boolean;
}

interface ManifestScene {
  id: string;
  puzzles?: ManifestPuzzle[];
  pickups?: ManifestPickup[];
}

const origins = originsData.origins as unknown as OriginDefinition[];
const traits = originsData.traits as unknown as TraitDefinition[];
const encounters = encountersData.encounters as unknown as EncounterDefinition[];

const manifestScenes = (worldManifest as unknown as { mvpVerticalSliceScenes: ManifestScene[] })
  .mvpVerticalSliceScenes;

const puzzleCatalog: PuzzleDefinition[] = [];
const pickupCatalog: PickupDefinition[] = [];
for (const scene of manifestScenes) {
  for (const puzzle of scene.puzzles ?? []) {
    puzzleCatalog.push({
      id: puzzle.id,
      sceneId: scene.id,
      anchor: [
        Array.isArray(puzzle.anchor) ? Number(puzzle.anchor[0]) : 0,
        Array.isArray(puzzle.anchor) ? Number(puzzle.anchor[1]) : 0,
      ],
      solutions: puzzle.solutions.map((solution) => ({
        method: solution.method,
        requires: [...solution.requires],
      })),
      runtimePuzzleId: puzzle.runtimePuzzleId ?? null,
    });
  }
  for (const pickup of scene.pickups ?? []) {
    pickupCatalog.push({
      id: pickup.id,
      sceneId: scene.id,
      position: [
        Number(pickup.position?.[0] ?? 0),
        Number(pickup.position?.[1] ?? 0),
        Number(pickup.position?.[2] ?? 0),
      ],
      requires: [...(pickup.requires ?? [])],
      reusable: pickup.reusable === true,
    });
  }
}

const MIRROR_PUZZLE_ID = 'PUZ_GH2_MIRROR_LOCK';
const MIRROR_SOLUTION_METHOD = 'ROTATE_MIRRORS_45_90_135';
const MIRROR_TARGET_ANGLE = 90;
const MIRROR_ACCEPTED_STEPS = [45, 90, 135];

function cloneKills(kills: KillLedger): KillLedger {
  return { human: kills.human, nonHuman: kills.nonHuman, spared: kills.spared };
}

function emptyKills(): KillLedger {
  return { human: 0, nonHuman: 0, spared: 0 };
}

export class QuestPuzzleRuntime {
  private readonly ctx: QuestRuntimeContext;

  private originIdValue = '';
  private traitIds: string[] = [];
  private solvedPuzzleIds = new Set<string>();
  private puzzleMethods: Record<string, string> = {};
  private mirrorAngleValue = 0;
  private levers: Record<string, boolean> = {};
  private flags: Record<string, boolean | number> = {};
  private skills: Record<string, number> = {};
  private killsValue: KillLedger = emptyKills();
  private achievementSet = new Set<string>();
  private shards = new Set<string>();
  private quests = new Set<string>();
  private encounterResults: Record<string, EncounterResult> = {};
  private steamJamState: SteamJamState | null = null;

  constructor(ctx: QuestRuntimeContext) {
    this.ctx = ctx;
  }

  // ---------------------------------------------------------------- origins

  origins(): readonly OriginDefinition[] {
    return origins;
  }

  traits(): readonly TraitDefinition[] {
    return traits;
  }

  get maxTraits(): number {
    return Number((originsData as { maxTraits?: number }).maxTraits ?? 2);
  }

  get baseStats(): Record<StatKey, number> {
    const base = (originsData as { baseStats?: Record<string, number> }).baseStats ?? {};
    return {
      STR: Number(base.STR ?? 10),
      AGI: Number(base.AGI ?? 10),
      VIT: Number(base.VIT ?? 10),
      INT: Number(base.INT ?? 10),
      CHA: Number(base.CHA ?? 10),
      LCK: Number(base.LCK ?? 10),
    };
  }

  origin(id: string): OriginDefinition | null {
    return origins.find((entry) => entry.id === id) ?? null;
  }

  trait(id: string): TraitDefinition | null {
    return traits.find((entry) => entry.id === id) ?? null;
  }

  setOrigin(id: string): void {
    this.originIdValue = id;
  }

  get originId(): string {
    return this.originIdValue || this.ctx.originId();
  }

  setTraits(ids: string[]): string[] {
    const accepted = ids.filter((id) => this.trait(id)).slice(0, this.maxTraits);
    this.traitIds = [...new Set(accepted)];
    return this.traitIds;
  }

  get selectedTraits(): readonly string[] {
    return this.traitIds;
  }

  /** Everything `main.ts` needs to apply an origin at character creation. */
  buildOriginLoadout(id: string): {
    origin: OriginDefinition | null;
    statMods: Partial<Record<StatKey, number>>;
    startingItems: string[];
    flags: Record<string, boolean | number>;
    tag: string;
    puzzleMethod: string | null;
  } {
    const origin = this.origin(id);
    return {
      origin,
      statMods: origin ? { ...origin.statMods } : {},
      startingItems: origin ? [...origin.startingItems] : [],
      flags: origin ? { ...origin.flags } : {},
      tag: origin?.tag ?? '',
      puzzleMethod: origin?.puzzleMethod ?? null,
    };
  }

  // --------------------------------------------------------------- puzzles

  puzzles(): PuzzleView[] {
    return puzzleCatalog.map((puzzle) => ({
      id: puzzle.id,
      sceneId: puzzle.sceneId,
      anchor: [...puzzle.anchor] as [number, number],
      solved: this.solvedPuzzleIds.has(puzzle.id),
      chosenMethod: this.puzzleMethods[puzzle.id] ?? null,
      solutions: puzzle.solutions.map((solution) => {
        const missing = this.missingRequirements(solution.requires);
        return {
          method: solution.method,
          requires: [...solution.requires],
          available: missing.length === 0,
          missing,
        };
      }),
    }));
  }

  puzzle(id: string): PuzzleView | null {
    return this.puzzles().find((entry) => entry.id === id) ?? null;
  }

  puzzleAt(sceneId: string, x: number, z: number, radius = 1.8): PuzzleView | null {
    let best: PuzzleView | null = null;
    let bestDistance = radius;
    for (const puzzle of this.puzzles()) {
      if (puzzle.sceneId !== sceneId) continue;
      const distance = Math.hypot(puzzle.anchor[0] - x, puzzle.anchor[1] - z);
      if (distance <= bestDistance) {
        best = puzzle;
        bestDistance = distance;
      }
    }
    return best;
  }

  isPuzzleSolved(id: string): boolean {
    return this.solvedPuzzleIds.has(id);
  }

  /**
   * Try one documented solution. Failure is non-destructive: the caller may
   * immediately try another method or come back later with the required item.
   */
  attempt(puzzleId: string, method: string): PuzzleAttempt {
    const puzzle = puzzleCatalog.find((entry) => entry.id === puzzleId);
    if (!puzzle) {
      return { ok: false, outcome: 'unknown-puzzle', puzzleId, method, missing: [], runtimePuzzleId: null };
    }
    if (this.solvedPuzzleIds.has(puzzleId)) {
      return {
        ok: true,
        outcome: 'already-solved',
        puzzleId,
        method: this.puzzleMethods[puzzleId] ?? method,
        missing: [],
        runtimePuzzleId: puzzle.runtimePuzzleId,
      };
    }
    const solution = puzzle.solutions.find((entry) => entry.method === method);
    if (!solution) {
      return { ok: false, outcome: 'unknown-method', puzzleId, method, missing: [], runtimePuzzleId: puzzle.runtimePuzzleId };
    }
    const missing = this.missingRequirements(solution.requires);
    if (missing.length > 0) {
      return { ok: false, outcome: 'locked', puzzleId, method, missing, runtimePuzzleId: puzzle.runtimePuzzleId };
    }

    this.solvedPuzzleIds.add(puzzleId);
    this.puzzleMethods[puzzleId] = method;
    if (puzzle.runtimePuzzleId) this.ctx.solvedPuzzles.add(puzzle.runtimePuzzleId);
    this.ctx.solvedPuzzles.add(puzzleId);
    this.flags[`PUZZLE_${puzzleId}`] = true;
    this.flags[`PUZZLE_${puzzleId}_METHOD_${method}`] = true;
    return { ok: true, outcome: 'solved', puzzleId, method, missing: [], runtimePuzzleId: puzzle.runtimePuzzleId };
  }

  get mirrorAngle(): number {
    return this.mirrorAngleValue;
  }

  /**
   * Rotate the GH2 mirror rig. Angles are modular on a 180-degree ring, which
   * is what makes out-of-order experimentation safe: 45 + 135 returns to 0,
   * and any sequence that lands on 90 solves the lock.
   */
  rotateMirror(degrees: number): { accepted: boolean; angle: number; solved: boolean; puzzleId: string } {
    const accepted = MIRROR_ACCEPTED_STEPS.includes(degrees);
    if (!accepted) {
      return { accepted: false, angle: this.mirrorAngleValue, solved: this.isPuzzleSolved(MIRROR_PUZZLE_ID), puzzleId: MIRROR_PUZZLE_ID };
    }
    this.mirrorAngleValue = (this.mirrorAngleValue + degrees) % 180;
    let solved = this.isPuzzleSolved(MIRROR_PUZZLE_ID);
    if (!solved && this.mirrorAngleValue === MIRROR_TARGET_ANGLE) {
      solved = this.attempt(MIRROR_PUZZLE_ID, MIRROR_SOLUTION_METHOD).ok;
    }
    return { accepted: true, angle: this.mirrorAngleValue, solved, puzzleId: MIRROR_PUZZLE_ID };
  }

  resetMirror(): void {
    this.mirrorAngleValue = 0;
  }

  /**
   * Toggle a lever for any puzzle. This exists to prove that partial,
   * out-of-order interaction is never destructive; it only records state.
   */
  interactLever(puzzleId: string, leverId: string): { key: string; on: boolean; solved: boolean } {
    const key = `${puzzleId}:${leverId}`;
    this.levers[key] = !this.levers[key];
    return { key, on: this.levers[key], solved: this.isPuzzleSolved(puzzleId) };
  }

  // -------------------------------------------------------------- pickups

  pickups(): readonly PickupDefinition[] {
    return pickupCatalog;
  }

  pickupAt(sceneId: string, x: number, z: number, radius = 1.8): PickupDefinition | null {
    let best: PickupDefinition | null = null;
    let bestDistance = radius;
    for (const pickup of pickupCatalog) {
      if (pickup.sceneId !== sceneId) continue;
      const distance = Math.hypot(pickup.position[0] - x, pickup.position[2] - z);
      if (distance <= bestDistance) {
        best = pickup;
        bestDistance = distance;
      }
    }
    return best;
  }

  pickupCollected(id: string): boolean {
    if (id === 'SHARD_01_GATE' || id === 'shard_gate') {
      return this.shards.has('SHARD_01_GATE');
    }
    return this.ctx.inventory.has(id) || this.ctx.solvedPuzzles.has(`PICKUP_${id}`);
  }

  collectPickup(id: string): { ok: boolean; outcome: 'collected' | 'already-collected' | 'locked'; missing: string[]; id: string } {
    const pickup = pickupCatalog.find((entry) => entry.id === id);
    if (!pickup) {
      return { ok: false, outcome: 'locked', missing: ['UNKNOWN_PICKUP'], id };
    }
    if (this.pickupCollected(id)) {
      return { ok: true, outcome: 'already-collected', missing: [], id };
    }
    const missing = this.missingRequirements(pickup.requires);
    if (missing.length > 0) {
      return { ok: false, outcome: 'locked', missing, id };
    }
    if (id === 'SHARD_01_GATE') {
      this.collectShard(id);
    } else {
      this.ctx.inventory.add(id);
    }
    this.ctx.solvedPuzzles.add(`PICKUP_${id}`);
    return { ok: true, outcome: 'collected', missing: [], id };
  }

  // ------------------------------------------------------------- encounters

  encounters(): readonly EncounterDefinition[] {
    return encounters;
  }

  encounter(id: string): EncounterDefinition | null {
    return encounters.find((entry) => entry.id === id) ?? null;
  }

  encounterAt(sceneId: string, x: number, z: number, radius = 1.8): EncounterDefinition | null {
    let best: EncounterDefinition | null = null;
    let bestDistance = radius;
    for (const encounter of encounters) {
      if (encounter.sceneId !== sceneId) continue;
      const distance = Math.hypot(encounter.anchor[0] - x, encounter.anchor[1] - z);
      if (distance <= bestDistance) {
        best = encounter;
        bestDistance = distance;
      }
    }
    return best;
  }

  encounterResult(id: string): EncounterResult | null {
    return this.encounterResults[id] ?? null;
  }

  /**
   * Resolve an encounter lethally or via a sabotage method. Lethal human kills
   * increment the human ledger; a sabotage resolution increments `spared` and
   * never touches the human count, which is what the Shadowhand achievement
   * watches.
   */
  resolve(encounterId: string, approach: EncounterApproach, method?: string): EncounterResolution {
    const encounter = this.encounter(encounterId);
    const base: EncounterResolution = {
      ok: false,
      outcome: 'unknown-encounter',
      encounterId,
      approach,
      method: method ?? null,
      missing: [],
      rewards: [],
      result: null,
    };
    if (!encounter) return base;

    const existing = this.encounterResults[encounterId];
    if (existing) {
      return {
        ok: true,
        outcome: 'already-resolved',
        encounterId,
        approach: existing.approach,
        method: existing.method,
        missing: [],
        rewards: [...existing.rewards],
        result: existing,
      };
    }

    let chosen: RequirementSet;
    if (approach === 'non-lethal') {
      if (!encounter.human || encounter.nonLethal.length === 0) {
        return { ...base, outcome: 'not-available' };
      }
      const candidate = method
        ? encounter.nonLethal.find((entry) => entry.method === method)
        : encounter.nonLethal[0];
      if (!candidate) return { ...base, outcome: 'unknown-method' };
      const missing = this.missingRequirements(candidate.requires);
      if (missing.length > 0) return { ...base, outcome: 'locked', missing };
      chosen = candidate;
    } else {
      if (method && method !== encounter.lethal.method) {
        return { ...base, outcome: 'unknown-method' };
      }
      const missing = this.missingRequirements(encounter.lethal.requires);
      if (missing.length > 0) return { ...base, outcome: 'locked', missing };
      chosen = encounter.lethal;
    }

    for (const reward of encounter.rewards) {
      if (reward.startsWith('ABILITY_')) this.ctx.abilities.add(reward);
      else this.ctx.inventory.add(reward);
    }

    if (approach === 'lethal') {
      if (encounter.human) this.killsValue.human += 1;
      else this.killsValue.nonHuman += 1;
    } else {
      this.killsValue.spared += 1;
    }

    const result: EncounterResult = {
      encounterId,
      approach,
      method: chosen.method,
      rewards: [...encounter.rewards],
      human: encounter.human,
    };
    this.encounterResults[encounterId] = result;
    this.flags[`ENCOUNTER_${encounterId}_${approach === 'lethal' ? 'LETHAL' : 'NON_LETHAL'}`] = true;
    this.flags[`ENCOUNTER_${encounterId}_METHOD_${chosen.method}`] = true;
    this.recomputeAchievements();

    return {
      ok: true,
      outcome: 'resolved',
      encounterId,
      approach,
      method: chosen.method,
      missing: [],
      rewards: [...encounter.rewards],
      result,
    };
  }

  recordKill(human: boolean): KillLedger {
    if (human) this.killsValue.human += 1;
    else this.killsValue.nonHuman += 1;
    this.recomputeAchievements();
    return cloneKills(this.killsValue);
  }

  get kills(): KillLedger {
    return cloneKills(this.killsValue);
  }

  get humanKills(): number {
    return this.killsValue.human;
  }

  get achievements(): string[] {
    return [...this.achievementSet].sort();
  }

  hasAchievement(id: string): boolean {
    return this.achievementSet.has(id);
  }

  private recomputeAchievements(): void {
    // Shadowhand is the no-human-kill pacifist mark. It is earned the first
    // time a human encounter is spared while the ledger is still clean, and it
    // is sticky: later lethal fights do not retroactively erase the run.
    if (this.killsValue.human === 0 && this.killsValue.spared > 0) {
      this.achievementSet.add('SHADOWHAND');
    }
    if (this.killsValue.spared >= encounters.filter((entry) => entry.human).length) {
      this.achievementSet.add('GHOST_OF_THE_KEEP');
    }
  }

  // ---------------------------------------------------------------- shards

  get memoryShards(): string[] {
    return [...this.shards].sort(
      (a, b) => SHARD_ACHIEVEMENT_ORDER.indexOf(a) - SHARD_ACHIEVEMENT_ORDER.indexOf(b),
    );
  }

  get memoryShardCount(): number {
    return this.shards.size;
  }

  collectShard(id: string): { ok: boolean; shardId: string; first: boolean; count: number } {
    const shardId = SHARD_CANONICAL[id] ?? id;
    const first = !this.shards.has(shardId);
    this.shards.add(shardId);
    this.flags[`SHARD_${shardId}`] = true;
    const itemId = SHARD_ITEM[shardId] ?? shardId;
    this.ctx.inventory.add(itemId);
    return { ok: true, shardId, first, count: this.shards.size };
  }

  // ----------------------------------------------------------------- quests

  completeQuest(id: string): void {
    this.quests.add(id);
    this.flags[`QUEST_${id}_COMPLETE`] = true;
  }

  isQuestComplete(id: string): boolean {
    return this.quests.has(id);
  }

  get completedQuests(): string[] {
    return [...this.quests].sort();
  }

  // ------------------------------------------------------------ steam hazard

  get steamJam(): SteamJamState | null {
    return this.steamJamState ? { ...this.steamJamState } : null;
  }

  get portcullisPassable(): boolean {
    return this.steamJamState?.portcullisHalfOpen ?? true;
  }

  triggerSteamJam(sceneId = 'GH1', x = 0, z = -2): SteamJamState {
    this.flags.EVENT_ORIN_PANIC_STEAM_JAM = true;
    this.steamJamState = {
      active: true,
      sceneId,
      x,
      z,
      radius: 2.4,
      dps: 8,
      portcullisHalfOpen: true,
    };
    return { ...this.steamJamState };
  }

  clearSteamJam(): void {
    if (this.steamJamState) this.steamJamState.active = false;
  }

  hazardDamageAt(sceneId: string, x: number, z: number): number {
    const hazard = this.steamJamState;
    if (!hazard || !hazard.active || hazard.sceneId !== sceneId) return 0;
    const distance = Math.hypot(hazard.x - x, hazard.z - z);
    return distance <= hazard.radius ? hazard.dps : 0;
  }

  // ------------------------------------------------------------- skills/flags

  setSkill(name: string, level: number): number {
    this.skills[name] = Math.max(0, Math.floor(level));
    return this.skills[name];
  }

  learnSkill(name: string, amount = 1): number {
    return this.setSkill(name, (this.skills[name] ?? 0) + amount);
  }

  skillLevel(name: string): number {
    return this.skills[name] ?? 0;
  }

  setFlag(id: string, value: boolean | number): void {
    this.flags[id] = value;
  }

  hasFlag(id: string): boolean {
    return Boolean(this.flags[id]);
  }

  flag(id: string): boolean | number | undefined {
    return this.flags[id];
  }

  get flagsView(): Record<string, boolean | number> {
    return { ...this.flags };
  }

  // --------------------------------------------------------- requirements

  hasItem(id: string): boolean {
    const group = ITEM_ALIAS_GROUPS.find((entries) => entries.includes(id));
    if (group) return group.some((entry) => this.ctx.inventory.has(entry));
    return this.ctx.inventory.has(id);
  }

  missingRequirements(requires: readonly string[]): string[] {
    return requires.filter((requirement) => !this.meets(requirement));
  }

  meets(requirement: string): boolean {
    if (requirement.startsWith('ORIGIN_')) return this.originId === requirement;
    if (requirement.startsWith('ITEM_')) return this.hasItem(requirement);
    if (requirement.startsWith('PUZZLE_')) {
      return this.ctx.solvedPuzzles.has(requirement) || this.solvedPuzzleIds.has(requirement);
    }
    if (requirement.startsWith('ABILITY_')) return this.ctx.abilities.has(requirement);
    if (requirement.startsWith('FLAG_')) return this.hasFlag(requirement.slice('FLAG_'.length));
    if (requirement.startsWith('SKILL_')) {
      const match = /^SKILL_(.+)_(\d+)$/.exec(requirement);
      if (!match) return false;
      return this.skillLevel(match[1]) >= Number(match[2]);
    }
    if (requirement.startsWith('STAT_')) {
      const match = /^STAT_([A-Z]+)_(\d+)$/.exec(requirement);
      if (!match) return false;
      return Number(this.ctx.stats[match[1]] ?? 0) >= Number(match[2]);
    }
    return false;
  }

  // ----------------------------------------------------------- persistence

  serialize(): QuestRuntimeSave {
    return {
      version: 1,
      originId: this.originId,
      traits: [...this.traitIds],
      solvedPuzzles: [...this.solvedPuzzleIds].sort(),
      puzzleMethods: { ...this.puzzleMethods },
      mirrorAngle: this.mirrorAngleValue,
      levers: { ...this.levers },
      flags: { ...this.flags },
      skills: { ...this.skills },
      kills: cloneKills(this.killsValue),
      achievements: this.achievements,
      shards: this.memoryShards,
      quests: this.completedQuests,
      encounters: JSON.parse(JSON.stringify(this.encounterResults)) as Record<string, EncounterResult>,
      steamJam: this.steamJam,
    };
  }

  restore(data: Partial<QuestRuntimeSave> | null | undefined): void {
    if (!data) return;
    if (typeof data.originId === 'string' && data.originId) this.originIdValue = data.originId;
    this.traitIds = Array.isArray(data.traits) ? [...new Set(data.traits)].slice(0, this.maxTraits) : [];
    this.solvedPuzzleIds = new Set(Array.isArray(data.solvedPuzzles) ? data.solvedPuzzles : []);
    this.puzzleMethods = { ...(data.puzzleMethods ?? {}) };
    this.mirrorAngleValue = Number(data.mirrorAngle ?? 0) % 180;
    this.levers = { ...(data.levers ?? {}) };
    this.flags = { ...(data.flags ?? {}) };
    this.skills = { ...(data.skills ?? {}) };
    this.killsValue = {
      human: Number(data.kills?.human ?? 0),
      nonHuman: Number(data.kills?.nonHuman ?? 0),
      spared: Number(data.kills?.spared ?? 0),
    };
    this.achievementSet = new Set(Array.isArray(data.achievements) ? data.achievements : []);
    this.shards = new Set(Array.isArray(data.shards) ? data.shards : []);
    this.quests = new Set(Array.isArray(data.quests) ? data.quests : []);
    this.encounterResults = { ...(data.encounters ?? {}) };
    this.steamJamState = data.steamJam ? { ...data.steamJam } : null;
  }

  reset(): void {
    this.originIdValue = '';
    this.traitIds = [];
    this.solvedPuzzleIds.clear();
    this.puzzleMethods = {};
    this.mirrorAngleValue = 0;
    this.levers = {};
    this.flags = {};
    this.skills = {};
    this.killsValue = emptyKills();
    this.achievementSet.clear();
    this.shards.clear();
    this.quests.clear();
    this.encounterResults = {};
    this.steamJamState = null;
  }
}
