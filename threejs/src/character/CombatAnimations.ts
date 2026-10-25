import * as THREE from 'three';
import { BONE_NAMES, HIPS_REST_Y, type BoneName } from './MainCharacterRig';

export type CombatState =
  | 'Idle_Combat'
  | 'Locomotion'
  | 'Light_Attack_1'
  | 'Light_Attack_2'
  | 'Heavy_Combo_Finisher'
  | 'Arcane_Cast'
  | 'Dodge_Roll'
  | 'Block_Parry'
  | 'Hit_Stagger';

export type ClipName =
  | Exclude<CombatState, 'Locomotion'>
  | 'Locomotion_Walk'
  | 'Locomotion_Run'
  | 'Locomotion_StrafeL'
  | 'Locomotion_StrafeR';

/** Gameplay timing, all windows in NORMALISED clip time (0..1). */
export interface StateTiming {
  duration: number;
  /** Melee hitbox is live only inside this window (the swing apex). */
  hit?: [number, number];
  damage?: number;
  hitRadius?: number;
  knockback?: number;
  /** Invulnerability frames (dodge). */
  iframes?: [number, number];
  /** Frame at which a spell projectile is released. */
  spawn?: number;
  /** Incoming spells are reflected inside this window (Arcane_Cast counterspell). */
  counter?: [number, number];
  /** Perfect-block window (Block_Parry). */
  parry?: [number, number];
  /** Normalised time from which the next combo input / dodge cancel is accepted. */
  cancelFrom?: number;
}

export const COMBAT_TIMING: Record<Exclude<CombatState, 'Locomotion'>, StateTiming> = {
  Idle_Combat: { duration: 2.4 },
  Light_Attack_1: { duration: 0.6, hit: [0.25, 0.55], damage: 10, hitRadius: 0.35, knockback: 1.5, cancelFrom: 0.55 },
  Light_Attack_2: { duration: 0.65, hit: [0.28, 0.56], damage: 12, hitRadius: 0.35, knockback: 1.8, cancelFrom: 0.56 },
  Heavy_Combo_Finisher: { duration: 1.1, hit: [0.4, 0.62], damage: 28, hitRadius: 0.55, knockback: 4.5, cancelFrom: 0.7 },
  Arcane_Cast: { duration: 0.9, spawn: 0.4, counter: [0.15, 0.5], damage: 14, cancelFrom: 0.65 },
  Dodge_Roll: { duration: 0.65, iframes: [0.05, 0.6], cancelFrom: 1 },
  Block_Parry: { duration: 0.5, parry: [0, 0.3], cancelFrom: 0.3 },
  Hit_Stagger: { duration: 0.5, cancelFrom: 0.6 },
};

// --- Pose / keyframe authoring ----------------------------------------------

type V3 = [number, number, number];
/** Euler XYZ (radians) per bone relative to bind pose, plus a hips position offset. */
export type Pose = Partial<Record<BoneName, V3>> & { hipsPos?: V3 };
interface Key { t: number; pose: Pose }

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

/**
 * Bake keyframes into an AnimationClip. Every bone gets a track so crossfades
 * always return unspecified bones to the bind pose. Bind-pose rotation is identity.
 */
function clipFromKeys(name: string, duration: number, keys: Key[], includePosition = true): THREE.AnimationClip {
  const times = keys.map((k) => k.t * duration);
  const tracks: THREE.KeyframeTrack[] = [];
  for (const bone of BONE_NAMES) {
    if (bone === 'Root') continue;
    const values: number[] = [];
    for (const k of keys) {
      const r = k.pose[bone] ?? [0, 0, 0];
      _q.setFromEuler(_e.set(r[0], r[1], r[2], 'XYZ'));
      values.push(_q.x, _q.y, _q.z, _q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }
  if (includePosition) {
    const pv: number[] = [];
    for (const k of keys) {
      const p = k.pose.hipsPos ?? [0, 0, 0];
      pv.push(p[0], HIPS_REST_Y + p[1], p[2]);
    }
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, pv));
  }
  return new THREE.AnimationClip(name, duration, tracks);
}

function sampled(name: string, duration: number, steps: number, fn: (phase: number) => Pose): THREE.AnimationClip {
  const keys: Key[] = [];
  for (let i = 0; i <= steps; i++) keys.push({ t: i / steps, pose: fn(i === steps ? 0 : i / steps) }); // last == first => seamless loop
  return clipFromKeys(name, duration, keys);
}

const R = (deg: number) => (deg * Math.PI) / 180;
const merge = (...p: Pose[]): Pose => Object.assign({}, ...p);

/** Combat guard: blade hand forward-right, spell hand forward-left, staggered stance. */
const GUARD: Pose = {
  Hips: [0.06, 0, 0],
  hipsPos: [0, -0.06, 0],
  Spine: [0.05, 0, 0],
  Chest: [0.03, 0, 0],
  Head: [-0.08, 0, 0],
  RightUpperArm: [-0.75, 0.2, -0.2],
  RightLowerArm: [-1.3, 0, 0],
  LeftUpperArm: [-0.6, -0.2, 0.25],
  LeftLowerArm: [-1.4, 0, 0],
  LeftUpperLeg: [-0.3, 0, 0.06],
  LeftLowerLeg: [0.4, 0, 0],
  LeftFoot: [-0.1, 0, 0],
  RightUpperLeg: [0.2, 0, -0.06],
  RightLowerLeg: [0.3, 0, 0],
};

// --- Clips ------------------------------------------------------------------

function idleCombat(): THREE.AnimationClip {
  // 2.4s loop: breathing (2 cycles) + one rhythmic weight shift left<->right.
  return sampled('Idle_Combat', COMBAT_TIMING.Idle_Combat.duration, 12, (p) => {
    const breath = Math.sin(p * Math.PI * 4);
    const shift = Math.sin(p * Math.PI * 2);
    return merge(GUARD, {
      hipsPos: [shift * 0.03, -0.06 + breath * 0.008, 0],
      Hips: [0.06, 0, shift * 0.04],
      Spine: [0.05 + breath * 0.015, 0, -shift * 0.03],
      Chest: [0.03 + breath * 0.025, 0, 0],
      Head: [-0.08 - breath * 0.01, 0, shift * 0.02],
      RightUpperArm: [-0.75 + breath * 0.02, 0.2, -0.2],
      LeftUpperArm: [-0.6 + breath * 0.02, -0.2, 0.25],
      LeftUpperLeg: [-0.3, 0, 0.06 + shift * 0.02],
      RightUpperLeg: [0.2, 0, -0.06 + shift * 0.02],
    });
  });
}

function gait(name: string, duration: number, amp: number, knee: number, armAmp: number, lean: number, bob: number, side = 0): THREE.AnimationClip {
  return sampled(name, duration, 12, (p) => {
    const a = p * Math.PI * 2;
    const s = Math.sin(a);
    const lKnee = Math.max(0, Math.cos(a + 0.6)) * knee;
    const rKnee = Math.max(0, Math.cos(a + Math.PI + 0.6)) * knee;
    return merge(GUARD, {
      Hips: [0.06 + lean * 0.5, -s * 0.1 * (1 + side), 0],
      hipsPos: [0, -0.04 - bob * (0.5 + 0.5 * Math.cos(2 * a)), 0],
      Spine: [0.05 + lean * 0.5, s * 0.1, 0],
      Chest: [0.03, s * 0.08, 0],
      LeftUpperLeg: side ? [-0.1 * s, 0, 0.06 + side * 0.4 * s] : [-s * amp, 0, 0.06],
      RightUpperLeg: side ? [0.1 * s, 0, -0.06 + side * 0.4 * s] : [s * amp, 0, -0.06],
      LeftLowerLeg: [lKnee, 0, 0],
      RightLowerLeg: [rKnee, 0, 0],
      LeftFoot: [-lKnee * 0.3, 0, 0],
      RightFoot: [-rKnee * 0.3, 0, 0],
      LeftUpperArm: [-0.6 + s * armAmp, -0.2, 0.25],
      RightUpperArm: [-0.75 - s * armAmp, 0.2, -0.2],
    });
  });
}

function lightAttack1(): THREE.AnimationClip {
  // Right-to-left diagonal slash. Apex (hit window) 0.25..0.55.
  return clipFromKeys('Light_Attack_1', COMBAT_TIMING.Light_Attack_1.duration, [
    { t: 0, pose: GUARD },
    { t: 0.18, pose: merge(GUARD, { Spine: [0.0, -0.55, 0], Chest: [0, -0.35, 0], Hips: [0.0, -0.2, 0], hipsPos: [0, -0.06, -0.05],
      RightUpperArm: [-2.3, 0.3, -0.9], RightLowerArm: [-0.9, 0, 0], Head: [-0.05, 0.3, 0] }) },
    { t: 0.38, pose: merge(GUARD, { Spine: [0.15, 0.6, 0], Chest: [0.1, 0.35, 0], Hips: [0.1, 0.25, 0], hipsPos: [0, -0.12, 0.14],
      RightUpperArm: [-1.35, -0.5, 0.2], RightLowerArm: [-0.25, 0, 0], Head: [-0.05, -0.3, 0],
      LeftUpperLeg: [-0.75, 0, 0.06], LeftLowerLeg: [0.7, 0, 0], RightUpperLeg: [0.45, 0, -0.06] }) },
    { t: 0.55, pose: merge(GUARD, { Spine: [0.12, 0.7, 0], Chest: [0.08, 0.4, 0], hipsPos: [0, -0.12, 0.16],
      RightUpperArm: [-1.1, -0.8, 0.3], RightLowerArm: [-0.2, 0, 0], LeftUpperLeg: [-0.75, 0, 0.06], LeftLowerLeg: [0.7, 0, 0] }) },
    { t: 1, pose: GUARD },
  ]);
}

function lightAttack2(): THREE.AnimationClip {
  // Left-to-right backhand return slash.
  return clipFromKeys('Light_Attack_2', COMBAT_TIMING.Light_Attack_2.duration, [
    { t: 0, pose: GUARD },
    { t: 0.2, pose: merge(GUARD, { Spine: [0, 0.6, 0], Chest: [0, 0.35, 0], hipsPos: [0, -0.08, -0.04],
      RightUpperArm: [-1.0, 0.7, 0.5], RightLowerArm: [-0.6, 0, 0], Head: [-0.05, -0.3, 0] }) },
    { t: 0.4, pose: merge(GUARD, { Spine: [0.1, -0.65, 0], Chest: [0.05, -0.4, 0], Hips: [0.1, -0.25, 0], hipsPos: [0, -0.12, 0.12],
      RightUpperArm: [-1.5, -0.4, -1.3], RightLowerArm: [-0.15, 0, 0], Head: [-0.05, 0.3, 0],
      RightUpperLeg: [-0.7, 0, -0.06], RightLowerLeg: [0.6, 0, 0], LeftUpperLeg: [0.4, 0, 0.06] }) },
    { t: 0.56, pose: merge(GUARD, { Spine: [0.1, -0.75, 0], Chest: [0.05, -0.45, 0], hipsPos: [0, -0.12, 0.14],
      RightUpperArm: [-1.4, -0.6, -1.5], RightLowerArm: [-0.1, 0, 0], RightUpperLeg: [-0.7, 0, -0.06], RightLowerLeg: [0.6, 0, 0] }) },
    { t: 1, pose: GUARD },
  ]);
}

function heavyFinisher(): THREE.AnimationClip {
  // Two-handed overhead slam. Longer wind-up, big lunge. Apex 0.4..0.62.
  const twoHand: Pose = { LeftUpperArm: [-2.7, 0, 0.15], LeftLowerArm: [-0.8, 0, 0] };
  return clipFromKeys('Heavy_Combo_Finisher', COMBAT_TIMING.Heavy_Combo_Finisher.duration, [
    { t: 0, pose: GUARD },
    { t: 0.3, pose: merge(GUARD, twoHand, { Hips: [-0.1, 0, 0], hipsPos: [0, -0.02, -0.08], Spine: [-0.35, 0, 0], Chest: [-0.25, 0, 0],
      RightUpperArm: [-2.9, 0, -0.2], RightLowerArm: [-0.9, 0, 0], Head: [-0.3, 0, 0] }) },
    { t: 0.44, pose: merge(GUARD, twoHand, { Hips: [0.3, 0, 0], hipsPos: [0, -0.2, 0.22], Spine: [0.55, 0, 0], Chest: [0.4, 0, 0],
      RightUpperArm: [-0.95, 0, -0.1], RightLowerArm: [-0.2, 0, 0], LeftUpperArm: [-0.9, 0, 0.1], LeftLowerArm: [-0.3, 0, 0], Head: [0.15, 0, 0],
      LeftUpperLeg: [-1.0, 0, 0.06], LeftLowerLeg: [1.0, 0, 0], RightUpperLeg: [0.6, 0, -0.06], RightLowerLeg: [0.5, 0, 0] }) },
    { t: 0.62, pose: merge(GUARD, { Hips: [0.3, 0, 0], hipsPos: [0, -0.22, 0.24], Spine: [0.6, 0, 0], Chest: [0.4, 0, 0],
      RightUpperArm: [-0.85, 0, -0.1], RightLowerArm: [-0.1, 0, 0], LeftUpperArm: [-0.8, 0, 0.2], LeftLowerArm: [-0.3, 0, 0],
      LeftUpperLeg: [-1.0, 0, 0.06], LeftLowerLeg: [1.0, 0, 0], RightUpperLeg: [0.6, 0, -0.06], RightLowerLeg: [0.5, 0, 0] }) },
    { t: 1, pose: GUARD },
  ]);
}

function arcaneCast(): THREE.AnimationClip {
  // Left palm thrust; spell released at 0.4. Counterspell window 0.15..0.5.
  return clipFromKeys('Arcane_Cast', COMBAT_TIMING.Arcane_Cast.duration, [
    { t: 0, pose: GUARD },
    { t: 0.22, pose: merge(GUARD, { Chest: [-0.12, 0.2, 0], Spine: [-0.05, 0.15, 0], hipsPos: [0, -0.04, -0.05],
      LeftUpperArm: [-0.9, 0, 0.7], LeftLowerArm: [-1.8, 0, 0], Head: [-0.12, 0, 0] }) },
    { t: 0.4, pose: merge(GUARD, { Chest: [0.08, -0.15, 0], Spine: [0.1, -0.1, 0], hipsPos: [0, -0.1, 0.08],
      LeftUpperArm: [-1.55, 0, 0.05], LeftLowerArm: [-0.1, 0, 0], LeftHand: [-0.3, 0, 0], Head: [0, 0, 0],
      LeftUpperLeg: [-0.6, 0, 0.06], LeftLowerLeg: [0.6, 0, 0] }) },
    { t: 0.6, pose: merge(GUARD, { Chest: [0.06, -0.12, 0], hipsPos: [0, -0.1, 0.07], LeftUpperArm: [-1.5, 0, 0.1], LeftLowerArm: [-0.15, 0, 0],
      LeftUpperLeg: [-0.55, 0, 0.06], LeftLowerLeg: [0.55, 0, 0] }) },
    { t: 1, pose: GUARD },
  ]);
}

function dodgeRoll(): THREE.AnimationClip {
  // Full forward tumble: hips rotate 360deg about X in 90deg slerp steps.
  const tuck: Pose = {
    Spine: [0.6, 0, 0], Chest: [0.4, 0, 0], Head: [0.5, 0, 0],
    LeftUpperLeg: [-1.6, 0, 0.1], LeftLowerLeg: [1.9, 0, 0], RightUpperLeg: [-1.6, 0, -0.1], RightLowerLeg: [1.9, 0, 0],
    LeftUpperArm: [-0.9, 0, 0.3], LeftLowerArm: [-1.6, 0, 0], RightUpperArm: [-0.9, 0, -0.3], RightLowerArm: [-1.6, 0, 0],
  };
  const spin = (deg: number, y: number): Pose => merge(tuck, { Hips: [R(deg), 0, 0], hipsPos: [0, y, 0] });
  return clipFromKeys('Dodge_Roll', COMBAT_TIMING.Dodge_Roll.duration, [
    { t: 0, pose: GUARD },
    { t: 0.12, pose: merge(tuck, { Hips: [R(20), 0, 0], hipsPos: [0, -0.25, 0.05] }) },
    { t: 0.3, pose: spin(110, -0.38) },
    { t: 0.45, pose: spin(200, -0.4) },
    { t: 0.6, pose: spin(300, -0.3) },
    { t: 0.78, pose: merge(GUARD, { Hips: [R(360), 0, 0], hipsPos: [0, -0.2, 0.05], Spine: [0.3, 0, 0],
      LeftUpperLeg: [-1.0, 0, 0.06], LeftLowerLeg: [1.2, 0, 0], RightUpperLeg: [-0.5, 0, -0.06], RightLowerLeg: [0.9, 0, 0] }) },
    { t: 1, pose: merge(GUARD, { Hips: [R(360) + 0.06, 0, 0] }) },
  ]);
}

function blockParry(): THREE.AnimationClip {
  // Blade raised across the body. Parry flash 0..0.3 then holds the guard.
  const block: Pose = merge(GUARD, { Spine: [0.1, 0.25, 0], Chest: [0.08, 0.2, 0], hipsPos: [0, -0.1, -0.02],
    RightUpperArm: [-1.4, 0.7, 0.25], RightLowerArm: [-1.5, 0, 0], LeftUpperArm: [-1.2, 0.2, 0.4], LeftLowerArm: [-1.6, 0, 0],
    Head: [0.05, -0.15, 0], LeftUpperLeg: [-0.4, 0, 0.06], LeftLowerLeg: [0.55, 0, 0] });
  return clipFromKeys('Block_Parry', COMBAT_TIMING.Block_Parry.duration, [
    { t: 0, pose: GUARD },
    { t: 0.12, pose: merge(block, { RightUpperArm: [-1.7, 0.9, 0.0], Chest: [0.0, 0.35, 0] }) }, // parry flick
    { t: 0.3, pose: block },
    { t: 1, pose: block },
  ]);
}

function hitStagger(): THREE.AnimationClip {
  const hit: Pose = merge(GUARD, { Hips: [-0.15, 0, 0.1], hipsPos: [0, -0.08, -0.15], Spine: [-0.35, 0.1, 0.1], Chest: [-0.3, 0, 0.05],
    Head: [-0.45, 0, 0.1], RightUpperArm: [-0.3, 0.3, -0.7], RightLowerArm: [-0.6, 0, 0], LeftUpperArm: [-0.2, 0, 0.8], LeftLowerArm: [-0.5, 0, 0],
    LeftUpperLeg: [0.2, 0, 0.06], LeftLowerLeg: [0.2, 0, 0], RightUpperLeg: [-0.4, 0, -0.06], RightLowerLeg: [0.3, 0, 0] });
  return clipFromKeys('Hit_Stagger', COMBAT_TIMING.Hit_Stagger.duration, [
    { t: 0, pose: GUARD },
    { t: 0.15, pose: hit },
    { t: 0.45, pose: merge(hit, { Spine: [-0.2, 0.05, 0.05], Chest: [-0.15, 0, 0], Head: [-0.25, 0, 0] }) },
    { t: 1, pose: GUARD },
  ]);
}

/**
 * Build the full procedural combat clip library.
 * @param stripPositions drop the Hips position track (use with imported rigs whose hips differ).
 */
export function buildCombatClips(stripPositions = false): Record<ClipName, THREE.AnimationClip> {
  const clips: Record<ClipName, THREE.AnimationClip> = {
    Idle_Combat: idleCombat(),
    Locomotion_Walk: gait('Locomotion_Walk', 1.0, 0.55, 0.9, 0.15, 0.04, 0.02),
    Locomotion_Run: gait('Locomotion_Run', 0.62, 0.95, 1.5, 0.45, 0.22, 0.05),
    Locomotion_StrafeL: gait('Locomotion_StrafeL', 0.9, 0, 0.7, 0.05, 0.03, 0.02, 1),
    Locomotion_StrafeR: gait('Locomotion_StrafeR', 0.9, 0, 0.7, 0.05, 0.03, 0.02, -1),
    Light_Attack_1: lightAttack1(),
    Light_Attack_2: lightAttack2(),
    Heavy_Combo_Finisher: heavyFinisher(),
    Arcane_Cast: arcaneCast(),
    Dodge_Roll: dodgeRoll(),
    Block_Parry: blockParry(),
    Hit_Stagger: hitStagger(),
  };
  if (stripPositions) {
    for (const c of Object.values(clips)) c.tracks = c.tracks.filter((t) => t.name !== 'Hips.position');
  }
  return clips;
}
