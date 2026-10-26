/**
 * Deterministic full-game autoplay controller.
 *
 * The controller is the "brain stem" of the hands-free bot: it owns the mode,
 * lifecycle, speed, stuck watchdog and status reporting, and drives the game
 * through a narrow `AutoplayHost` interface so the same logic can be unit
 * tested without a browser.
 *
 * Low-level movement still goes through the proven A* grid pathfinder in
 * `autobattler/Pathfinder.ts`; combat, dialogue and interaction are delegated
 * to the host, which maps them onto the real game systems.
 *
 * Contract (also exposed at `window.__veilkeep.autoplay`):
 *
 *   start({ mode, speedMultiplier })
 *   stop() / pause() / resume()
 *   stepToScene(sceneId) / solveCurrentRoom()
 *   getStatus() -> { running, currentGoal, visitedScenes, solvedPuzzles,
 *                    completedQuests, stuckTicks, lastError }
 *   bugsFound -> AutoplayBug[]
 */

import {
  CAMPAIGN_ORDER,
  SCENE_PLANS,
  taskDone,
  taskReady,
  type AutoProgressState,
  type AutoTask,
} from '../autobattler/Campaign';
import { DEFAULT_BOUNDS, doorApproachPoint, findPath, type Bounds, type ObstacleRect, type Point } from '../autobattler/Pathfinder';

// ---------------------------------------------------------------- public API

export type AutoplayMode = 'mvp_slice' | 'full_campaign' | 'pacifist_shadowhand' | 'all_quests';

export interface AutoplayOptions {
  mode?: AutoplayMode;
  speedMultiplier?: number;
}

export interface AutoplayStatus {
  running: boolean;
  currentGoal: string | null;
  visitedScenes: string[];
  solvedPuzzles: string[];
  completedQuests: string[];
  stuckTicks: number;
  lastError: string | null;
}

export interface AutoplayBug {
  id: string;
  severity: 'P1';
  area: 'Navigation/Collider Bug';
  scene: string;
  position: { x: number; y: number; z: number };
  goal: string | null;
  stuckTicks: number;
  detectedAt: string;
  detail: string;
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Everything the controller needs from the game. Implemented once in `main.ts`;
 * faked wholesale in the unit tests.
 */
export interface AutoplayHost {
  getSceneId(): string;
  getPosition(): Vec3Like;
  getState(): AutoProgressState;
  getObstacles(): readonly ObstacleRect[];

  /** BFS route through the door graph, honouring story gates. */
  planRoute(from: string, to: string): string[] | null;
  doorAt(sceneId: string, to: string): { x: number; z: number } | null;
  sceneExists(sceneId: string): boolean;

  setInput(x: number, z: number): void;
  /** A* navigation; returns true once within `arriveRadius`. */
  navigate(x: number, z: number, arriveRadius: number, dt: number): boolean;
  interact(): void;
  attack(): void;

  nearestGuard(): { x: number; z: number; distance: number } | null;
  hasDialogue(): boolean;
  advanceDialogue(dt: number): void;

  /** Fire a traversal brand (wall leap, air dash, ...). False if unavailable. */
  castMovementBrand(brand: string): boolean;

  isEndingOpen(): boolean;
  showEnding(): void;
  /** Dismiss the finale so a fresh autoplay run can start cleanly. */
  closeEnding(): void;
  markCleared(sceneId: string): void;
  /** Record that the bot has physically entered this room. */
  markVisited(sceneId: string): void;

  /** Capsule sweep between two points; false when the segment is obstructed. */
  probeClearance(from: Vec3Like, to: Vec3Like): boolean;

  /** Drop the current path and slide sideways for a moment. */
  nudge(): void;
  getBounds?(): Bounds;
  setSpeedMultiplier(multiplier: number): void;
  toast(message: string): void;
  questState(): { active: string[]; completed: string[]; total: number };
}

// ----------------------------------------------------------------- constants

/** The opening slice chain named in the Phase-2 brief. */
export const MVP_ORDER: readonly string[] = ['S00', 'OW1', 'GH1', 'GH2', 'GH3', 'SQ1'];

/**
 * Traversal brands in the order the bot tries them when a straight path is
 * blocked. The host decides whether the brand is owned and whether the current
 * room actually responds to it.
 */
export const MOVEMENT_BRANDS: readonly string[] = [
  'ABILITY_WALL_LEAP',
  'ABILITY_AIR_DASH',
  'ABILITY_GRAV_INVERSION',
  'ABILITY_MIRROR_PHASE',
  'ABILITY_STARLIGHT_DASH',
];

/** Consecutive ticks of sub-5cm travel before the watchdog files a P1. */
export const STUCK_TICK_LIMIT = 90;
/** Displacement that counts as "actually moved" across the watchdog window. */
export const STUCK_EPSILON_METERS = 0.05;

const MODES: readonly AutoplayMode[] = ['mvp_slice', 'full_campaign', 'pacifist_shadowhand', 'all_quests'];
const MAX_SPEED_MULTIPLIER = 8;

const distance = (a: Vec3Like, b: Vec3Like): number => Math.hypot(a.x - b.x, a.z - b.z);

// ------------------------------------------------------------------ controller

export class AutoplayController {
  private readonly host: AutoplayHost;

  private isRunning = false;
  private isPaused = false;
  private isFinished = false;
  private mode: AutoplayMode = 'full_campaign';
  private speedMultiplier = 1;

  /** Scene the operator explicitly asked for via `stepToScene`. */
  private forcedScene: string | null = null;
  /** Scene pinned by `solveCurrentRoom`; the bot will not leave until it is done. */
  private focusScene: string | null = null;

  private currentGoal: string | null = null;
  private lastError: string | null = null;

  private windowStart: Vec3Like | null = null;
  private windowTicks = 0;
  private stuckTicksTotal = 0;

  private readonly skippedTasks = new Set<string>();
  private readonly bugs: AutoplayBug[] = [];
  private readonly bugKeys = new Set<string>();
  private readonly brandLog: { scene: string; brand: string; at: number }[] = [];

  private actionTimer = 0;
  private ticks = 0;

  constructor(host: AutoplayHost) {
    this.host = host;
  }

  // ------------------------------------------------------------- lifecycle

  start(options: AutoplayOptions = {}): boolean {
    const mode = options.mode ?? 'full_campaign';
    if (!MODES.includes(mode)) {
      this.lastError = `bad-mode:${String(mode)}`;
      return false;
    }
    const rawSpeed = options.speedMultiplier ?? 1;
    const speed = Number.isFinite(rawSpeed) ? Math.min(MAX_SPEED_MULTIPLIER, Math.max(1, rawSpeed)) : 1;

    this.mode = mode;
    this.speedMultiplier = speed;
    this.isRunning = true;
    this.isPaused = false;
    this.isFinished = false;
    if (this.host.isEndingOpen()) this.host.closeEnding();
    this.forcedScene = null;
    this.focusScene = null;
    this.currentGoal = null;
    this.lastError = null;
    this.windowStart = this.host.getPosition();
    this.windowTicks = 0;
    this.stuckTicksTotal = 0;
    this.skippedTasks.clear();
    this.brandLog.length = 0;
    this.actionTimer = 0;
    this.ticks = 0;
    this.host.setSpeedMultiplier(speed);
    this.host.toast(`Autoplay engaged — ${mode.replace(/_/g, ' ')} at ${speed}x.`);
    return true;
  }

  stop(): void {
    if (!this.isRunning && !this.isPaused) return;
    this.isRunning = false;
    this.isPaused = false;
    this.currentGoal = null;
    this.forcedScene = null;
    this.focusScene = null;
    this.host.setInput(0, 0);
    this.host.setSpeedMultiplier(1);
    this.host.toast('Autoplay disengaged — manual control restored.');
  }

  pause(): boolean {
    if (!this.isRunning || this.isPaused) return false;
    this.isPaused = true;
    this.host.setInput(0, 0);
    return true;
  }

  resume(): boolean {
    if (!this.isRunning || !this.isPaused) return false;
    this.isPaused = false;
    this.windowStart = this.host.getPosition();
    this.windowTicks = 0;
    return true;
  }

  /** Route to a specific room. Returns false for unknown scene ids. */
  stepToScene(sceneId: string): boolean {
    if (!this.host.sceneExists(sceneId)) {
      this.lastError = `unknown-scene:${sceneId}`;
      return false;
    }
    this.forcedScene = sceneId;
    this.focusScene = null;
    this.lastError = null;
    if (!this.isRunning) this.start({ mode: this.mode, speedMultiplier: this.speedMultiplier });
    return true;
  }

  /** Pin the bot to the current room until every task in it is resolved. */
  solveCurrentRoom(): boolean {
    const scene = this.host.getSceneId();
    if (!SCENE_PLANS[scene]) return false;
    this.focusScene = scene;
    this.forcedScene = null;
    if (!this.isRunning) this.start({ mode: this.mode, speedMultiplier: this.speedMultiplier });
    return true;
  }

  // ------------------------------------------------------------------ status

  getStatus(): AutoplayStatus {
    const state = this.host.getState();
    return {
      running: this.isRunning,
      currentGoal: this.currentGoal,
      visitedScenes: [...state.visited],
      solvedPuzzles: [...state.solvedPuzzles],
      completedQuests: this.host.questState().completed,
      stuckTicks: this.windowTicks,
      lastError: this.lastError,
    };
  }

  get bugsFound(): AutoplayBug[] {
    return [...this.bugs];
  }

  get paused(): boolean {
    return this.isPaused;
  }

  get running(): boolean {
    return this.isRunning;
  }

  get finished(): boolean {
    return this.isFinished;
  }

  get modeName(): AutoplayMode {
    return this.mode;
  }

  get speed(): number {
    return this.speedMultiplier;
  }

  get brandsUsed(): { scene: string; brand: string; at: number }[] {
    return [...this.brandLog];
  }

  // -------------------------------------------------------------------- tick

  tick(dt: number): void {
    if (!this.isRunning || this.isPaused || dt <= 0) return;
    this.ticks++;

    if (this.host.isEndingOpen()) {
      this.finish('ending already open');
      return;
    }
    if (this.host.hasDialogue()) {
      this.sampleWatchdog(false);
      this.host.advanceDialogue(dt * this.speedMultiplier);
      return;
    }

    const scene = this.host.getSceneId();
    const state = this.host.getState();
    this.host.markVisited(scene);
    const guard = this.host.nearestGuard();
    const pacifist = this.mode === 'pacifist_shadowhand';

    // A room is "cleared" for campaign purposes once nothing hostile remains.
    if (!guard) this.host.markCleared(scene);

    const pending = this.selectTask(scene, state);

    // Combat outranks chores, except in ghost mode where guards are evaded.
    if (guard && !pacifist && (pending?.kind === 'clear' || guard.distance < 3.4)) {
      this.currentGoal = pending?.kind === 'clear' ? pending.id : `guard:${scene}`;
      this.combat(guard, dt);
      return;
    }

    if (pending) {
      this.currentGoal = pending.id;
      this.runTask(pending, state, dt);
      return;
    }

    this.travel(state, dt);
  }

  // ------------------------------------------------------------------ tasks

  /**
   * First unfinished task in the room. `pacifist_shadowhand` treats lethal
   * clear-tasks as satisfied by evasion, so the run never raises a blade.
   */
  private selectTask(scene: string, state: AutoProgressState): AutoTask | null {
    const plan = SCENE_PLANS[scene];
    if (!plan) return null;
    for (const task of plan.tasks) {
      if (taskDone(task, scene, state)) continue;
      if (this.mode === 'pacifist_shadowhand' && task.kind === 'clear') {
        this.skippedTasks.add(task.id);
        continue;
      }
      if (this.skippedTasks.has(task.id)) continue;
      return task;
    }
    return null;
  }

  private runTask(task: AutoTask, state: AutoProgressState, dt: number): void {
    if (!taskReady(task, state)) {
      this.lastError = `blocked:${task.id}`;
      this.idle();
      return;
    }
    if (task.kind === 'clear') {
      this.host.markCleared(this.host.getSceneId());
      return;
    }
    if (typeof task.x !== 'number' || typeof task.z !== 'number') {
      this.lastError = `no-position:${task.id}`;
      this.idle();
      return;
    }

    if (!this.ensureReachable(task.x, task.z)) return;

    const arrived = this.host.navigate(task.x, task.z, 0.6, dt);
    this.sampleWatchdog(!arrived);
    if (!arrived) return;
    this.lastError = null;

    this.idle();
    this.actionTimer -= dt * this.speedMultiplier;
    if (this.actionTimer <= 0) {
      this.actionTimer = 0.55;
      this.host.interact();
    }
  }

  private combat(guard: { x: number; z: number; distance: number }, dt: number): void {
    this.sampleWatchdog(true);
    if (guard.distance > 1.15) {
      this.host.navigate(guard.x, guard.z, 1.0, dt);
      return;
    }
    this.idle();
    this.actionTimer -= dt * this.speedMultiplier;
    if (guard.distance <= 1.55 && this.actionTimer <= 0) {
      this.actionTimer = 0.42;
      this.host.attack();
    }
  }

  // ----------------------------------------------------------------- travel

  private travel(state: AutoProgressState, dt: number): void {
    const scene = this.host.getSceneId();

    // Release pins before choosing a destination, so finishing a room does not
    // look like "standing on the goal" and end the run early.
    if (this.focusScene && this.planDone(this.focusScene, state)) this.focusScene = null;
    if (this.forcedScene === scene) this.forcedScene = null;

    const destination = this.forcedScene ?? this.focusScene ?? this.nextGoalScene(state);
    if (!destination) {
      this.finish('all campaign work complete');
      return;
    }
    if (destination === scene) {
      // Pinned to this room with nothing left to do in it.
      this.currentGoal = scene;
      this.idle();
      return;
    }

    this.currentGoal = destination;
    const route = this.host.planRoute(scene, destination);
    if (!route || route.length < 2) {
      this.lastError = `no-route:${scene}->${destination}`;
      this.idle();
      return;
    }
    const nextScene = route[1];
    const door = this.host.doorAt(scene, nextScene);
    if (!door) {
      this.lastError = `no-door:${scene}->${nextScene}`;
      this.idle();
      return;
    }

    const approach = doorApproachPoint(door, { x: 0, z: 0 }, 0.8);
    if (!this.ensureReachable(approach.x, approach.z)) return;

    const arrived = this.host.navigate(approach.x, approach.z, 0.22, dt);
    this.sampleWatchdog(!arrived);
    if (arrived) {
      this.lastError = null;
      // Door triggers sit inside the wall collider; nudge into it directly.
      this.host.navigate(door.x, door.z, 0.1, dt);
    }
  }

  // ------------------------------------------------------------------ goals

  private allowedOrder(): readonly string[] {
    return this.mode === 'mvp_slice' ? MVP_ORDER : CAMPAIGN_ORDER;
  }

  private planDone(scene: string, state: AutoProgressState): boolean {
    const plan = SCENE_PLANS[scene];
    if (!plan) return true;
    return plan.tasks.every((task) => taskDone(task, scene, state) || this.skippedTasks.has(task.id));
  }

  private nextGoalScene(state: AutoProgressState): string | null {
    for (const sceneId of this.allowedOrder()) {
      if (!state.visited.has(sceneId)) return sceneId;
      if (!this.planDone(sceneId, state)) return sceneId;
    }
    return null;
  }

  /** `all_quests` keeps hunting until the journal itself is empty. */
  private questsOutstanding(): number {
    return this.host.questState().active.length;
  }

  private finish(reason: string): void {
    if (this.isFinished) return;
    this.isFinished = true;
    this.isRunning = false;
    this.currentGoal = null;
    this.host.setInput(0, 0);
    this.host.setSpeedMultiplier(1);
    if (this.mode === 'all_quests' && this.questsOutstanding() > 0) {
      this.lastError = `quests-remaining:${this.questsOutstanding()}`;
    }
    if (!this.host.isEndingOpen()) this.host.showEnding();
    this.host.toast(`Autoplay complete — ${reason}.`);
  }

  // --------------------------------------------------------- traversal brands

  /**
   * Returns false when the target is unreachable on foot and no owned traversal
   * brand opens the way. Attempting a brand counts as progress for one tick.
   */
  private ensureReachable(x: number, z: number): boolean {
    const from = this.host.getPosition();
    const target: Point = { x, z };
    if (Math.hypot(x - from.x, z - from.z) <= 0.35) return true;

    const bounds = this.host.getBounds?.() ?? DEFAULT_BOUNDS;
    const path = findPath({ x: from.x, z: from.z }, target, this.host.getObstacles(), bounds);
    if (path.length > 0) return true;

    // No walkable route: a ledge, chasm, gravity rune or portcullis is in the way.
    if (this.tryMovementBrand(target)) return true;

    this.lastError = `unreachable:${x.toFixed(2)},${z.toFixed(2)}`;
    this.idle();
    return false;
  }

  private tryMovementBrand(target: Point): boolean {
    const abilities = this.host.getState().abilities;
    for (const brand of MOVEMENT_BRANDS) {
      if (!abilities.has(brand)) continue;
      if (!this.host.castMovementBrand(brand)) continue;
      this.brandLog.push({ scene: this.host.getSceneId(), brand, at: this.ticks });
      return true;
    }
    void target;
    return false;
  }

  // --------------------------------------------------------------- watchdog

  /**
   * Files a P1 when the capsule travels less than 5 cm across 90 consecutive
   * ticks while the bot is actively steering somewhere.
   */
  private sampleWatchdog(moving: boolean): void {
    const position = this.host.getPosition();
    if (!moving) {
      this.windowStart = position;
      this.windowTicks = 0;
      return;
    }
    if (!this.windowStart) {
      this.windowStart = position;
      this.windowTicks = 0;
      return;
    }
    if (distance(position, this.windowStart) >= STUCK_EPSILON_METERS) {
      this.windowStart = position;
      this.windowTicks = 0;
      return;
    }
    this.windowTicks++;
    if (this.windowTicks < STUCK_TICK_LIMIT) return;

    this.recordStuckBug(position);
    this.windowStart = position;
    this.windowTicks = 0;
  }

  private recordStuckBug(position: Vec3Like): void {
    this.stuckTicksTotal++;
    const scene = this.host.getSceneId();
    const goal = this.currentGoal;
    const key = `${scene}:${position.x.toFixed(1)}:${position.z.toFixed(1)}:${goal ?? '-'}`;
    // Re-path regardless of whether this spot was already reported.
    this.host.nudge();
    if (this.bugKeys.has(key)) return;
    this.bugKeys.add(key);

    const bug: AutoplayBug = {
      id: `VK-P1-NAV-${String(this.bugs.length + 1).padStart(3, '0')}`,
      severity: 'P1',
      area: 'Navigation/Collider Bug',
      scene,
      position: {
        x: Number(position.x.toFixed(3)),
        y: Number(position.y.toFixed(3)),
        z: Number(position.z.toFixed(3)),
      },
      goal,
      stuckTicks: STUCK_TICK_LIMIT,
      detectedAt: new Date().toISOString(),
      detail: `Capsule moved < ${STUCK_EPSILON_METERS}m over ${STUCK_TICK_LIMIT} ticks while steering toward ${goal ?? 'travel'}.`,
    };
    this.bugs.push(bug);
    this.lastError = `stuck:${scene}@${bug.position.x},${bug.position.y},${bug.position.z}`;
  }

  // ----------------------------------------------------------------- helpers

  private idle(): void {
    this.host.setInput(0, 0);
  }

  /** Exposed for the HUD: how many watchdog trips have happened this run. */
  get stuckEvents(): number {
    return this.stuckTicksTotal;
  }

  get tickCount(): number {
    return this.ticks;
  }

}
