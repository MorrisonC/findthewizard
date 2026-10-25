import { describe, it, expect } from 'vitest';
import {
  CAMPAIGN_ORDER,
  SCENE_PLANS,
  TOTAL_TASKS,
  completedTaskCount,
  nextGoal,
  nextPendingTask,
  planRoute,
  scenePlanDone,
  taskDone,
  type AutoProgressState,
} from '../src/autobattler/Campaign';
import { FORTRESS_EXITS, doorRequirementsMet } from '../src/data/doorGraph';
import { findPath, hasLineOfSight, isBlockedAt, doorApproachPoint, type ObstacleRect } from '../src/autobattler/Pathfinder';
import manifest from '../src/data/world_manifest.json';

const sceneIds = (manifest.mvpVerticalSliceScenes as { id: string }[]).map((s) => s.id);

function emptyState(): AutoProgressState {
  return {
    inventory: new Set<string>(),
    solvedPuzzles: new Set<string>(),
    abilities: new Set<string>(),
    visited: new Set<string>(['S00']),
    cleared: new Set<string>(),
    flags: new Set<string>(),
  };
}

function mutable(state: AutoProgressState): {
  inventory: Set<string>;
  solvedPuzzles: Set<string>;
  abilities: Set<string>;
  visited: Set<string>;
  cleared: Set<string>;
  flags: Set<string>;
} {
  return state as unknown as {
    inventory: Set<string>;
    solvedPuzzles: Set<string>;
    abilities: Set<string>;
    visited: Set<string>;
    cleared: Set<string>;
    flags: Set<string>;
  };
}

/** Applies the rewards a task is expected to hand over when completed. */
function applyTaskReward(sceneId: string, task: (typeof SCENE_PLANS)[string]['tasks'][number], state: AutoProgressState): void {
  const s = mutable(state);
  if (task.kind === 'clear') s.cleared.add(sceneId);
  if (task.kind === 'collect' && task.item) s.inventory.add(task.item);
  if (task.kind === 'solve' && task.puzzle) s.solvedPuzzles.add(task.puzzle);
  if (task.kind === 'talk') {
    s.flags.add(`talk:${task.npc}`);
    for (const grant of task.grantsAny ?? []) {
      if (grant.startsWith('ITEM_')) s.inventory.add(grant);
      else if (grant.startsWith('PUZZLE_')) s.solvedPuzzles.add(grant);
      else if (grant.startsWith('ABILITY_')) s.abilities.add(grant);
    }
  }
  for (const grant of task.grants ?? []) {
    if (grant.startsWith('ITEM_')) s.inventory.add(grant);
    else if (grant.startsWith('PUZZLE_')) s.solvedPuzzles.add(grant);
    else if (grant.startsWith('ABILITY_')) s.abilities.add(grant);
  }
}

describe('Fortress door graph', () => {
  it('references only real scenes', () => {
    const ids = new Set(sceneIds);
    for (const [from, doors] of Object.entries(FORTRESS_EXITS)) {
      expect(ids.has(from), `unknown source ${from}`).toBe(true);
      for (const door of doors) {
        expect(ids.has(door.to), `${from} -> ${door.to}`).toBe(true);
        expect(door.to).not.toBe(from);
      }
    }
  });

  it('can reach every room from S00', () => {
    const queue = ['S00'];
    const seen = new Set<string>();
    while (queue.length) {
      const id = queue.shift() as string;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const door of FORTRESS_EXITS[id] ?? []) queue.push(door.to);
    }
    for (const id of sceneIds) {
      expect(seen.has(id), `${id} is unreachable`).toBe(true);
    }
  });

  it('has an exit out of every room', () => {
    for (const id of sceneIds) {
      expect((FORTRESS_EXITS[id] ?? []).length, `${id} has no exit`).toBeGreaterThan(0);
    }
  });

  it('gates a scene only behind things found before it', () => {
    // Building a route with all doors open, then verifying gated rooms exist.
    const route = planRoute('S00', 'SAN1', FORTRESS_EXITS);
    expect(route).not.toBeNull();
    expect(route).toContain('GH2');
    expect(route).toContain('HM1');
  });
});

describe('Auto-battler campaign', () => {
  it('plans every scene exactly once', () => {
    expect(new Set(CAMPAIGN_ORDER).size).toBe(CAMPAIGN_ORDER.length);
    expect(CAMPAIGN_ORDER.length).toBe(sceneIds.length);
    for (const id of sceneIds) expect(CAMPAIGN_ORDER).toContain(id);
  });

  it('defines a plan and sensible coordinates for every scene', () => {
    for (const id of sceneIds) {
      const plan = SCENE_PLANS[id];
      expect(plan, `missing plan for ${id}`).toBeDefined();
      expect(plan.sceneId).toBe(id);
      for (const task of plan.tasks) {
        if (task.kind === 'clear') continue;
        expect(typeof task.x, `${task.id} x`).toBe('number');
        expect(typeof task.z, `task ${task.id} z`).toBe('number');
        expect(task.radius ?? 1.2).toBeGreaterThan(0);
      }
    }
    expect(TOTAL_TASKS).toBeGreaterThan(30);
  });

  it('walks the whole campaign, respecting gates and clearing every task', () => {
    const state = emptyState();
    const s = mutable(state);
    let current = 'S00';
    // The automaton records every room it physically crosses, including bare
    // corridors with no tasks of their own.
    const visited = s.visited;
    visited.add('S00');
    const tracks: string[] = [];

    for (let guard = 0; guard < 600; guard++) {
      const goal = nextGoal(state);
      if (!goal) break;
      // Collect every pending task in the current room before moving on.
      if (goal === current) {
        let pending = nextPendingTask(current, state);
        while (pending) {
          const requirementError = (pending.requires ?? []).find((req) => {
            if (req.startsWith('ITEM_')) return !s.inventory.has(req);
            if (req.startsWith('PUZZLE_')) return !s.solvedPuzzles.has(req);
            if (req.startsWith('ABILITY_')) return !s.abilities.has(req);
            return true;
          });
          expect(requirementError, `${pending.id} blocked by ${requirementError}`).toBeUndefined();
          applyTaskReward(current, pending, state);
          pending = nextPendingTask(current, state);
        }
        expect(scenePlanDone(current, state), `${current} should be complete`).toBe(true);
        continue;
      }
      const route = planRoute(current, goal, FORTRESS_EXITS, (door) =>
        doorRequirementsMet(door.requires ?? [], state.inventory, state.solvedPuzzles, state.abilities),
      );
      expect(route, `no route ${current} -> ${goal}`).not.toBeNull();
      const next = (route as string[])[1];
      expect(next, `route ${current} -> ${goal} has no first hop`).toBeTruthy();
      // Travelling through intermediate rooms counts as visiting them.
      for (const id of route as string[]) visited.add(id);
      tracks.push(`${current}→${next}`);
      current = next as string;
    }

    expect(nextGoal(state)).toBeNull();
    expect(completedTaskCount(state)).toBe(TOTAL_TASKS);
    for (const id of sceneIds) expect(visited.has(id), `${id} never visited`).toBe(true);
    expect(tracks.length).toBeGreaterThan(20);
  });

  it('completes talk tasks only after their reward is granted', () => {
    const state = emptyState();
    const morvath = SCENE_PLANS.BQ1.tasks[0];
    expect(taskDone(morvath, 'BQ1', state)).toBe(false);
    mutable(state).flags.add('talk:morvath');
    expect(taskDone(morvath, 'BQ1', state)).toBe(false);
    mutable(state).inventory.add('ITEM_TANTALUS_GOBLET');
    expect(taskDone(morvath, 'BQ1', state)).toBe(true);
  });
});

describe('Pathfinder', () => {
  const walls: ObstacleRect[] = [
    { x: 0, z: 6.2, hx: 6.5, hz: 0.25 },
    { x: 0, z: -6.2, hx: 6.5, hz: 0.25 },
    { x: -6.2, z: 0, hx: 0.25, hz: 6.5 },
    { x: 6.2, z: 0, hx: 0.25, hz: 6.5 },
  ];

  it('inflates walls so the capsule cannot clip them', () => {
    expect(isBlockedAt(0, 5.9, walls)).toBe(true);
    expect(isBlockedAt(0, 5.0, walls)).toBe(false);
  });

  it('returns a straight line when nothing is in the way', () => {
    const path = findPath({ x: 0, z: 3 }, { x: 0, z: -2 }, walls);
    expect(path).toHaveLength(1);
    expect(path[0].z).toBeCloseTo(-2);
  });

  it('routes around a central obstacle', () => {
    const pillar: ObstacleRect = { x: 0, z: 0, hx: 2, hz: 0.6 };
    const obstacles = [...walls, pillar];
    const path = findPath({ x: 0, z: 3 }, { x: 0, z: -3 }, obstacles);
    expect(path.length).toBeGreaterThan(1);
    for (const point of path) {
      expect(isBlockedAt(point.x, point.z, obstacles, 0.4)).toBe(false);
    }
    const last = path[path.length - 1];
    expect(Math.hypot(last.x - 0, last.z + 3)).toBeLessThan(0.6);
  });

  it('insets door targets into walkable floor', () => {
    const approach = doorApproachPoint({ x: 0, z: -4.8 });
    expect(approach.z).toBeGreaterThan(-4.8);
    expect(hasLineOfSight({ x: 0, z: 3 }, approach, walls)).toBe(true);
  });
});
