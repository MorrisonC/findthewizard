import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildProceduralMainCharacter, BONE_NAMES } from '../src/character/MainCharacterRig';
import { CombatController, type CombatTarget } from '../src/character/CombatController';
import { COMBAT_TIMING } from '../src/character/CombatAnimations';

const DT = 1 / 60;
function make() {
  const rig = buildProceduralMainCharacter();
  const hits: string[] = [];
  const states: string[] = [];
  const c = new CombatController(rig, { onHit: (e) => hits.push(e.state), onStateChange: (n) => states.push(n) });
  return { rig, c, hits, states };
}
function run(c: CombatController, seconds: number, each?: () => void) {
  for (let i = 0; i < Math.round(seconds / DT); i++) { c.update(DT); each?.(); }
}

describe('rig', () => {
  it('has the canonical humanoid hierarchy and sockets', () => {
    const { rig } = make();
    for (const b of BONE_NAMES) expect(rig.bones[b]).toBeTruthy();
    expect(rig.weaponSocket.name).toBe('hand_r_socket');
    expect(rig.weaponSocket.parent).toBe(rig.bones.RightHand);
    expect(rig.spellOrigin.parent).toBe(rig.bones.LeftHand);
  });
});

describe('combat controller', () => {
  it('registers damage only inside the normalised hit window', () => {
    const { rig, c } = make();
    // Target placed on the blade path at the swing apex, in front of the character.
    const target: CombatTarget = { id: 'dummy', position: new THREE.Vector3(0, 1.3, 0.9), radius: 1.2 };
    c.targetProvider = () => [target];
    const activeSamples: number[] = [];
    const inactiveSamples: number[] = [];
    c.pressAttack();
    run(c, 0.7, () => {
      (c.hitboxActive ? activeSamples : inactiveSamples).push(c.normalizedTime);
    });
    const [a, b] = COMBAT_TIMING.Light_Attack_1.hit!;
    expect(activeSamples.length).toBeGreaterThan(0);
    for (const n of activeSamples) { expect(n).toBeGreaterThanOrEqual(a - 1e-6); expect(n).toBeLessThanOrEqual(b + 1e-6); }
    expect(rig.group).toBeTruthy();
  });

  it('hits a target once per swing, and not outside the window', () => {
    const { c, hits } = make();
    const target: CombatTarget = { id: 't', position: new THREE.Vector3(0, 1.3, 0.9), radius: 1.5 };
    c.targetProvider = () => [target];
    c.pressAttack();
    run(c, 0.7);
    expect(hits).toEqual(['Light_Attack_1']);
  });

  it('chains the buffered 3-hit combo and ends after the finisher', () => {
    const { c, states } = make();
    c.pressAttack();
    run(c, 0.2);
    c.pressAttack(); // buffered; L1 cancel window opens at 0.55 normalised
    run(c, 0.3);
    expect(c.state).toBe('Light_Attack_2');
    c.pressAttack();
    run(c, 0.45);
    expect(c.state).toBe('Heavy_Combo_Finisher');
    c.pressAttack(); // nothing after the finisher
    run(c, 1.5);
    expect(states.filter((s) => s === 'Heavy_Combo_Finisher').length).toBe(1);
    expect(c.busy).toBe(false);
  });

  it('grants i-frames and root motion during a dodge roll', () => {
    const { c } = make();
    c.pressDodge(1, 0);
    c.update(DT);
    expect(c.state).toBe('Dodge_Roll');
    const total = new THREE.Vector3();
    let iframes = 0;
    run(c, 0.7, () => { total.add(c.consumeRootMotion()); if (c.invulnerable) iframes++; });
    expect(iframes).toBeGreaterThan(20);
    expect(total.x).toBeGreaterThan(2.5);
    expect(c.state).toBe('Idle_Combat');
  });

  it('resolves incoming hits: evade, parry, block, stagger', () => {
    const { c } = make();
    c.pressDodge(0, 1);
    run(c, 0.1);
    expect(c.receiveHit({ damage: 10 })).toBe('evaded');
    run(c, 1);

    c.setBlock(true);
    run(c, 0.05);
    expect(c.receiveHit({ damage: 10 })).toBe('parried');
    run(c, 0.4);
    expect(c.receiveHit({ damage: 10 })).toBe('blocked');
    c.setBlock(false);
    run(c, 0.3);

    expect(c.receiveHit({ damage: 10 })).toBe('hit');
    expect(c.state).toBe('Hit_Stagger');
  });

  it('fires the spell at the cast release frame and can counter spells', () => {
    const { rig } = make();
    let spells = 0;
    const c = new CombatController(rig, { onSpell: () => spells++ });
    c.pressCast();
    run(c, 0.2);
    expect(c.receiveHit({ damage: 5, kind: 'spell' })).toBe('countered');
    run(c, 0.7);
    expect(spells).toBe(1);
  });
});
