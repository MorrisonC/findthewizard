import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildProceduralMainCharacter } from '../src/character/MainCharacterRig';
import { CombatController } from '../src/character/CombatController';
import {
  equipWeapon,
  equipShield,
  WEAPON_REGISTRY,
  WEAPON_IDS,
} from '../src/character/WeaponArsenal';
import { WeaponTrail } from '../src/character/WeaponTrail';

describe('WeaponArsenal & Sockets', () => {
  it('registers all 4 canonical weapons with valid attributes', () => {
    expect(WEAPON_IDS).toEqual(['hunter_blade', 'glass_cleaver', 'void_rapier', 'sun_staff']);
    for (const id of WEAPON_IDS) {
      const def = WEAPON_REGISTRY[id];
      expect(def).toBeDefined();
      expect(def.name).toBeTruthy();
      expect(def.damageMultiplier).toBeGreaterThan(0);
      expect(def.hitRadius).toBeGreaterThan(0.2);
      expect(def.trailColor).toBeGreaterThan(0);
      expect(def.tipOffset[1]).toBeGreaterThan(def.baseOffset[1]);
    }
  });

  it('equips Hunter Blade onto hand_r_socket with base and tip anchors', () => {
    const rig = buildProceduralMainCharacter(false);
    expect(rig.weaponSocket.children.filter((c) => c.name !== 'HitboxAnchor').length).toBe(0);

    const equipped = equipWeapon(rig, 'hunter_blade');
    expect(equipped.def.id).toBe('hunter_blade');
    expect(rig.weaponSocket.getObjectByName('HunterBlade')).toBeDefined();
    expect(rig.weaponSocket.getObjectByName('WeaponBaseAnchor')).toBeDefined();
    expect(rig.weaponSocket.getObjectByName('WeaponTipAnchor')).toBeDefined();
    expect(equipped.baseAnchor.position.y).toBeCloseTo(0.12, 2);
    expect(equipped.tipAnchor.position.y).toBeCloseTo(1.15, 2);
  });

  it('swaps weapons cleanly without leaking detached meshes', () => {
    const rig = buildProceduralMainCharacter(false);
    equipWeapon(rig, 'hunter_blade');
    expect(rig.weaponSocket.getObjectByName('HunterBlade')).toBeDefined();

    // Swap to Glass Cleaver
    const cleaver = equipWeapon(rig, 'glass_cleaver');
    expect(cleaver.def.id).toBe('glass_cleaver');
    expect(rig.weaponSocket.getObjectByName('HunterBlade')).toBeUndefined();
    expect(rig.weaponSocket.getObjectByName('GlassCleaver')).toBeDefined();
    expect(cleaver.def.damageMultiplier).toBe(1.35);

    // Hitbox anchor should adapt to larger cleaver reach
    expect(rig.hitboxAnchor.position.y).toBeCloseTo((0.15 + 1.35) * 0.5, 2);
  });

  it('equips Harmonic Aegis shield to LeftLowerArm with reactive ward barrier', () => {
    const rig = buildProceduralMainCharacter(false);
    const shield = equipShield(rig);

    expect(rig.bones.LeftLowerArm.getObjectByName('HarmonicAegis')).toBeDefined();
    expect(shield.barrierMesh).toBeDefined();
    expect(shield.barrierMesh.visible).toBe(false);

    // Activate ward (blocking)
    shield.setWardActive(true, false);
    expect(shield.barrierMesh.visible).toBe(true);
    expect((shield.barrierMesh.material as THREE.MeshStandardMaterial).opacity).toBeCloseTo(0.55, 1);

    // Parry flash
    shield.setWardActive(true, true);
    expect((shield.barrierMesh.material as THREE.MeshStandardMaterial).opacity).toBeCloseTo(0.9, 1);
    expect(shield.barrierMesh.scale.x).toBeGreaterThan(1.0);

    // Deactivate ward
    shield.setWardActive(false);
    expect(shield.barrierMesh.visible).toBe(false);
  });
});

describe('WeaponTrail & Ribbon Geometry', () => {
  it('samples weapon swing trajectory and updates ribbon vertex buffer', () => {
    const scene = new THREE.Scene();
    const rig = buildProceduralMainCharacter(false);
    scene.add(rig.group);

    const weapon = equipWeapon(rig, 'hunter_blade');
    const trail = new WeaponTrail(scene, { maxSamples: 16 });
    trail.setWeapon(weapon);

    // Step 1: not swinging -> no triangles drawn
    trail.update(0.016, false, 1);
    expect(trail.mesh.geometry.drawRange.count).toBe(0);

    // Step 2: simulate swing movement
    rig.group.position.x = 0;
    rig.group.updateMatrixWorld(true);
    trail.update(0.016, true, 1);

    rig.group.position.x = 0.5; // move blade through space
    rig.group.updateMatrixWorld(true);
    trail.update(0.016, true, 1);

    // 2 samples = 1 quad = 6 vertices
    expect(trail.mesh.geometry.drawRange.count).toBe(6);

    // Step 3: combo finisher tier flairs ribbon
    rig.group.position.x = 1.0;
    rig.group.updateMatrixWorld(true);
    trail.update(0.016, true, 3);
    expect(trail.mesh.geometry.drawRange.count).toBe(12);

    trail.dispose();
  });

  it('integrates seamlessly with CombatController update loop', () => {
    const scene = new THREE.Scene();
    const rig = buildProceduralMainCharacter(false);
    scene.add(rig.group);

    const combat = new CombatController(rig);
    const weapon = equipWeapon(rig, 'sun_staff');
    const shield = equipShield(rig);
    const trail = new WeaponTrail(scene);

    combat.attachWeapon(weapon);
    combat.attachShield(shield);
    combat.attachWeaponTrail(trail);

    expect(combat.equippedWeapon?.def.id).toBe('sun_staff');
    expect(combat.equippedShield).toBe(shield);

    // Trigger attack swing and verify update tick
    combat.pressAttack();
    combat.update(0.05);
    expect(combat.state).toBe('Light_Attack_1');

    // Trigger block and verify shield ward auto-activation
    combat.setBlock(true);
    for (let i = 0; i < 35; i++) combat.update(0.02);
    expect(combat.state).toBe('Block_Parry');
    expect(shield.barrierMesh.visible).toBe(true);

    combat.dispose();
  });
});
