import { describe, it, expect } from 'vitest';
import manifest from '../src/data/world_manifest.json';

type Exit = { to: string; spawn: number[]; requires: string[]; oneWay: boolean };
type Scene = {
  id: string;
  spawn: number[];
  exits: Exit[];
  items?: { id: string }[];
  rewards?: string[];
  puzzle?: string;
};

const scenes = manifest.scenes as Scene[];
const ids = new Set(scenes.map(s => s.id));
const availableItems = new Set(scenes.flatMap(s => (s.items || []).map(i => i.id)));
const availablePuzzles = new Set(scenes.map(s => s.puzzle).filter(Boolean));
const availableAbilities = new Set(scenes.flatMap(s => s.rewards || []));

describe('VEILKEEP world manifest', () => {
  it('has unique scene IDs and valid exits', () => {
    expect(ids.size).toBe(scenes.length);
    expect(ids.has('S00')).toBe(true);
    for (const scene of scenes) {
      expect(scene.spawn).toHaveLength(3);
      for (const exit of scene.exits) {
        expect(ids.has(exit.to)).toBe(true);
        expect(exit.spawn).toHaveLength(3);
        expect(exit.oneWay).toBeTypeOf('boolean');
      }
    }
  });

  it('references only declared requirements', () => {
    for (const scene of scenes) {
      for (const exit of scene.exits) {
        for (const req of exit.requires) {
          if (req.startsWith('ITEM_')) expect(availableItems.has(req)).toBe(true);
          else if (req.startsWith('PUZZLE_')) expect(availablePuzzles.has(req)).toBe(true);
          else if (req.startsWith('ABILITY_')) expect(availableAbilities.has(req)).toBe(true);
        }
      }
    }
  });

  it('never gates a scene behind its own reward', () => {
    for (const scene of scenes) {
      const ownRewards = new Set([...(scene.rewards || []), ...(scene.items || []).map(i => i.id)]);
      for (const exit of scene.exits) {
        for (const req of exit.requires) expect(ownRewards.has(req)).toBe(false);
      }
    }
  });

  it('has a reachable path from S00 to the encounter finale', () => {
    const visited = new Set<string>();
    const queue = ['S00'];
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const scene = scenes.find(s => s.id === id)!;
      for (const exit of scene.exits) {
        // Ignore one-way shortcuts for required progression reachability.
        if (!exit.oneWay) queue.push(exit.to);
      }
    }
    expect(visited.has('GH3')).toBe(true);
  });
});
