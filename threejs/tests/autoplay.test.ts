import { describe, expect, it } from 'vitest';

import {
  AutoplayController,
  MVP_ORDER,
  STUCK_TICK_LIMIT,
  type AutoplayHost,
} from '../src/systems/AutoplayController';
import { CAMPAIGN_ORDER, SCENE_PLANS, type AutoProgressState } from '../src/autobattler/Campaign';
import { DEFAULT_BOUNDS, findPath, type ObstacleRect } from '../src/autobattler/Pathfinder';

/**
 * A scripted stand-in for the game. It models just enough of the fortress to
 * exercise the controller: a position that only moves when the bot "walks",
 * a door graph, and a task list per room.
 */
class FakeHost implements AutoplayHost {
  scene = 'S00';
  position = { x: 0, y: 0.6, z: 0 };
  inventory = new Set<string>();
  solvedPuzzles = new Set<string>();
  abilities = new Set<string>();
  visited = new Set<string>(['S00']);
  cleared = new Set<string>();
  flags = new Set<string>();
  obstacles: ObstacleRect[] = [];

  guards: Record<string, { x: number; z: number }[]> = {};
  dialogue = false;
  endingOpen = false;
  endingShown = false;
  speed = 1;
  toasts: string[] = [];
  nudges = 0;
  interactions = 0;
  attacks = 0;
  brands: string[] = [];
  blocked = false;

  getSceneId(): string {
    return this.scene;
  }

  getPosition() {
    return { ...this.position };
  }

  getState(): AutoProgressState {
    return {
      inventory: this.inventory,
      solvedPuzzles: this.solvedPuzzles,
      abilities: this.abilities,
      visited: this.visited,
      cleared: this.cleared,
      flags: this.flags,
    };
  }

  getObstacles(): readonly ObstacleRect[] {
    return this.obstacles;
  }

  planRoute(from: string, to: string): string[] | null {
    // Simple linear walk over the campaign order.
    const order = [...CAMPAIGN_ORDER];
    const a = order.indexOf(from);
    const b = order.indexOf(to);
    if (a < 0 || b < 0) return null;
    return a <= b ? order.slice(a, b + 1) : [from, to];
  }

  doorAt(sceneId: string, to: string) {
    void sceneId;
    if (!CAMPAIGN_ORDER.includes(to)) return null;
    return { x: 0, z: -4 };
  }

  sceneExists(sceneId: string): boolean {
    return CAMPAIGN_ORDER.includes(sceneId);
  }

  setInput(x: number, z: number): void {
    if (x === 0 && z === 0) return;
    if (this.blocked) return; // simulates a capsule wedged on a collider
    this.position = { x: this.position.x + x * 0.1, y: 0.6, z: this.position.z + z * 0.1 };
  }

  navigate(x: number, z: number, arriveRadius: number): boolean {
    const dx = x - this.position.x;
    const dz = z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= arriveRadius) return true;
    this.setInput(dx / dist, dz / dist);
    return false;
  }

  interact(): void {
    this.interactions++;
  }

  attack(): void {
    this.attacks++;
  }

  nearestGuard() {
    const list = this.guards[this.scene] ?? [];
    if (list.length === 0) return null;
    const g = list[0];
    return { x: g.x, z: g.z, distance: Math.hypot(g.x - this.position.x, g.z - this.position.z) };
  }

  hasDialogue(): boolean {
    return this.dialogue;
  }

  advanceDialogue(): void {
    this.dialogue = false;
  }

  castMovementBrand(brand: string): boolean {
    if (!this.abilities.has(brand)) return false;
    this.brands.push(brand);
    return true;
  }

  isEndingOpen(): boolean {
    return this.endingOpen;
  }

  showEnding(): void {
    this.endingShown = true;
    this.endingOpen = true;
  }

  closeEnding(): void {
    this.endingOpen = false;
  }

  markCleared(sceneId: string): void {
    this.cleared.add(sceneId);
  }

  markVisited(sceneId: string): void {
    this.visited.add(sceneId);
  }

  probeClearance(): boolean {
    return true;
  }

  nudge(): void {
    this.nudges++;
  }

  setSpeedMultiplier(multiplier: number): void {
    this.speed = multiplier;
  }

  toast(message: string): void {
    this.toasts.push(message);
  }

  questState() {
    const completed = [...this.solvedPuzzles];
    return { active: [], completed, total: 28 };
  }

  /** Marks every task in a room complete, to drive the bot past it. */
  finishRoom(sceneId: string): void {
    const plan = SCENE_PLANS[sceneId];
    if (!plan) return;
    for (const task of plan.tasks) {
      if (task.kind === 'clear') this.cleared.add(sceneId);
      if (task.kind === 'collect' && task.item) this.inventory.add(task.item);
      if (task.kind === 'solve' && task.puzzle) this.solvedPuzzles.add(task.puzzle);
      if (task.kind === 'talk' && task.npc) {
        this.flags.add(`talk:${task.npc}`);
        for (const grant of task.grantsAny ?? []) {
          if (grant.startsWith('ITEM_')) this.inventory.add(grant);
          if (grant.startsWith('PUZZLE_')) this.solvedPuzzles.add(grant);
          if (grant.startsWith('ABILITY_')) this.abilities.add(grant);
        }
      }
    }
  }
}

const runTicks = (controller: AutoplayController, count: number, dt = 1 / 60): void => {
  for (let i = 0; i < count; i++) controller.tick(dt);
};

describe('AutoplayController — lifecycle', () => {
  it('starts, reports status, pauses and resumes', () => {
    const host = new FakeHost();
    const controller = new AutoplayController(host);

    expect(controller.running).toBe(false);
    expect(controller.start({ mode: 'full_campaign', speedMultiplier: 4 })).toBe(true);
    expect(controller.running).toBe(true);
    expect(controller.speed).toBe(4);
    expect(host.speed).toBe(4);

    const status = controller.getStatus();
    expect(Object.keys(status).sort()).toEqual([
      'completedQuests',
      'currentGoal',
      'lastError',
      'running',
      'solvedPuzzles',
      'stuckTicks',
      'visitedScenes',
    ]);
    expect(status.running).toBe(true);

    expect(controller.pause()).toBe(true);
    expect(controller.paused).toBe(true);
    expect(host.speed).toBe(4);
    expect(controller.resume()).toBe(true);
    expect(controller.paused).toBe(false);

    controller.stop();
    expect(controller.running).toBe(false);
    expect(host.speed).toBe(1);
  });

  it('rejects an unknown mode and clamps the speed multiplier', () => {
    const host = new FakeHost();
    const controller = new AutoplayController(host);
    expect(controller.start({ mode: 'nonsense' as never })).toBe(false);
    expect(controller.running).toBe(false);

    controller.start({ mode: 'mvp_slice', speedMultiplier: 99 });
    expect(controller.speed).toBe(8);
  });

  it('does not tick while paused', () => {
    const host = new FakeHost();
    const controller = new AutoplayController(host);
    controller.start({ mode: 'full_campaign' });
    controller.pause();
    const before = host.interactions;
    runTicks(controller, 120);
    expect(host.interactions).toBe(before);
  });

  it('scales interaction cadence with speedMultiplier', () => {
    // Park both bots on S00's only task so arrival is instant and the only
    // remaining cost is the interact timer.
    const at = { x: -2.5, y: 0.6, z: -4.8 };
    const slowHost = new FakeHost();
    slowHost.position = { ...at };
    const slow = new AutoplayController(slowHost);
    slow.start({ mode: 'full_campaign', speedMultiplier: 1 });
    runTicks(slow, 120);

    const fastHost = new FakeHost();
    fastHost.position = { ...at };
    const fast = new AutoplayController(fastHost);
    fast.start({ mode: 'full_campaign', speedMultiplier: 8 });
    runTicks(fast, 120);

    expect(slowHost.interactions).toBeGreaterThan(0);
    // 8x must actually shorten wall-clock work, not just travel.
    expect(fastHost.interactions).toBeGreaterThan(slowHost.interactions * 3);
  });
});

describe('AutoplayController — navigation', () => {
  it('validates stepToScene targets', () => {
    const host = new FakeHost();
    const controller = new AutoplayController(host);
    expect(controller.stepToScene('NOT_A_ROOM')).toBe(false);
    expect(controller.getStatus().lastError).toContain('unknown-scene');
    expect(controller.stepToScene('GH2')).toBe(true);
    expect(controller.running).toBe(true);
  });

  it('walks toward the current room task', () => {
    const host = new FakeHost();
    const controller = new AutoplayController(host);
    controller.start({ mode: 'full_campaign' });
    const startZ = host.position.z;
    runTicks(controller, 30);
    // S00's first task is a pickup to the north-west; the bot must move.
    expect(Math.hypot(host.position.x, host.position.z - startZ)).toBeGreaterThan(0);
  });

  it('uses a traversal brand when no walkable path exists', () => {
    const host = new FakeHost();
    // A wall of boxes boxing the player in, with the target outside it.
    host.obstacles = [
      { x: 0, z: 1.2, hx: 6, hz: 0.4 },
      { x: 0, z: -1.2, hx: 6, hz: 0.4 },
      { x: 1.2, z: 0, hx: 0.4, hz: 6 },
      { x: -1.2, z: 0, hx: 0.4, hz: 6 },
    ];
    host.abilities.add('ABILITY_MIRROR_PHASE');
    const controller = new AutoplayController(host);
    controller.start({ mode: 'full_campaign' });
    runTicks(controller, 30);
    expect(host.brands).toContain('ABILITY_MIRROR_PHASE');
  });
});

describe('AutoplayController — stuck watchdog', () => {
  it('files a P1 bug with exact coordinates after 90 blocked ticks', () => {
    const host = new FakeHost();
    host.blocked = true;
    const controller = new AutoplayController(host);
    controller.start({ mode: 'full_campaign' });

    runTicks(controller, STUCK_TICK_LIMIT + 5);

    const bugs = controller.bugsFound;
    expect(bugs.length).toBe(1);
    expect(bugs[0].severity).toBe('P1');
    expect(bugs[0].area).toBe('Navigation/Collider Bug');
    expect(bugs[0].scene).toBe('S00');
    expect(bugs[0].position).toEqual({ x: 0, y: 0.6, z: 0 });
    expect(bugs[0].stuckTicks).toBe(STUCK_TICK_LIMIT);
    expect(host.nudges).toBeGreaterThan(0);
    expect(controller.getStatus().lastError).toContain('stuck:S00@0,0.6,0');
  });

  it('does not report while the capsule is actually moving', () => {
    const host = new FakeHost();
    const controller = new AutoplayController(host);
    controller.start({ mode: 'full_campaign' });
    runTicks(controller, STUCK_TICK_LIMIT * 2);
    expect(controller.bugsFound).toHaveLength(0);
  });

  it('deduplicates repeated stalls at the same coordinates', () => {
    const host = new FakeHost();
    host.blocked = true;
    const controller = new AutoplayController(host);
    controller.start({ mode: 'full_campaign' });
    runTicks(controller, STUCK_TICK_LIMIT * 3);
    expect(controller.bugsFound).toHaveLength(1);
    expect(controller.stuckEvents).toBeGreaterThan(1);
  });
});

describe('AutoplayController — modes', () => {
  it('mvp_slice only visits the opening chain', () => {
    const host = new FakeHost();
    const controller = new AutoplayController(host);
    controller.start({ mode: 'mvp_slice' });
    expect(MVP_ORDER).toEqual(['S00', 'OW1', 'GH1', 'GH2', 'GH3', 'SQ1']);
    // Visiting S00 is enough to start; the goal must be inside the slice.
    runTicks(controller, 10);
    const goal = controller.getStatus().currentGoal;
    expect(goal === null || MVP_ORDER.includes(goal) || goal.startsWith('s00:')).toBe(true);
  });

  it('pacifist_shadowhand never attacks and still advances', () => {
    const host = new FakeHost();
    host.guards.S00 = [{ x: 0, z: -2 }];
    const controller = new AutoplayController(host);
    controller.start({ mode: 'pacifist_shadowhand' });
    runTicks(controller, 200);
    expect(host.attacks).toBe(0);
  });

  it('finishes when the campaign is complete', () => {
    const host = new FakeHost();
    for (const scene of CAMPAIGN_ORDER) host.visited.add(scene);
    for (const scene of CAMPAIGN_ORDER) host.finishRoom(scene);
    const controller = new AutoplayController(host);
    controller.start({ mode: 'full_campaign' });
    runTicks(controller, 5);
    expect(controller.finished).toBe(true);
    expect(host.endingShown).toBe(true);
    expect(controller.getStatus().running).toBe(false);
  });

  it('solveCurrentRoom pins the bot to the room', () => {
    const host = new FakeHost();
    const controller = new AutoplayController(host);
    expect(controller.solveCurrentRoom()).toBe(true);
    expect(controller.running).toBe(true);
    // The goal must remain a task in S00, not a travel destination.
    runTicks(controller, 5);
    const goal = controller.getStatus().currentGoal;
    expect(goal === null || goal.startsWith('s00:')).toBe(true);
  });
});

describe('AutoplayController — dialogue and combat', () => {
  it('advances dialogue instead of walking', () => {
    const host = new FakeHost();
    host.dialogue = true;
    const controller = new AutoplayController(host);
    controller.start({ mode: 'full_campaign' });
    const before = host.position;
    controller.tick(1 / 60);
    expect(host.dialogue).toBe(false);
    expect(host.position).toEqual(before);
  });

  it('attacks a guard inside melee range', () => {
    const host = new FakeHost();
    host.guards.S00 = [{ x: 0.4, z: 0 }];
    const controller = new AutoplayController(host);
    controller.start({ mode: 'full_campaign' });
    runTicks(controller, 120);
    expect(host.attacks).toBeGreaterThan(0);
  });

  it('recovers from a Failing Forward dialogue that alerts the guards', () => {
    // Mirrors the ORIN_BLUFF branch: a failed skill check closes the dialogue
    // and jams the steam vents, which spawns/alert a guard.
    const host = new FakeHost();
    host.dialogue = true;
    host.advanceDialogue = () => {
      host.dialogue = false;
      host.guards.S00 = [{ x: 0.5, z: 0 }];
    };
    const controller = new AutoplayController(host);
    controller.start({ mode: 'full_campaign' });

    controller.tick(1 / 60); // consume the dialogue -> guards alerted
    expect(host.guards.S00).toHaveLength(1);
    runTicks(controller, 60);

    expect(host.attacks).toBeGreaterThan(0);
    expect(controller.running).toBe(true);
    expect(controller.bugsFound).toHaveLength(0);
  });

  it('evades the alerted guards instead of drawing a blade in ghost mode', () => {
    const host = new FakeHost();
    host.dialogue = true;
    host.advanceDialogue = () => {
      host.dialogue = false;
      host.guards.S00 = [{ x: 0.5, z: 0 }];
    };
    const controller = new AutoplayController(host);
    controller.start({ mode: 'pacifist_shadowhand' });

    controller.tick(1 / 60);
    runTicks(controller, 180);

    expect(host.attacks).toBe(0);
    expect(controller.running).toBe(true);
  });
});

describe('Pathfinder contract used by the controller', () => {
  it('routes around a wall instead of through it', () => {
    const obstacles: ObstacleRect[] = [{ x: 0, z: 0, hx: 1.4, hz: 0.3 }];
    const path = findPath({ x: 0, z: -2 }, { x: 0, z: 2 }, obstacles, DEFAULT_BOUNDS);
    expect(path.length).toBeGreaterThan(0);
    for (const point of path) {
      const insideWall = Math.abs(point.x) <= 1.4 + 0.48 && Math.abs(point.z) <= 0.3 + 0.48;
      expect(insideWall).toBe(false);
    }
  });

  it('returns an empty path when fully enclosed', () => {
    const obstacles: ObstacleRect[] = [
      { x: 0, z: 1.2, hx: 6, hz: 0.4 },
      { x: 0, z: -1.2, hx: 6, hz: 0.4 },
      { x: 1.2, z: 0, hx: 0.4, hz: 6 },
      { x: -1.2, z: 0, hx: 0.4, hz: 6 },
    ];
    expect(findPath({ x: 0, z: 0 }, { x: 4, z: 4 }, obstacles, DEFAULT_BOUNDS)).toHaveLength(0);
  });
});
