import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TruthLensSystem, EchoBellSystem, EscherGravitySystem, type AcousticTarget } from '../src/systems/RelicMechanics';
import { BossVaelorEncounter, VAELOR_ENDINGS } from '../src/character/BossVaelorEncounter';

describe('RelicMechanics', () => {
  describe('TruthLensSystem', () => {
    it('toggles uTruthLensActive and dissolves illusory walls', () => {
      const lens = new TruthLensSystem();
      const wallMat = new THREE.MeshStandardMaterial({ opacity: 1.0 });
      const wall = new THREE.Mesh(new THREE.BoxGeometry(), wallMat);
      lens.registerIllusoryObject(wall);

      expect(lens.uniforms.uTruthLensActive.value).toBe(0.0);
      lens.setActive(true, new THREE.Vector3(1, 0, 2));
      expect(lens.uniforms.uTruthLensActive.value).toBe(1.0);
      expect(wallMat.opacity).toBeLessThan(0.3);

      lens.setActive(false);
      expect(lens.uniforms.uTruthLensActive.value).toBe(0.0);
      expect(wallMat.opacity).toBe(1.0);
    });

    it('highlights true decoys with cyan-violet rim glow', () => {
      const lens = new TruthLensSystem();
      const decoyMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
      const decoy = new THREE.Mesh(new THREE.BoxGeometry(), decoyMat);
      lens.registerDecoyObject(decoy);

      lens.setActive(true);
      expect(decoyMat.emissive.getHex()).toBe(0xa855f7);
      expect(decoyMat.emissiveIntensity).toBeGreaterThan(2.0);

      lens.setActive(false);
      expect(decoyMat.emissiveIntensity).toBe(0.0);
    });
  });

  describe('EchoBellSystem', () => {
    it('emits expanding acoustic ring and pushes back spectral enemies', () => {
      const scene = new THREE.Scene();
      const bell = new EchoBellSystem();
      const enemyPos = new THREE.Vector3(2, 0, 0);
      let hitCalled = false;
      const targets: AcousticTarget[] = [
        {
          id: 'wraith_1',
          position: enemyPos,
          type: 'spectral_enemy',
          onHit: () => { hitCalled = true; },
        },
      ];

      const ring = bell.emitAcousticRing(scene, new THREE.Vector3(0, 0, 0), targets);
      expect(ring).toBeTruthy();
      expect(hitCalled).toBe(true);
      expect(enemyPos.x).toBeGreaterThan(4.0); // pushed back by 3.5m
    });

    it('activates resonant switches within range', () => {
      const scene = new THREE.Scene();
      const bell = new EchoBellSystem();
      let switchActivated = false;
      const targets: AcousticTarget[] = [
        {
          id: 'switch_1',
          position: new THREE.Vector3(0, 0, 3),
          type: 'resonant_switch',
          onHit: () => { switchActivated = true; },
        },
      ];

      bell.emitAcousticRing(scene, new THREE.Vector3(0, 0, 0), targets);
      expect(switchActivated).toBe(true);
    });
  });

  describe('EscherGravitySystem', () => {
    it('pins iron nails and tracks anchor status', () => {
      const gravity = new EscherGravitySystem();
      expect(gravity.isAnchored).toBe(false);
      gravity.pinIronNail('RC1');
      expect(gravity.isAnchored).toBe(true);
    });
  });
});

describe('BossVaelorEncounter 4-Phase & Endings', () => {
  it('executes all 4 phases sequentially across health thresholds', () => {
    const boss = new BossVaelorEncounter();
    expect(boss.phase).toBe(1);

    // Hit 1: 50 dmg leaves 130 HP (<= 75% maxHp of 180 = 135) -> Phase 2
    boss.receivePlayerHit(50, 20);
    expect(boss.phase).toBe(2);

    // Hit 2: 45 dmg leaves 85 HP (<= 50% maxHp of 180 = 90) -> Phase 3
    boss.receivePlayerHit(45, 20);
    expect(boss.phase).toBe(3);

    // Hit 3: 45 dmg leaves 40 HP (<= 25% maxHp of 180 = 45) -> Phase 4
    boss.receivePlayerHit(45, 20);
    expect(boss.phase).toBe(4);

    // Hit 4: 35 dmg leaves 5 HP (<= 5% maxHp of 180 = 9) -> Ending Ready
    const hit4 = boss.receivePlayerHit(35, 20);
    expect(hit4.endingReady).toBe(true);
    expect(boss.endingChoiceAvailable).toBe(true);
  });

  it('provides all 4 canonical GDD ending choices', () => {
    const boss = new BossVaelorEncounter();
    expect(VAELOR_ENDINGS.length).toBe(4);

    const ending2 = boss.selectEnding(2);
    expect(ending2.key).toBe('unmaking');
    expect(boss.isDead).toBe(true);
    expect(boss.selectedEnding).toBe(ending2);
  });
});
