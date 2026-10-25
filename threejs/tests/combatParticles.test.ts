import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { CombatParticles } from '../src/character/CombatParticles';
import { SoundFX } from '../src/core/SoundFX';

describe('CombatParticles', () => {
  let scene: THREE.Scene;
  let particles: CombatParticles;

  beforeEach(() => {
    scene = new THREE.Scene();
    particles = new CombatParticles(scene);
  });

  afterEach(() => {
    particles.dispose();
  });

  it('spawns directional hit sparks and expands for combo finishers', () => {
    const pos = new THREE.Vector3(1, 0, 2);
    const dir = new THREE.Vector3(0, 0, 1);

    // Normal hit
    particles.spawnHitSparks(pos, dir, false, 0x38bdf8);
    expect(scene.children.length).toBeGreaterThan(0);

    // Update steps particles and sets instanced mesh count
    particles.update(0.016);
    const mesh = scene.children.find((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh;
    expect(mesh).toBeDefined();
    expect(mesh.count).toBe(18);

    // Finisher hit adds shockwave ring and more particles
    particles.spawnHitSparks(pos, dir, true, 0xfbbf24);
    particles.update(0.016);
    expect(mesh.count).toBe(18 + 36);

    // A ring mesh should be added to the scene
    const rings = scene.children.filter((c) => (c as THREE.Mesh).geometry?.type === 'RingGeometry');
    expect(rings.length).toBe(1);
  });

  it('spawns ethereal dust on dodge rolls and shockwave rings', () => {
    const pos = new THREE.Vector3(0, 0, 0);
    particles.spawnDodgeDust(pos, { x: 1, y: 0, z: 0 });
    particles.update(0.016);

    const mesh = scene.children.find((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh;
    expect(mesh.count).toBe(14);

    const rings = scene.children.filter((c) => (c as THREE.Mesh).geometry?.type === 'RingGeometry');
    expect(rings.length).toBe(1);
  });

  it('spawns parry deflection shards and stagger grit on damage', () => {
    const pos = new THREE.Vector3(2, 0, 1);

    // Parry burst
    particles.spawnParryBurst(pos, true);
    particles.update(0.016);
    const mesh = scene.children.find((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh;
    expect(mesh.count).toBe(28);

    // Stagger burst
    particles.spawnStaggerBurst(pos);
    particles.update(0.016);
    expect(mesh.count).toBe(28 + 18);
  });

  it('culls expired particles and rings over time', () => {
    particles.spawnHitSparks({ x: 0, y: 0, z: 0 }, undefined, true);
    particles.update(0.016);

    const mesh = scene.children.find((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh;
    expect(mesh.count).toBeGreaterThan(0);

    // Advance beyond max lifetime (e.g. 0.8s)
    for (let i = 0; i < 60; i++) {
      particles.update(0.02);
    }

    expect(mesh.count).toBe(0);
    const rings = scene.children.filter((c) => (c as THREE.Mesh).geometry?.type === 'RingGeometry');
    expect(rings.length).toBe(0);
  });
});

describe('SoundFX Combo Audio', () => {
  it('executes playComboSlash across all 3 tiers without throwing', () => {
    expect(() => SoundFX.playComboSlash(1)).not.toThrow();
    expect(() => SoundFX.playComboSlash(2)).not.toThrow();
    expect(() => SoundFX.playComboSlash(3)).not.toThrow();
    expect(() => SoundFX.playSlash(1)).not.toThrow();
  });

  it('executes playDodgeRoll and playShieldBlock without throwing', () => {
    expect(() => SoundFX.playDodgeRoll()).not.toThrow();
    expect(() => SoundFX.playShieldBlock()).not.toThrow();
  });
});
