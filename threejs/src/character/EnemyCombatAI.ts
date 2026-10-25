/**
 * EnemyCombatAI: Guard telegraph windup, poise meter, guard break stun,
 * counter-hit interruptions, and lethal execution calculations.
 */

export interface GuardPoiseState {
  hp: number;
  maxHp: number;
  poise: number;
  maxPoise: number;
  isStunned: boolean;
  stunTimer: number;
  poiseRegenTimer: number;
  windupTimer: number;
  cooldown: number;
}

export interface PoiseHitResult {
  damageDealt: number;
  guardBroken: boolean;
  counterHit: boolean;
  isExecution: boolean;
}

export const POISE_CONSTANTS = {
  DEFAULT_GUARD_POISE: 45,
  DEFAULT_CAPTAIN_POISE: 75,
  STUN_DURATION: 2.5,
  POISE_REGEN_DELAY: 2.5,
  POISE_REGEN_RATE: 20, // poise per second
  WINDUP_NORMAL: 0.45,
  WINDUP_CAPTAIN: 0.60,
  EXECUTION_MULTIPLIER: 2.2,
  PARRY_POISE_DAMAGE: 35,
  PERFECT_PARRY_POISE_DAMAGE: 50,
} as const;

export function createGuardPoiseState(maxPoise: number = POISE_CONSTANTS.DEFAULT_GUARD_POISE, hp = 60): GuardPoiseState {
  return {
    hp,
    maxHp: hp,
    poise: maxPoise,
    maxPoise,
    isStunned: false,
    stunTimer: 0,
    poiseRegenTimer: 0,
    windupTimer: 0,
    cooldown: 0,
  };
}

export function startGuardTelegraph(state: GuardPoiseState, isCaptain = false): number {
  state.windupTimer = isCaptain ? POISE_CONSTANTS.WINDUP_CAPTAIN : POISE_CONSTANTS.WINDUP_NORMAL;
  return state.windupTimer;
}

export function updateGuardPoise(state: GuardPoiseState, dt: number): void {
  if (state.isStunned) {
    state.stunTimer -= dt;
    if (state.stunTimer <= 0) {
      state.isStunned = false;
      state.stunTimer = 0;
      state.poise = state.maxPoise;
      state.poiseRegenTimer = 0;
    }
    return;
  }

  if (state.poiseRegenTimer > 0) {
    state.poiseRegenTimer -= dt;
    if (state.poiseRegenTimer < 0) {
      const excessDt = -state.poiseRegenTimer;
      state.poiseRegenTimer = 0;
      if (state.poise < state.maxPoise) {
        state.poise = Math.min(state.maxPoise, state.poise + POISE_CONSTANTS.POISE_REGEN_RATE * excessDt);
      }
    }
  } else if (state.poise < state.maxPoise) {
    state.poise = Math.min(state.maxPoise, state.poise + POISE_CONSTANTS.POISE_REGEN_RATE * dt);
  }
}

export function applyPlayerHitToGuard(
  state: GuardPoiseState,
  baseDamage: number,
  poiseDamage: number
): PoiseHitResult {
  let damageDealt = baseDamage;

  if (state.isStunned) {
    damageDealt = Math.round(baseDamage * POISE_CONSTANTS.EXECUTION_MULTIPLIER);
    state.hp -= damageDealt;
    state.isStunned = false;
    state.stunTimer = 0;
    state.poise = state.maxPoise;
    return {
      damageDealt,
      guardBroken: false,
      counterHit: false,
      isExecution: true,
    };
  }

  state.hp -= damageDealt;
  state.poise = Math.max(0, state.poise - poiseDamage);
  state.poiseRegenTimer = POISE_CONSTANTS.POISE_REGEN_DELAY;

  if (state.poise <= 0) {
    state.isStunned = true;
    state.stunTimer = POISE_CONSTANTS.STUN_DURATION;
    state.windupTimer = 0;
    return {
      damageDealt,
      guardBroken: true,
      counterHit: false,
      isExecution: false,
    };
  }

  let counterHit = false;
  if (state.windupTimer > 0) {
    counterHit = true;
    state.windupTimer = 0;
    state.cooldown = 1.0;
  }

  return {
    damageDealt,
    guardBroken: false,
    counterHit,
    isExecution: false,
  };
}

export function applyParryToGuard(state: GuardPoiseState, perfectParry: boolean): { guardBroken: boolean; poiseRemaining: number } {
  const poiseCost = perfectParry ? POISE_CONSTANTS.PERFECT_PARRY_POISE_DAMAGE : POISE_CONSTANTS.PARRY_POISE_DAMAGE;
  state.poise = Math.max(0, state.poise - poiseCost);
  state.poiseRegenTimer = POISE_CONSTANTS.POISE_REGEN_DELAY;
  state.windupTimer = 0;
  state.cooldown = perfectParry ? 3.6 : 2.8;

  if (state.poise <= 0) {
    state.isStunned = true;
    state.stunTimer = POISE_CONSTANTS.STUN_DURATION;
    return { guardBroken: true, poiseRemaining: 0 };
  }

  return { guardBroken: false, poiseRemaining: state.poise };
}
