import * as THREE from 'three';
import { COMBAT_TIMING, buildCombatClips, type CombatState } from './CombatAnimations';
import type { MainCharacterRig } from './MainCharacterRig';
import type { EquippedWeapon, EquippedShield } from './WeaponArsenal';
import type { WeaponTrail } from './WeaponTrail';
import type { CombatParticles } from './CombatParticles';

export type DifficultyTierId =
  | 'novice'
  | 'apprentice'
  | 'adept'
  | 'expert'
  | 'master'
  | 'legendary';

export interface DifficultyPreset {
  id: DifficultyTierId;
  label: string;
  playerDamageMult: number;
  enemyDamageMult: number;
  enemyHpMult: number;
}

export const SKYRIM_DIFFICULTY_PRESETS: Record<DifficultyTierId, DifficultyPreset> = {
  novice: {
    id: 'novice',
    label: 'Novice (1.5x Player / 0.5x Enemy)',
    playerDamageMult: 1.5,
    enemyDamageMult: 0.5,
    enemyHpMult: 0.75,
  },
  apprentice: {
    id: 'apprentice',
    label: 'Apprentice (1.25x Player / 0.75x Enemy)',
    playerDamageMult: 1.25,
    enemyDamageMult: 0.75,
    enemyHpMult: 0.9,
  },
  adept: {
    id: 'adept',
    label: 'Adept (1.0x Balanced Default)',
    playerDamageMult: 1.0,
    enemyDamageMult: 1.0,
    enemyHpMult: 1.0,
  },
  expert: {
    id: 'expert',
    label: 'Expert (0.75x Player / 1.5x Enemy)',
    playerDamageMult: 0.75,
    enemyDamageMult: 1.5,
    enemyHpMult: 1.25,
  },
  master: {
    id: 'master',
    label: 'Master (0.5x Player / 2.0x Enemy)',
    playerDamageMult: 0.5,
    enemyDamageMult: 2.0,
    enemyHpMult: 1.55,
  },
  legendary: {
    id: 'legendary',
    label: 'Legendary (0.35x Player / 3.0x Enemy)',
    playerDamageMult: 0.35,
    enemyDamageMult: 3.0,
    enemyHpMult: 2.1,
  },
};

export interface EquipmentStats {
  weaponDamageMultiplier: number;
  critChance: number;
  critMultiplier: number;
  staminaCostMultiplier: number;
  damageMitigation: number;
  bladeLength: number;
}

export interface PlayerRPGState {
  level: number;
  xp: number;
  xpToNextLevel: number;
  perkPoints: number;
  maxHp: number;
  hp: number;
  maxStamina: number;
  stamina: number;
  maxFocus: number;
  focus: number;
  armorRating: number;
  baseAttackDamage: number;
  skills: {
    bladeAndParry: number;
    shadowcraftAndEvasion: number;
    arcaneLoreAndWards: number;
  };
  perks: {
    armsman: boolean;
    silentRoll: boolean;
    resonantWard: boolean;
  };
}

/** A sweepable combat target supplied by the host (guards, props, dummies). */
export interface CombatTarget {
  id: string;
  position: THREE.Vector3Like;
  radius?: number;
}

export interface CombatHitEvent {
  target: CombatTarget;
  state: CombatState;
  damage: number;
  isFinisher: boolean;
}

export interface CombatSpellEvent {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  state: CombatState;
}

export interface CombatCallbacks {
  /** A target was inside the live hitbox window (once per target per swing). */
  onHit?: (event: CombatHitEvent) => void;
  /** The swing hitbox just became live; host resolves area damage here. */
  onHitboxOpen?: (state: CombatState) => void;
  onStateChange?: (state: CombatState) => void;
  /** A spell left the caster's hand at the release frame. */
  onSpell?: (event: CombatSpellEvent) => void;
}

export type IncomingHitResult = 'evaded' | 'parried' | 'blocked' | 'countered' | 'hit';

export interface IncomingHit {
  damage?: number;
  kind?: 'melee' | 'spell' | 'aoe';
}

export const DODGE_COOLDOWN = 0.25;
export const DODGE_DURATION = 0.52;
export const DODGE_IFRAME_START = 0.05;
export const DODGE_IFRAME_END = 0.42;
export const DODGE_DISTANCE = 3.4;
export const PARRY_WINDOW_SECONDS = 0.24;

type AttackState = 'Light_Attack_1' | 'Light_Attack_2' | 'Heavy_Combo_Finisher';

const ATTACK_CHAIN: AttackState[] = ['Light_Attack_1', 'Light_Attack_2', 'Heavy_Combo_Finisher'];

/** Clip fallbacks so imported rigs with a reduced clip set still animate. */
const CLIP_CANDIDATES: Record<CombatState | 'Locomotion', string[]> = {
  Idle_Combat: ['Idle_Combat', 'idle', 'Idle'],
  Locomotion: ['Locomotion_Run', 'run', 'Locomotion_Walk', 'walk'],
  Light_Attack_1: ['Light_Attack_1', 'attack_light', 'Light_Attack_2', 'Idle_Combat'],
  Light_Attack_2: ['Light_Attack_2', 'attack_light', 'Light_Attack_1', 'Idle_Combat'],
  Heavy_Combo_Finisher: ['Heavy_Combo_Finisher', 'attack_heavy', 'Light_Attack_2', 'Idle_Combat'],
  Cast_Illusion: ['Cast_Illusion', 'attack_heavy', 'Arcane_Cast', 'Idle_Combat'],
  Arcane_Cast: ['Arcane_Cast', 'phase_shift', 'Cast_Illusion', 'Idle_Combat'],
  Dodge_Roll: ['Dodge_Roll', 'dodge_roll', 'Idle_Combat'],
  Block_Parry: ['Block_Parry', 'Idle_Combat'],
  Hit_Stagger: ['Hit_Stagger', 'hurt', 'Idle_Combat'],
};

/**
 * Player combat brain: owns the animation state machine, melee hit windows,
 * dodge i-frames/root motion, blocking/parrying and spell release timing.
 *
 * Damage itself is resolved by the host through `onHitboxOpen` (which knows
 * about guards, weapons and damage numbers); `onHit` is the generic hook used
 * by tests and by any host that supplies a `targetProvider`.
 */
export class CombatController {
  public difficulty: DifficultyPreset = SKYRIM_DIFFICULTY_PRESETS.adept;
  public rpg: PlayerRPGState = {
    level: 1,
    xp: 0,
    xpToNextLevel: 120,
    perkPoints: 1,
    maxHp: 180,
    hp: 180,
    maxStamina: 120,
    stamina: 120,
    maxFocus: 80,
    focus: 80,
    armorRating: 110,
    baseAttackDamage: 20,
    skills: {
      bladeAndParry: 15,
      shadowcraftAndEvasion: 15,
      arcaneLoreAndWards: 15,
    },
    perks: {
      armsman: false,
      silentRoll: false,
      resonantWard: false,
    },
  };

  public isDodging: boolean = false;
  public dodgeTimer: number = 0;
  public dodgeCooldownTimer: number = 0;
  public isParrying: boolean = false;
  public parryTimer: number = 0;
  public shadowCounterBuffTimer: number = 0;

  /** Host-supplied sweep targets. Optional: main.ts resolves damage via callbacks. */
  public targetProvider: (() => CombatTarget[]) | null = null;

  public readonly rig: MainCharacterRig;

  private readonly callbacks: CombatCallbacks;
  private readonly mixer: THREE.AnimationMixer | null;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private currentClip: string | null = null;

  private currentState: CombatState = 'Idle_Combat';
  private stateTime = 0;
  private stateDuration = COMBAT_TIMING.Idle_Combat.duration;

  private comboStep = 0;
  private bufferedAttack = false;
  private blockHeld = false;
  private spellFired = false;

  private aimYaw = 0;
  private moveSpeed = 0;
  private sprinting = false;
  private readonly dodgeDir = new THREE.Vector2(0, 1);
  private readonly pendingRootMotion = new THREE.Vector3();

  private readonly hitThisSwing = new Set<string>();
  private hitboxWasActive = false;

  private weaponTrail: WeaponTrail | null = null;
  private particles: CombatParticles | null = null;
  public equippedWeapon: EquippedWeapon | null = null;
  public equippedShield: EquippedShield | null = null;

  constructor(rig?: MainCharacterRig, callbacks: CombatCallbacks = {}) {
    this.rig = (rig ?? ({} as MainCharacterRig));
    this.callbacks = callbacks;

    const hasRig = !!rig && !!rig.group;
    if (hasRig) {
      const clips = rig.importedClips.length > 0
        ? rig.importedClips
        : Object.values(buildCombatClips());
      this.mixer = new THREE.AnimationMixer(rig.group);
      for (const clip of clips) {
        if (!clip?.name) continue;
        if (!this.actions.has(clip.name)) this.actions.set(clip.name, this.mixer.clipAction(clip));
      }
      this.playClip('Idle_Combat', true);
    } else {
      this.mixer = null;
    }
  }

  // ---------------------------------------------------------------- state API

  public get state(): CombatState {
    return this.currentState;
  }

  /** Progress through the current clip, 0..1. */
  public get normalizedTime(): number {
    if (this.stateDuration <= 0) return 0;
    return Math.min(1, Math.max(0, this.stateTime / this.stateDuration));
  }

  /** True while the player cannot steer (attack, dodge, block, stagger, cast). */
  public get busy(): boolean {
    return this.currentState !== 'Idle_Combat' && this.currentState !== 'Locomotion';
  }

  /** Melee hitbox is live only inside the authored swing apex. */
  public get hitboxActive(): boolean {
    const timing = COMBAT_TIMING[this.currentState as Exclude<CombatState, 'Locomotion'>];
    if (!timing?.hit) return false;
    return this.normalizedTime >= timing.hit[0] && this.normalizedTime <= timing.hit[1];
  }

  public get invulnerable(): boolean {
    return this.hasInvulnerabilityFrames;
  }

  public get comboIndex(): number {
    return this.comboStep;
  }

  private isAttackState(state: CombatState = this.currentState): state is AttackState {
    return (ATTACK_CHAIN as string[]).includes(state);
  }

  private isLoopingState(state: CombatState = this.currentState): boolean {
    return state === 'Idle_Combat' || state === 'Locomotion';
  }

  private clipNameFor(state: CombatState): string {
    if (state === 'Locomotion') {
      const runFirst = this.sprinting || this.moveSpeed > 0.55;
      const list = runFirst
        ? CLIP_CANDIDATES.Locomotion
        : ['Locomotion_Walk', 'walk', 'Locomotion_Run', 'run'];
      return list.find((n) => this.actions.has(n)) ?? list[0];
    }
    const list = CLIP_CANDIDATES[state] ?? ['Idle_Combat'];
    return list.find((n) => this.actions.has(n)) ?? 'Idle_Combat';
  }

  private playClip(state: CombatState, force = false): void {
    const name = this.clipNameFor(state);
    if (!force && name === this.currentClip) return;
    const action = this.actions.get(name);
    if (!action) return;

    for (const [otherName, other] of this.actions) {
      if (otherName !== name && other.isRunning()) other.fadeOut(0.1);
    }

    const loop = state === 'Idle_Combat' || state === 'Locomotion';
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.fadeIn(0.08).play();
    this.currentClip = name;
  }

  private setState(next: CombatState, duration?: number): void {
    this.currentState = next;
    this.stateTime = 0;
    const timing = COMBAT_TIMING[next as Exclude<CombatState, 'Locomotion'>];
    this.stateDuration = duration ?? timing?.duration ?? 0.6;
    this.hitThisSwing.clear();
    this.hitboxWasActive = false;
    this.spellFired = false;
    this.callbacks.onStateChange?.(next);
    this.playClip(next);
  }

  // -------------------------------------------------------------- public verbs

  public setAimYaw(yaw: number): void {
    this.aimYaw = yaw;
    if (this.isAttackState() && this.rig?.group) this.rig.group.rotation.y = yaw;
  }

  public setMove(x: number, z: number, sprint = false): void {
    this.moveSpeed = Math.hypot(x, z);
    this.sprinting = sprint;
    if (this.moveSpeed > 0.05) {
      if (this.currentState === 'Idle_Combat') this.setState('Locomotion');
    } else if (this.currentState === 'Locomotion') {
      this.setState('Idle_Combat');
    }
  }

  public pressAttack(_kind: 'light' | 'heavy' = 'light'): void {
    if (this.currentState === 'Dodge_Roll' || this.currentState === 'Hit_Stagger') return;

    if (this.isAttackState()) {
      // Buffer the input; the combo only advances inside the cancel window.
      this.bufferedAttack = true;
      return;
    }

    this.startAttack(1);
  }

  private startAttack(step: 1 | 2 | 3): void {
    this.comboStep = step;
    this.bufferedAttack = false;
    if (this.rig?.group) this.rig.group.rotation.y = this.aimYaw;
    this.setState(ATTACK_CHAIN[step - 1]);
  }

  public pressCast(): void {
    if (this.busy) return;
    this.setState('Arcane_Cast');
  }

  public setBlock(active: boolean): void {
    this.blockHeld = active;
    if (active) {
      if (this.currentState === 'Dodge_Roll') return;
      this.isParrying = true;
      this.parryTimer = PARRY_WINDOW_SECONDS;
      this.setState('Block_Parry');
    } else if (this.currentState === 'Block_Parry') {
      this.setState('Idle_Combat');
    }
    this.equippedShield?.setWardActive(active);
  }

  public pressDodge(dirX = 0, dirZ = 1): boolean {
    if (!this.tryStartDodge()) return false;
    const len = Math.hypot(dirX, dirZ) || 1;
    this.dodgeDir.set(dirX / len, dirZ / len);
    this.aimYaw = Math.atan2(this.dodgeDir.x, this.dodgeDir.y);
    if (this.rig?.group) this.rig.group.rotation.y = this.aimYaw;
    this.comboStep = 0;
    this.bufferedAttack = false;
    this.setState('Dodge_Roll', DODGE_DURATION);
    return true;
  }

  /** Resolve an incoming attack. Damage bookkeeping stays with the host. */
  public receiveHit(hit: IncomingHit = {}): IncomingHitResult {
    const kind = hit.kind ?? 'melee';

    if (this.hasInvulnerabilityFrames) {
      this.shadowCounterBuffTimer = 3.0;
      this.grantSkillXp('shadowcraftAndEvasion', 28);
      return 'evaded';
    }

    if (kind === 'spell' && this.currentState === 'Arcane_Cast') {
      const window = COMBAT_TIMING.Arcane_Cast.counter;
      if (!window || (this.normalizedTime >= window[0] && this.normalizedTime <= window[1])) {
        this.grantSkillXp('arcaneLoreAndWards', 24);
        return 'countered';
      }
    }

    if (this.isParrying) {
      this.isParrying = false;
      this.parryTimer = 0;
      this.grantSkillXp('bladeAndParry', 30);
      if (this.rpg.perks.resonantWard) {
        this.rpg.focus = Math.min(this.rpg.maxFocus, this.rpg.focus + 18);
      }
      return 'parried';
    }

    if (this.blockHeld) {
      this.grantSkillXp('bladeAndParry', 8);
      return 'blocked';
    }

    if (this.currentState !== 'Dodge_Roll') {
      this.comboStep = 0;
      this.bufferedAttack = false;
      this.setState('Hit_Stagger');
    }
    return 'hit';
  }

  public consumeRootMotion(): THREE.Vector3 {
    const out = this.pendingRootMotion.clone();
    this.pendingRootMotion.set(0, 0, 0);
    return out;
  }

  public attachWeaponTrail(trail: WeaponTrail | null): void {
    this.weaponTrail = trail;
    if (trail && this.equippedWeapon) trail.setWeapon(this.equippedWeapon);
  }

  public attachParticles(particles: CombatParticles | null): void {
    this.particles = particles;
  }

  public attachWeapon(weapon: EquippedWeapon | null): void {
    this.equippedWeapon = weapon;
    if (weapon && this.weaponTrail) this.weaponTrail.setWeapon(weapon);
  }

  public attachShield(shield: EquippedShield | null): void {
    this.equippedShield = shield;
  }

  /** Release animation/VFX resources (the host owns the rig itself). */
  public dispose(): void {
    this.mixer?.stopAllAction();
    if (this.mixer && this.rig?.group) this.mixer.uncacheRoot(this.rig.group);
    this.actions.clear();
    this.weaponTrail?.dispose();
    this.weaponTrail = null;
    this.particles = null;
  }

  // -------------------------------------------------------------- difficulty

  public setDifficulty(tier: DifficultyTierId): void {
    this.difficulty = SKYRIM_DIFFICULTY_PRESETS[tier];
  }

  public get hasInvulnerabilityFrames(): boolean {
    if (!this.isDodging) return false;
    const elapsed = DODGE_DURATION - this.dodgeTimer;
    const extraIframe = this.rpg.perks.silentRoll ? 0.08 : 0.0;
    return elapsed >= DODGE_IFRAME_START && elapsed <= DODGE_IFRAME_END + extraIframe;
  }

  public tryStartDodge(): boolean {
    const staminaCost = this.rpg.perks.silentRoll ? 16 : 22;
    if (this.isDodging || this.dodgeCooldownTimer > 0 || this.rpg.stamina < staminaCost) {
      return false;
    }
    this.rpg.stamina -= staminaCost;
    this.isDodging = true;
    this.dodgeTimer = DODGE_DURATION;
    this.grantSkillXp('shadowcraftAndEvasion', 14);
    return true;
  }

  public tryStartParry(): boolean {
    if (this.isDodging || this.rpg.stamina < 10) return false;
    this.isParrying = true;
    this.parryTimer = PARRY_WINDOW_SECONDS;
    return true;
  }

  public computePlayerStrike(kind: 'light' | 'heavy'): {
    rawDamage: number;
    poiseDamage: number;
    isCrit: boolean;
  } | null {
    const staminaCost = kind === 'heavy' ? 28 : 12;
    if (this.rpg.stamina < staminaCost) return null;
    this.rpg.stamina -= staminaCost;

    const skillMult = 1 + (this.rpg.skills.bladeAndParry - 15) * 0.015;
    const perkMult = this.rpg.perks.armsman ? 1.2 : 1.0;
    const heavyMult = kind === 'heavy' ? 1.95 : 1.0;
    const counterMult = this.shadowCounterBuffTimer > 0 ? 1.4 : 1.0;

    const critChance = 0.1 + (this.rpg.skills.shadowcraftAndEvasion - 15) * 0.004;
    const isCrit = Math.random() < critChance;
    const critMult = isCrit ? 1.65 : 1.0;

    const rawDamage = Math.round(
      this.rpg.baseAttackDamage *
        skillMult *
        perkMult *
        heavyMult *
        counterMult *
        critMult *
        this.difficulty.playerDamageMult
    );
    const poiseDamage = kind === 'heavy' ? 38 : 14;

    this.shadowCounterBuffTimer = 0;
    this.grantSkillXp('bladeAndParry', kind === 'heavy' ? 22 : 12);
    return { rawDamage, poiseDamage, isCrit };
  }

  public receiveEnemyAttack(
    enemyBaseDamage: number,
    attackType: 'light_parriable' | 'heavy_unblockable' | 'aoe_nova'
  ): { outcome: 'dodged_iframe' | 'parried' | 'hit'; damageTaken: number } {
    if (this.hasInvulnerabilityFrames) {
      this.shadowCounterBuffTimer = 3.0;
      this.grantSkillXp('shadowcraftAndEvasion', 28);
      return { outcome: 'dodged_iframe', damageTaken: 0 };
    }

    if (this.isParrying && attackType === 'light_parriable') {
      this.grantSkillXp('bladeAndParry', 30);
      if (this.rpg.perks.resonantWard) {
        this.rpg.focus = Math.min(this.rpg.maxFocus, this.rpg.focus + 18);
      }
      return { outcome: 'parried', damageTaken: 0 };
    }

    const mitigation = Math.min(0.8, this.rpg.armorRating * 0.0012);
    const damageTaken = Math.max(
      4,
      Math.round(enemyBaseDamage * this.difficulty.enemyDamageMult * (1 - mitigation))
    );
    this.rpg.hp = Math.max(0, this.rpg.hp - damageTaken);
    return { outcome: 'hit', damageTaken };
  }

  public grantSkillXp(skill: keyof PlayerRPGState['skills'], amount: number): boolean {
    this.rpg.skills[skill] += Math.max(1, Math.round(amount / 15));
    this.rpg.xp += amount;
    if (this.rpg.xp >= this.rpg.xpToNextLevel) {
      this.rpg.xp -= this.rpg.xpToNextLevel;
      this.rpg.level += 1;
      this.rpg.xpToNextLevel = Math.round(this.rpg.xpToNextLevel * 1.35);
      this.rpg.perkPoints += 1;
      this.rpg.maxHp += 25;
      this.rpg.hp = this.rpg.maxHp;
      this.rpg.maxStamina += 15;
      this.rpg.stamina = this.rpg.maxStamina;
      this.rpg.baseAttackDamage += 3;
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ update

  public update(dt: number): void {
    if (this.isDodging) {
      this.dodgeTimer -= dt;
      // Constant-speed roll; the host applies this through consumeRootMotion().
      const step = (DODGE_DISTANCE / DODGE_DURATION) * dt;
      this.pendingRootMotion.x += this.dodgeDir.x * step;
      this.pendingRootMotion.z += this.dodgeDir.y * step;
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
        this.dodgeCooldownTimer = DODGE_COOLDOWN;
      }
    } else if (this.dodgeCooldownTimer > 0) {
      this.dodgeCooldownTimer = Math.max(0, this.dodgeCooldownTimer - dt);
    }

    if (this.isParrying) {
      this.parryTimer -= dt;
      if (this.parryTimer <= 0) {
        this.isParrying = false;
      }
    }

    if (this.shadowCounterBuffTimer > 0) {
      this.shadowCounterBuffTimer = Math.max(0, this.shadowCounterBuffTimer - dt);
    }

    if (!this.isDodging) {
      this.rpg.stamina = Math.min(this.rpg.maxStamina, this.rpg.stamina + 18 * dt);
      this.rpg.focus = Math.min(this.rpg.maxFocus, this.rpg.focus + 8 * dt);
    }

    this.mixer?.update(dt);
    this.advanceState(dt);
    this.updateWindows(dt);
  }

  private advanceState(dt: number): void {
    if (this.isLoopingState()) {
      if (this.currentState === 'Locomotion') this.playClip('Locomotion');
      return;
    }

    this.stateTime += dt;
    const norm = this.normalizedTime;

    if (this.isAttackState()) {
      const timing = COMBAT_TIMING[this.currentState as keyof typeof COMBAT_TIMING];
      const cancelFrom = timing?.cancelFrom ?? 0.7;
      if (this.bufferedAttack && this.comboStep < 3 && norm >= cancelFrom) {
        this.startAttack((this.comboStep + 1) as 1 | 2 | 3);
        return;
      }
    }

    if (this.stateTime >= this.stateDuration) {
      if (this.currentState === 'Block_Parry' && this.blockHeld) {
        // Held guard: stay in the stance until the block is released.
        this.stateTime = this.stateDuration;
        return;
      }
      if (this.isAttackState() && this.bufferedAttack && this.comboStep < 3) {
        this.startAttack((this.comboStep + 1) as 1 | 2 | 3);
        return;
      }
      this.comboStep = 0;
      this.bufferedAttack = false;
      this.setState('Idle_Combat');
    }
  }

  private updateWindows(dt: number): void {
    const active = this.hitboxActive;

    if (active && !this.hitboxWasActive) {
      this.callbacks.onHitboxOpen?.(this.currentState);
      this.resolveHits();
    }
    this.hitboxWasActive = active;

    if (this.currentState === 'Arcane_Cast' && !this.spellFired) {
      const spawnAt = COMBAT_TIMING.Arcane_Cast.spawn ?? 0.4;
      if (this.normalizedTime >= spawnAt) {
        this.spellFired = true;
        this.fireSpell();
      }
    }

    const tier: 1 | 2 | 3 = this.comboStep >= 3 ? 3 : this.comboStep === 2 ? 2 : 1;
    this.weaponTrail?.update(dt, this.hitboxActive, this.isAttackState() ? tier : 1);
    this.particles?.update(dt);
  }

  private resolveHits(): void {
    if (!this.targetProvider || !this.rig?.group) return;

    const timing = COMBAT_TIMING[this.currentState as Exclude<CombatState, 'Locomotion'>];
    const reach = (timing?.hitRadius ?? 0.5) + 0.75;
    const group = this.rig.group;
    const forward = new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw));

    for (const target of this.targetProvider()) {
      if (this.hitThisSwing.has(target.id)) continue;
      const dx = target.position.x - group.position.x;
      const dz = target.position.z - group.position.z;
      const dy = target.position.y - group.position.y;
      if (dy < -1.2 || dy > 2.6) continue;
      const horizontal = Math.hypot(dx, dz);
      if (horizontal > reach + (target.radius ?? 0.5)) continue;
      if (horizontal > 1e-3 && forward.dot(new THREE.Vector3(dx / horizontal, 0, dz / horizontal)) < -0.35) {
        continue;
      }
      this.hitThisSwing.add(target.id);
      this.callbacks.onHit?.({
        target,
        state: this.currentState,
        damage: timing?.damage ?? 10,
        isFinisher: this.currentState === 'Heavy_Combo_Finisher',
      });
    }
  }

  private fireSpell(): void {
    const origin = new THREE.Vector3();
    this.rig?.spellOrigin?.getWorldPosition(origin);
    const direction = new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw));
    this.callbacks.onSpell?.({ origin, direction, state: this.currentState });
  }
}
