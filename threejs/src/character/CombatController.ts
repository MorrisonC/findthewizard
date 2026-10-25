import * as THREE from 'three';
import type { MainCharacterRig } from './MainCharacterRig';
import { COMBAT_TIMING, buildCombatClips, type ClipName, type CombatState, type StateTiming } from './CombatAnimations';

export const CROSSFADE_SECONDS = 0.15;
const INPUT_BUFFER_SECONDS = 0.35;
const DODGE_COOLDOWN = 0.2;
const DODGE_DISTANCE = 3.2;
/** Fraction of the dodge clip over which the directional impulse is applied. */
const DODGE_MOVE_SPAN: [number, number] = [0.05, 0.7];
const BLOCK_DAMAGE_SCALE = 0.25;

export interface CombatTarget {
  id: string;
  /** World position (updated by the owner). */
  position: THREE.Vector3;
  radius: number;
}

export interface HitEvent {
  target: CombatTarget;
  damage: number;
  knockback: number;
  state: CombatState;
  /** World-space push direction (horizontal, normalised). */
  direction: THREE.Vector3;
}

export interface SpellEvent {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  damage: number;
}

export interface IncomingHit {
  damage: number;
  kind?: 'melee' | 'spell';
  /** World direction the attack travels (attacker -> player). Optional. */
  direction?: THREE.Vector3;
}
export type HitOutcome = 'hit' | 'blocked' | 'parried' | 'evaded' | 'countered';

export interface CombatCallbacks {
  onHit?: (e: HitEvent) => void;
  /** Fired once per swing when the hitbox window (normalised clip time) opens. */
  onHitboxOpen?: (state: CombatState) => void;
  onSpell?: (e: SpellEvent) => void;
  onStateChange?: (next: CombatState, prev: CombatState) => void;
  /** Fired when the player is damaged for real (state became Hit_Stagger). */
  onDamaged?: (damage: number) => void;
  onParry?: () => void;
  onCounter?: () => void;
}

const COMBO: CombatState[] = ['Light_Attack_1', 'Light_Attack_2', 'Heavy_Combo_Finisher'];
const isAttack = (s: CombatState) => COMBO.includes(s);

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _ap = new THREE.Vector3();

function segmentPointDistance(p0: THREE.Vector3, p1: THREE.Vector3, c: THREE.Vector3): number {
  _ab.subVectors(p1, p0);
  _ap.subVectors(c, p0);
  const len2 = _ab.lengthSq();
  const t = len2 > 1e-8 ? THREE.MathUtils.clamp(_ap.dot(_ab) / len2, 0, 1) : 0;
  return _b.copy(p0).addScaledVector(_ab, t).distanceTo(c);
}

const inWindow = (n: number, w?: [number, number]) => !!w && n >= w[0] && n <= w[1];
const smooth = (x: number) => { const t = THREE.MathUtils.clamp(x, 0, 1); return t * t * (3 - 2 * t); };

/**
 * Combat animation state machine.
 *
 * Owns an AnimationMixer on `rig.group`, crossfades between states over 0.15s,
 * buffers combo input, gates hitboxes by *normalised clip time* and exposes
 * i-frames + dodge root motion. Call `update(dt)` once per frame.
 */
export class CombatController {
  readonly mixer: THREE.AnimationMixer;
  readonly callbacks: CombatCallbacks;
  readonly clips: Record<ClipName, THREE.AnimationClip>;
  private actions = new Map<ClipName, THREE.AnimationAction>();

  state: CombatState = 'Idle_Combat';
  private clipName: ClipName = 'Idle_Combat';
  private action: THREE.AnimationAction;

  /** Multiplies attack/cast clip speed; hit windows are normalised so they scale too. */
  attackSpeed = 1;
  /** Supplies currently attackable targets (world-space). */
  targetProvider: () => CombatTarget[] = () => [];

  // input
  private bufAttack = 0;
  private bufCast = 0;
  private bufDodge = 0;
  private dodgeDir = new THREE.Vector3();
  private blockHeld = false;
  private move = new THREE.Vector2();
  private run = false;
  private strafe = 0;
  private aimYaw: number | null = null;

  // combat bookkeeping
  private comboIndex = 0;
  private dodgeCooldown = 0;
  private blockTime = 0;
  private spawned = false;
  private hitSet = new Set<string>();
  private hitboxWasActive = false;
  private prevAnchor = new THREE.Vector3();
  private curAnchor = new THREE.Vector3();
  private lastDodgeN = 0;
  private rootDelta = new THREE.Vector3();
  private _hitboxActive = false;

  constructor(readonly rig: MainCharacterRig, callbacks: CombatCallbacks = {}, clips?: Partial<Record<ClipName, THREE.AnimationClip>>) {
    this.callbacks = callbacks;
    const procedural = buildCombatClips(rig.source === 'imported');
    const imported = new Map(rig.importedClips.map((c) => [c.name.toLowerCase(), c]));
    this.clips = { ...procedural };
    for (const key of Object.keys(procedural) as ClipName[]) {
      const authored = imported.get(key.toLowerCase());
      if (authored) this.clips[key] = authored; // artist clips override procedural ones
    }
    Object.assign(this.clips, clips);

    this.mixer = new THREE.AnimationMixer(rig.group);
    for (const [name, clip] of Object.entries(this.clips) as [ClipName, THREE.AnimationClip][]) {
      const a = this.mixer.clipAction(clip);
      if (name.startsWith('Locomotion') || name === 'Idle_Combat') {
        a.setLoop(THREE.LoopRepeat, Infinity);
      } else {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions.set(name, a);
    }
    this.action = this.actions.get('Idle_Combat')!;
    this.action.play();
  }

  // ---- input API -----------------------------------------------------------

  /** Camera-relative or world move intent already converted to world XZ. */
  setMove(x: number, z: number, run = false, strafe = 0): void {
    this.move.set(x, z);
    this.run = run;
    this.strafe = strafe;
  }
  /** Facing used when an attack / cast / dodge begins. */
  setAimYaw(yaw: number | null): void { this.aimYaw = yaw; }
  pressAttack(): void { this.bufAttack = INPUT_BUFFER_SECONDS; }
  pressCast(): void { this.bufCast = INPUT_BUFFER_SECONDS; }
  /** Direction defaults to the current move intent, else backwards. */
  pressDodge(dirX?: number, dirZ?: number): void {
    this.bufDodge = INPUT_BUFFER_SECONDS;
    if (dirX !== undefined && dirZ !== undefined && (dirX || dirZ)) this.dodgeDir.set(dirX, 0, dirZ);
    else if (this.move.lengthSq() > 0.01) this.dodgeDir.set(this.move.x, 0, this.move.y);
    else this.dodgeDir.set(0, 0, 0);
  }
  setBlock(held: boolean): void { this.blockHeld = held; }

  // ---- queries -------------------------------------------------------------

  get normalizedTime(): number {
    const d = this.action.getClip().duration;
    return d > 0 ? THREE.MathUtils.clamp(this.action.time / d, 0, 1) : 0;
  }
  get hitboxActive(): boolean { return this._hitboxActive; }
  get invulnerable(): boolean {
    return this.state === 'Dodge_Roll' && inWindow(this.normalizedTime, COMBAT_TIMING.Dodge_Roll.iframes);
  }
  /** True while a committed action prevents free movement. */
  get busy(): boolean { return this.state !== 'Idle_Combat' && this.state !== 'Locomotion'; }
  /** World-space displacement from dodge root motion accumulated since last call. Feed to physics.movePlayer(). */
  consumeRootMotion(out = new THREE.Vector3()): THREE.Vector3 {
    out.copy(this.rootDelta);
    this.rootDelta.set(0, 0, 0);
    return out;
  }
  get forward(): THREE.Vector3 {
    const y = this.rig.group.rotation.y;
    return new THREE.Vector3(Math.sin(y), 0, Math.cos(y));
  }

  /** Resolve an incoming enemy attack against the current state. */
  receiveHit(hit: IncomingHit): HitOutcome {
    const kind = hit.kind ?? 'melee';
    if (this.invulnerable) return 'evaded';
    if (kind === 'spell' && this.state === 'Arcane_Cast' && inWindow(this.normalizedTime, COMBAT_TIMING.Arcane_Cast.counter)) {
      this.callbacks.onCounter?.();
      return 'countered';
    }
    if (this.state === 'Block_Parry') {
      if (inWindow(this.blockTime / COMBAT_TIMING.Block_Parry.duration, COMBAT_TIMING.Block_Parry.parry)) {
        this.callbacks.onParry?.();
        return 'parried';
      }
      this.callbacks.onDamaged?.(hit.damage * BLOCK_DAMAGE_SCALE);
      return 'blocked';
    }
    this.callbacks.onDamaged?.(hit.damage);
    this.enter('Hit_Stagger');
    return 'hit';
  }

  // ---- update --------------------------------------------------------------

  update(dt: number): void {
    this.bufAttack = Math.max(0, this.bufAttack - dt);
    this.bufCast = Math.max(0, this.bufCast - dt);
    this.bufDodge = Math.max(0, this.bufDodge - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);

    this.mixer.update(dt);
    if (this.state === 'Block_Parry') this.blockTime += dt;
    const n = this.normalizedTime;
    const t = COMBAT_TIMING[this.state === 'Locomotion' ? 'Idle_Combat' : this.state] as StateTiming;

    switch (this.state) {
      case 'Idle_Combat':
      case 'Locomotion':
        if (!this.startBufferedAction()) this.syncLocomotion();
        break;
      case 'Light_Attack_1':
      case 'Light_Attack_2':
      case 'Heavy_Combo_Finisher':
        if (n >= (t.cancelFrom ?? 1)) {
          if (this.tryDodge()) break;
          const next = COMBO[this.comboIndex + 1];
          if (next && this.bufAttack > 0) { this.bufAttack = 0; this.comboIndex++; this.enter(next); break; }
        }
        if (n >= 0.98) this.exitToFree();
        break;
      case 'Arcane_Cast':
        if (!this.spawned && n >= (t.spawn ?? 1)) this.releaseSpell();
        if (n >= (t.cancelFrom ?? 1) && this.tryDodge()) break;
        if (n >= 0.98) this.exitToFree();
        break;
      case 'Dodge_Roll':
        this.applyDodgeMotion(n);
        if (n >= 0.98) this.exitToFree();
        break;
      case 'Block_Parry':
        if (this.tryDodge()) break;
        if (this.bufAttack > 0 && this.blockTime > 0.3) { this.enter('Light_Attack_1'); this.comboIndex = 0; this.bufAttack = 0; break; }
        if (!this.blockHeld && this.blockTime > 0.12) this.exitToFree();
        break;
      case 'Hit_Stagger':
        if (n >= (t.cancelFrom ?? 1) && this.tryDodge()) break;
        if (n >= 0.98) this.exitToFree();
        break;
    }
    this.updateHitbox();
  }

  // ---- internals -----------------------------------------------------------

  private startBufferedAction(): boolean {
    if (this.tryDodge()) return true;
    if (this.bufAttack > 0) { this.bufAttack = 0; this.comboIndex = 0; this.enter('Light_Attack_1'); return true; }
    if (this.bufCast > 0) { this.bufCast = 0; this.enter('Arcane_Cast'); return true; }
    if (this.blockHeld) { this.enter('Block_Parry'); return true; }
    return false;
  }

  private tryDodge(): boolean {
    if (this.bufDodge <= 0 || this.dodgeCooldown > 0) return false;
    this.bufDodge = 0;
    if (this.dodgeDir.lengthSq() < 1e-4) this.dodgeDir.copy(this.forward).negate(); // backstep when idle
    this.dodgeDir.normalize();
    this.enter('Dodge_Roll');
    return true;
  }

  private exitToFree(): void {
    this.comboIndex = 0;
    this.enter(this.move.lengthSq() > 0.01 ? 'Locomotion' : 'Idle_Combat');
  }

  private syncLocomotion(): void {
    const moving = this.move.lengthSq() > 0.01;
    const want: CombatState = moving ? 'Locomotion' : 'Idle_Combat';
    if (this.state !== want) this.enter(want);
    else if (moving && this.pickGait() !== this.clipName) this.setClip(this.pickGait()); // gait change within Locomotion
  }

  private pickGait(): ClipName {
    if (Math.abs(this.strafe) > 0.5) return this.strafe < 0 ? 'Locomotion_StrafeL' : 'Locomotion_StrafeR';
    return this.run ? 'Locomotion_Run' : 'Locomotion_Walk';
  }

  private enter(next: CombatState): void {
    const prev = this.state;
    if (next === prev && !isAttack(next) && next !== 'Hit_Stagger') return;
    this.state = next;
    this.blockTime = 0;
    this.spawned = false;
    this.hitSet.clear();
    this.hitboxWasActive = false;
    this._hitboxActive = false;
    this.lastDodgeN = 0;
    this.rootDelta.set(0, 0, 0);

    if (next === 'Dodge_Roll') {
      this.dodgeCooldown = DODGE_COOLDOWN + COMBAT_TIMING.Dodge_Roll.duration;
      this.rig.group.rotation.y = Math.atan2(this.dodgeDir.x, this.dodgeDir.z);
    } else if ((isAttack(next) || next === 'Arcane_Cast') && this.aimYaw !== null) {
      this.rig.group.rotation.y = this.aimYaw;
    }
    const speed = isAttack(next) || next === 'Arcane_Cast' ? this.attackSpeed : 1;
    this.setClip(next === 'Locomotion' ? this.pickGait() : (next as ClipName), speed);
    this.callbacks.onStateChange?.(next, prev);
  }

  /** Crossfade (0.15s) to a clip. Foot phase is preserved between gait clips. */
  private setClip(name: ClipName, timeScale = 1): void {
    const next = this.actions.get(name)!;
    const prev = this.action;
    const gaitSwap = name.startsWith('Locomotion') && this.clipName.startsWith('Locomotion');
    const phase = gaitSwap ? prev.time / prev.getClip().duration : 0;
    next.reset();
    next.setEffectiveTimeScale(timeScale);
    next.setEffectiveWeight(1);
    if (gaitSwap) next.time = phase * next.getClip().duration;
    next.play();
    if (prev !== next) prev.crossFadeTo(next, CROSSFADE_SECONDS, false);
    this.action = next;
    this.clipName = name;
  }

  private applyDodgeMotion(n: number): void {
    const [a, b] = DODGE_MOVE_SPAN;
    const f0 = smooth((this.lastDodgeN - a) / (b - a));
    const f1 = smooth((n - a) / (b - a));
    this.lastDodgeN = n;
    this.rootDelta.addScaledVector(this.dodgeDir, (f1 - f0) * DODGE_DISTANCE);
  }

  private releaseSpell(): void {
    this.spawned = true;
    const origin = this.rig.spellOrigin.getWorldPosition(new THREE.Vector3());
    this.callbacks.onSpell?.({ origin, direction: this.forward, damage: COMBAT_TIMING.Arcane_Cast.damage ?? 0 });
  }

  /** Hit detection: only inside the state's normalised-time window, swept from last frame's blade position. */
  private updateHitbox(): void {
    const t = COMBAT_TIMING[this.state === 'Locomotion' ? 'Idle_Combat' : this.state] as StateTiming;
    const active = isAttack(this.state) && inWindow(this.normalizedTime, t.hit);
    this._hitboxActive = active;
    if (!active) { this.hitboxWasActive = false; return; }

    this.rig.group.updateMatrixWorld(true);
    this.rig.hitboxAnchor.getWorldPosition(this.curAnchor);
    if (!this.hitboxWasActive) {
      this.prevAnchor.copy(this.curAnchor);
      this.hitboxWasActive = true;
      this.callbacks.onHitboxOpen?.(this.state);
    }

    const radius = t.hitRadius ?? 0.35;
    for (const target of this.targetProvider()) {
      if (this.hitSet.has(target.id)) continue;
      if (segmentPointDistance(this.prevAnchor, this.curAnchor, target.position) > radius + target.radius) continue;
      this.hitSet.add(target.id);
      const dir = _a.subVectors(target.position, this.rig.group.position).setY(0);
      if (dir.lengthSq() < 1e-6) dir.copy(this.forward);
      this.callbacks.onHit?.({
        target,
        damage: t.damage ?? 0,
        knockback: t.knockback ?? 0,
        state: this.state,
        direction: dir.clone().normalize(),
      });
    }
    this.prevAnchor.copy(this.curAnchor);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.rig.group);
  }
}
