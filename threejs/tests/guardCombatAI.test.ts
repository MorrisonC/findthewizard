import { describe, it, expect } from 'vitest';
import {
  createGuardPoiseState,
  startGuardTelegraph,
  updateGuardPoise,
  applyPlayerHitToGuard,
  applyParryToGuard,
  POISE_CONSTANTS,
} from '../src/character/EnemyCombatAI';

describe('EnemyCombatAI', () => {
  it('initializes guard poise correctly for normal guards and captains', () => {
    const normal = createGuardPoiseState();
    expect(normal.poise).toBe(45);
    expect(normal.maxPoise).toBe(45);
    expect(normal.isStunned).toBe(false);

    const captain = createGuardPoiseState(POISE_CONSTANTS.DEFAULT_CAPTAIN_POISE, 120);
    expect(captain.poise).toBe(75);
    expect(captain.hp).toBe(120);
  });

  it('triggers attack telegraph wind-up (0.45s normal, 0.60s captain)', () => {
    const normal = createGuardPoiseState();
    const tNorm = startGuardTelegraph(normal, false);
    expect(tNorm).toBe(0.45);
    expect(normal.windupTimer).toBe(0.45);

    const captain = createGuardPoiseState(75);
    const tCapt = startGuardTelegraph(captain, true);
    expect(tCapt).toBe(0.60);
    expect(captain.windupTimer).toBe(0.60);
  });

  it('interrupts guard attack on counter-hit during telegraph windup', () => {
    const guard = createGuardPoiseState();
    startGuardTelegraph(guard);
    expect(guard.windupTimer).toBeGreaterThan(0);

    const res = applyPlayerHitToGuard(guard, 25, 15);
    expect(res.counterHit).toBe(true);
    expect(res.guardBroken).toBe(false);
    expect(guard.windupTimer).toBe(0);
    expect(guard.cooldown).toBe(1.0);
    expect(guard.poise).toBe(30);
  });

  it('breaks guard and applies 2.5s stun when poise reaches zero', () => {
    const guard = createGuardPoiseState(45);
    // Hit 1: 15 poise dmg -> 30 poise
    applyPlayerHitToGuard(guard, 20, 15);
    expect(guard.isStunned).toBe(false);
    expect(guard.poise).toBe(30);

    // Hit 2: 35 poise dmg -> 0 poise -> Guard break!
    const res = applyPlayerHitToGuard(guard, 35, 35);
    expect(res.guardBroken).toBe(true);
    expect(guard.isStunned).toBe(true);
    expect(guard.stunTimer).toBe(2.5);
    expect(guard.poise).toBe(0);
  });

  it('deals 2.2x execution damage on stunned enemies and restores poise after strike', () => {
    const guard = createGuardPoiseState(45, 100);
    // Break guard
    applyPlayerHitToGuard(guard, 10, 50);
    expect(guard.isStunned).toBe(true);
    const hpBefore = guard.hp;

    // Executioner strike
    const baseDamage = 30;
    const res = applyPlayerHitToGuard(guard, baseDamage, 0);
    expect(res.isExecution).toBe(true);
    expect(res.damageDealt).toBe(Math.round(baseDamage * 2.2)); // 66 damage
    expect(guard.hp).toBe(hpBefore - 66);
    expect(guard.isStunned).toBe(false);
    expect(guard.poise).toBe(guard.maxPoise);
  });

  it('breaks guard on perfect parry when poise depleted', () => {
    const guard = createGuardPoiseState(45);
    const parryRes = applyParryToGuard(guard, true); // 50 poise damage
    expect(parryRes.guardBroken).toBe(true);
    expect(guard.isStunned).toBe(true);
    expect(guard.stunTimer).toBe(2.5);
  });

  it('recovers from stun automatically after stunTimer elapses', () => {
    const guard = createGuardPoiseState(45);
    applyPlayerHitToGuard(guard, 10, 50); // Guard broken
    expect(guard.isStunned).toBe(true);

    updateGuardPoise(guard, 1.5);
    expect(guard.isStunned).toBe(true);

    updateGuardPoise(guard, 1.1); // Total 2.6s > 2.5s
    expect(guard.isStunned).toBe(false);
    expect(guard.poise).toBe(45);
  });

  it('regenerates poise after 2.5s delay when not taking damage', () => {
    const guard = createGuardPoiseState(45);
    applyPlayerHitToGuard(guard, 10, 25); // poise is 20, delay is 2.5s
    expect(guard.poise).toBe(20);

    // During delay, poise does not increase
    updateGuardPoise(guard, 2.0);
    expect(guard.poise).toBe(20);

    // After delay, poise regenerates at 20 poise/sec
    updateGuardPoise(guard, 1.0); // 0.5s delay remaining + 0.5s regen = 10 poise
    expect(guard.poise).toBe(30);
  });
});
