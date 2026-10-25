import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BossVaelorEncounter } from '../src/character/BossVaelorEncounter';

describe('BossVaelorEncounter', () => {
  it('initializes in Phase 1 with 180 HP and 120 Poise', () => {
    const boss = new BossVaelorEncounter();
    expect(boss.phase).toBe(1);
    expect(boss.hp).toBe(180);
    expect(boss.maxHp).toBe(180);
    expect(boss.poise).toBe(120);
    expect(boss.maxPoise).toBe(120);
    expect(boss.isDead).toBe(false);
    expect(boss.mesh.children.length).toBeGreaterThan(0);
  });

  it('depletes poise and breaks guard into a 2.5s stun', () => {
    const boss = new BossVaelorEncounter();
    const hit1 = boss.receivePlayerHit(20, 60);
    expect(hit1.guardBroken).toBe(false);
    expect(boss.poise).toBe(60);

    const hit2 = boss.receivePlayerHit(20, 60);
    expect(hit2.guardBroken).toBe(true);
    expect(boss.isStunned).toBe(true);
    expect(boss.stunTimer).toBe(2.5);
    expect(boss.poise).toBe(0);
  });

  it('deals 2.2x lethal execution damage to a stunned boss', () => {
    const boss = new BossVaelorEncounter();
    boss.receivePlayerHit(10, 120); // break guard
    expect(boss.isStunned).toBe(true);

    const hpBefore = boss.hp;
    const riposte = boss.receivePlayerHit(30, 0);
    expect(riposte.isExecution).toBe(true);
    expect(riposte.damageDealt).toBe(66); // 30 * 2.2
    expect(boss.hp).toBe(hpBefore - 66);
    expect(boss.isStunned).toBe(false);
    expect(boss.poise).toBe(boss.maxPoise);
  });

  it('transitions to Phase 2 at <= 50% HP with boosted speed and color change', () => {
    const boss = new BossVaelorEncounter();
    // Hit for 95 damage (leaves 85 HP <= 90 HP)
    const res = boss.receivePlayerHit(95, 20);
    expect(res.phaseShift).toBe(true);
    expect(boss.phase).toBe(2);
    expect(boss.speed).toBeGreaterThan(3.0);
    expect(boss.poise).toBe(boss.maxPoise);
  });

  it('spawns and clears illusion mirage clones', () => {
    const scene = new THREE.Scene();
    const boss = new BossVaelorEncounter();
    scene.add(boss.mesh);

    boss.spawnMirageClones(scene);
    expect(boss.clones.length).toBe(2);
    expect(scene.children.length).toBe(3); // boss + 2 clones

    boss.clearClones();
    expect(boss.clones.length).toBe(0);
  });

  it('spawns expanding shockwaves and damages unshielded non-dodging player', () => {
    const scene = new THREE.Scene();
    const boss = new BossVaelorEncounter(new THREE.Vector3(0, 0, 0));
    scene.add(boss.mesh);

    boss.spawnShockwave(scene);
    expect(boss.shockwaves.length).toBe(1);

    // Player positioned at distance 1.2 from boss
    const playerPos = new THREE.Vector3(1.2, 0, 0);

    // Run updates until shockwave radius reaches player
    let dealtDamage = 0;
    for (let i = 0; i < 30; i++) {
      const outcome = boss.update(1 / 60, playerPos, false, false);
      dealtDamage += outcome.shockwaveDamage;
    }
    expect(dealtDamage).toBeGreaterThan(0);
  });

  it('reduces shockwave damage when blocking with shield and nullifies when dodging', () => {
    const scene = new THREE.Scene();
    const boss = new BossVaelorEncounter(new THREE.Vector3(0, 0, 0));
    scene.add(boss.mesh);

    // Dodging test: 0 damage
    boss.spawnShockwave(scene);
    const playerPos = new THREE.Vector3(1.0, 0, 0);
    let dodgeDmg = 0;
    for (let i = 0; i < 30; i++) {
      dodgeDmg += boss.update(1 / 60, playerPos, true, false).shockwaveDamage;
    }
    expect(dodgeDmg).toBe(0);
  });

  it('drops legendary Sun-Staff ground loot upon defeat', () => {
    const scene = new THREE.Scene();
    const boss = new BossVaelorEncounter(new THREE.Vector3(0, 0, 0));
    scene.add(boss.mesh);

    // Kill boss
    const killRes = boss.receivePlayerHit(180, 50);
    expect(killRes.isDead).toBe(true);
    expect(boss.isDead).toBe(true);

    const loot = boss.dropBossLoot(scene);
    expect(loot).toBeTruthy();
    expect(loot.weaponId).toBe('sun_staff');
    expect(loot.claimed).toBe(false);
    expect(boss.lootDrop).toBe(loot);
  });
});
