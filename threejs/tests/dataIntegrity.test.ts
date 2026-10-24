import { describe, it, expect } from 'vitest';
import itemsData from '../src/data/items.json';
import questsData from '../src/data/quests.json';
import puzzlesData from '../src/data/puzzles.json';
import zonesData from '../src/data/zones.json';
import dialogueData from '../src/data/dialogue.json';

describe('VEILKEEP Data Registry Integrity', () => {
  it('should load all 27 fortress zones with valid bidirectional adjacencies', () => {
    expect(zonesData).toHaveLength(27);
    const zoneIds = new Set(zonesData.map(z => z.id));
    expect(zoneIds.size).toBe(27);
    expect(zoneIds.has('outer')).toBe(true);
    expect(zoneIds.has('sanctum')).toBe(true);
    expect(zoneIds.has('labyrinth')).toBe(true);
    expect(zoneIds.has('eyrie')).toBe(true);
    expect(zoneIds.has('haunted')).toBe(true);

    for (const z of zonesData) {
      expect(z.adjacentZoneIds.length).toBeGreaterThan(0);
      expect(z.exits.length).toBeGreaterThan(0);
      for (const adj of z.adjacentZoneIds) {
        expect(zoneIds.has(adj)).toBe(true);
      }
    }
  });

  it('should load all 42 quests (7 Main, 31 Side, 4 Hidden)', () => {
    expect(questsData).toHaveLength(42);
    const mainQuests = questsData.filter(q => q.type === 'Main');
    const sideQuests = questsData.filter(q => q.type === 'Side');
    const hiddenQuests = questsData.filter(q => q.type === 'Hidden');

    expect(mainQuests).toHaveLength(7);
    expect(sideQuests).toHaveLength(31);
    expect(hiddenQuests).toHaveLength(4);
  });

  it('should load all 30 illusionist puzzles', () => {
    expect(puzzlesData).toHaveLength(30);
    const puzzleIds = new Set(puzzlesData.map(p => p.id));
    expect(puzzleIds.size).toBe(30);
    expect(puzzleIds.has('P1')).toBe(true);
    expect(puzzleIds.has('P30')).toBe(true);
  });

  it('should verify all core weapons, relics, and Cynthia memory shards exist in items registry', () => {
    expect(itemsData.length).toBeGreaterThanOrEqual(35);
    const itemIds = itemsData.map(i => i.id);

    // Core Weapons & Relics
    expect(itemIds).toContain('weapon_whisper');
    expect(itemIds).toContain('weapon_daybreak');
    expect(itemIds).toContain('weapon_minotaur_labrys');
    expect(itemIds).toContain('relic_iron_nails');
    expect(itemIds).toContain('relic_echo_bell');
    expect(itemIds).toContain('relic_truth_lens');
    expect(itemIds).toContain('relic_metronome');
    expect(itemIds).toContain('relic_spectral_lantern');
    expect(itemIds).toContain('relic_gryphon_cloak');
    expect(itemIds).toContain('relic_starlight_clew');
    expect(itemIds).toContain('relic_martyr_amulet');
    expect(itemIds).toContain('passkey_bartholomew');

    // Cynthia's 7 Memory Shards
    expect(itemIds).toContain('shard_gate');
    expect(itemIds).toContain('shard_hearth');
    expect(itemIds).toContain('shard_glass');
    expect(itemIds).toContain('shard_garden');
    expect(itemIds).toContain('shard_spire');
    expect(itemIds).toContain('shard_crypt');
    expect(itemIds).toContain('shard_void');
  });

  it('should ensure main quest progression forms a valid acyclic graph', () => {
    const mainQuestIds = ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];
    for (let i = 1; i < mainQuestIds.length; i++) {
      const q = questsData.find(quest => quest.id === mainQuestIds[i]);
      expect(q).toBeDefined();
      expect(q?.prerequisiteQuestIds).toContain(mainQuestIds[i - 1]);
    }
  });

  it('should verify dialogue trees for key NPCs exist and have valid root nodes', () => {
    expect(dialogueData).toHaveProperty('bartholomew');
    expect(dialogueData).toHaveProperty('aurelius');
    expect(dialogueData).toHaveProperty('vaelor');
    expect(dialogueData).toHaveProperty('cynthia');
    expect(dialogueData.bartholomew.nodes).toHaveProperty(dialogueData.bartholomew.rootNodeId);
    expect(dialogueData.aurelius.nodes).toHaveProperty(dialogueData.aurelius.rootNodeId);
    expect(dialogueData.vaelor.nodes).toHaveProperty(dialogueData.vaelor.rootNodeId);
    expect(dialogueData.cynthia.nodes).toHaveProperty(dialogueData.cynthia.rootNodeId);
  });
});
