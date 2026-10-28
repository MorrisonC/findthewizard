import * as THREE from 'three';

/**
 * Canonical humanoid bone names. Procedural characters are built with exactly
 * these names, and imported GLB/FBX skeletons are renamed to them (see
 * `bindImportedRig`) so one set of animation clips drives both.
 *
 * Convention: Y-up, character faces +Z (matches `sin(yaw), cos(yaw)` used by
 * main.ts). The character's RIGHT side is therefore -X.
 */
export const BONE_NAMES = [
  'Root', 'Hips', 'Spine', 'Chest', 'Head',
  'LeftShoulder', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand',
  'RightShoulder', 'RightUpperArm', 'RightLowerArm', 'RightHand',
  'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot',
  'RightUpperLeg', 'RightLowerLeg', 'RightFoot',
] as const;
export type BoneName = (typeof BONE_NAMES)[number];

export const HIPS_REST_Y = 0.98;

type V3 = [number, number, number];
export const BONE_DEFS: ReadonlyArray<readonly [BoneName, BoneName | null, V3]> = [
  ['Root', null, [0, 0, 0]],
  ['Hips', 'Root', [0, HIPS_REST_Y, 0]],
  ['Spine', 'Hips', [0, 0.1, 0]],
  ['Chest', 'Spine', [0, 0.2, 0]],
  ['Head', 'Chest', [0, 0.38, 0]],
  ['LeftShoulder', 'Chest', [0.08, 0.3, 0]],
  ['LeftUpperArm', 'LeftShoulder', [0.14, 0, 0]],
  ['LeftLowerArm', 'LeftUpperArm', [0, -0.29, 0]],
  ['LeftHand', 'LeftLowerArm', [0, -0.27, 0]],
  ['RightShoulder', 'Chest', [-0.08, 0.3, 0]],
  ['RightUpperArm', 'RightShoulder', [-0.14, 0, 0]],
  ['RightLowerArm', 'RightUpperArm', [0, -0.29, 0]],
  ['RightHand', 'RightLowerArm', [0, -0.27, 0]],
  ['LeftUpperLeg', 'Hips', [0.1, -0.04, 0]],
  ['LeftLowerLeg', 'LeftUpperLeg', [0, -0.46, 0]],
  ['LeftFoot', 'LeftLowerLeg', [0, -0.43, 0]],
  ['RightUpperLeg', 'Hips', [-0.1, -0.04, 0]],
  ['RightLowerLeg', 'RightUpperLeg', [0, -0.46, 0]],
  ['RightFoot', 'RightLowerLeg', [0, -0.43, 0]],
];

export interface MainCharacterRig {
  /** Add this to the scene; move/rotate it for world placement. */
  group: THREE.Group;
  bones: Record<BoneName, THREE.Object3D>;
  skeleton: THREE.Skeleton | null;
  /** Right hand, melee weapon / staff attachment (`hand_r_socket`). */
  weaponSocket: THREE.Object3D;
  /** Left hand, projectile / arcane origin. */
  spellOrigin: THREE.Object3D;
  /** Child of the weapon socket; swept against targets while the hitbox is active. */
  hitboxAnchor: THREE.Object3D;
  /** Animation clips baked into an imported asset (empty for procedural). */
  importedClips: THREE.AnimationClip[];
  source: 'procedural' | 'imported';
  /** True when the imported asset already contains its own weapon mesh (main_character.glb does). */
  bakedWeapon?: boolean;
}

function mat(color: number, rough = 0.8, metal = 0.05, emissive = 0x000000, ei = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei });
}

function addMesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, pos: V3, name?: string): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

/** Bones + sockets only (no visuals). */
function buildSkeleton(): { root: THREE.Bone; bones: Record<BoneName, THREE.Bone>; list: THREE.Bone[] } {
  const bones = {} as Record<BoneName, THREE.Bone>;
  const list: THREE.Bone[] = [];
  for (const [name, parent, off] of BONE_DEFS) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(...off);
    bones[name] = b;
    list.push(b);
    if (parent) bones[parent].add(b);
  }
  return { root: bones.Root, bones, list };
}

function attachSockets(bones: Record<BoneName, THREE.Object3D>) {
  const weaponSocket = new THREE.Object3D();
  weaponSocket.name = 'hand_r_socket'; // alias: WeaponSocket
  // Blade/staff axis (+Y in socket space) points along the hand's +Z, i.e. up when the forearm is raised forward.
  weaponSocket.position.set(0, -0.05, 0);
  weaponSocket.rotation.x = Math.PI / 2;
  bones.RightHand.add(weaponSocket);

  const spellOrigin = new THREE.Object3D();
  spellOrigin.name = 'SpellOrigin';
  spellOrigin.position.set(0, -0.14, 0.08);
  bones.LeftHand.add(spellOrigin);

  const hitboxAnchor = new THREE.Object3D();
  hitboxAnchor.name = 'HitboxAnchor';
  hitboxAnchor.position.set(0, 0.55, 0); // mid-blade for the default weapon
  weaponSocket.add(hitboxAnchor);
  return { weaponSocket, spellOrigin, hitboxAnchor };
}

/** Rune-etched hunter's blade with a glowing anti-arcane edge. */
export function createDefaultWeapon(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'HunterBlade';
  addMesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), mat(0x3b2a1e, 0.9), [0, 0.0, 0], 'Grip');
  addMesh(g, new THREE.BoxGeometry(0.22, 0.03, 0.05), mat(0x8a8f98, 0.4, 0.8), [0, 0.11, 0], 'Guard');
  addMesh(g, new THREE.BoxGeometry(0.05, 0.9, 0.012), mat(0xc9d3e0, 0.25, 0.9, 0x6ab7ff, 0.35), [0, 0.58, 0], 'Blade');
  addMesh(g, new THREE.ConeGeometry(0.025, 0.1, 4), mat(0xc9d3e0, 0.25, 0.9), [0, 1.08, 0], 'Tip');
  return g;
}

function buildProceduralVisuals(bones: Record<BoneName, THREE.Object3D>): void {
  const cloth = mat(0x1d1a33, 0.95);
  const clothTrim = mat(0x7a1f2b, 0.85);
  const leather = mat(0x3b2a1e, 0.85);
  const skin = mat(0xd9b08c, 0.7);
  const metal = mat(0x8a8f98, 0.4, 0.8);
  const glow = mat(0x9b6bff, 0.3, 0, 0x9b6bff, 1.6);

  // Torso / pelvis
  addMesh(bones.Hips, new THREE.BoxGeometry(0.34, 0.18, 0.2), leather, [0, 0.0, 0], 'Pelvis');
  addMesh(bones.Spine, new THREE.CylinderGeometry(0.16, 0.14, 0.26, 12), cloth, [0, 0.05, 0], 'Abdomen');
  addMesh(bones.Chest, new THREE.BoxGeometry(0.4, 0.34, 0.22), cloth, [0, 0.12, 0], 'Torso');
  addMesh(bones.Chest, new THREE.BoxGeometry(0.06, 0.5, 0.25), leather, [0.04, 0.12, 0], 'Bandolier').rotation.z = -0.7;
  addMesh(bones.Spine, new THREE.BoxGeometry(0.38, 0.05, 0.24), leather, [0, -0.03, 0], 'Belt');
  for (let i = 0; i < 3; i++) {
    addMesh(bones.Spine, new THREE.CylinderGeometry(0.018, 0.018, 0.07, 8), glow, [-0.1 + i * 0.05, -0.1, 0.13], `Vial${i}`);
  }

  // Head, hunter hat, scarf
  addMesh(bones.Head, new THREE.SphereGeometry(0.11, 16, 12), skin, [0, 0.13, 0], 'HeadMesh');
  addMesh(bones.Head, new THREE.CylinderGeometry(0.3, 0.3, 0.015, 20), leather, [0, 0.2, 0], 'HatBrim');
  addMesh(bones.Head, new THREE.CylinderGeometry(0.1, 0.14, 0.22, 16), leather, [0, 0.3, 0], 'HatCrown');
  addMesh(bones.Head, new THREE.CylinderGeometry(0.145, 0.145, 0.04, 16), clothTrim, [0, 0.24, 0], 'HatBand');
  addMesh(bones.Head, new THREE.CylinderGeometry(0.075, 0.09, 0.1, 12), clothTrim, [0, 0.02, 0], 'Scarf');

  // Cloak: open back-half cylinder hanging from the chest
  const cloak = addMesh(
    bones.Chest,
    new THREE.CylinderGeometry(0.23, 0.46, 1.0, 20, 1, true, Math.PI / 2, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x24203f, roughness: 0.95, side: THREE.DoubleSide }),
    [0, -0.32, -0.04],
    'Cloak',
  );
  cloak.castShadow = true;
  addMesh(bones.Chest, new THREE.CylinderGeometry(0.26, 0.26, 0.08, 16, 1, true, Math.PI / 2, Math.PI), clothTrim, [0, 0.22, -0.03], 'CloakCollar');

  // Shoulders
  for (const side of ['Left', 'Right'] as const) {
    const sh = bones[`${side}Shoulder` as BoneName];
    addMesh(sh, new THREE.SphereGeometry(0.1, 12, 10), side === 'Left' ? metal : cloth, [0, 0, 0], `${side}Pauldron`);
  }

  // Limbs
  const arm = (b: BoneName, len: number, r: number, m: THREE.Material) =>
    addMesh(bones[b], new THREE.CapsuleGeometry(r, len - r * 2, 4, 8), m, [0, -len / 2, 0], `${b}Mesh`);
  const leg = arm;
  for (const side of ['Left', 'Right'] as const) {
    arm(`${side}UpperArm` as BoneName, 0.29, 0.055, cloth);
    arm(`${side}LowerArm` as BoneName, 0.27, 0.05, leather);
    addMesh(bones[`${side}Hand` as BoneName], new THREE.SphereGeometry(0.05, 10, 8), skin, [0, -0.04, 0], `${side}HandMesh`);
    leg(`${side}UpperLeg` as BoneName, 0.46, 0.075, cloth);
    leg(`${side}LowerLeg` as BoneName, 0.43, 0.06, leather);
    addMesh(bones[`${side}Foot` as BoneName], new THREE.BoxGeometry(0.11, 0.07, 0.26), leather, [0, -0.0, 0.07], `${side}Boot`);
  }
  // Arcane gauntlet ring on the left hand marks SpellOrigin
  addMesh(bones.LeftHand, new THREE.TorusGeometry(0.06, 0.01, 8, 16), glow, [0, -0.08, 0.04], 'SpellRing').rotation.x = Math.PI / 2;
}

/** Build a fully rigged procedural wizard-hunter. No external assets needed. */
export function buildProceduralMainCharacter(withWeapon = true): MainCharacterRig {
  const { root, bones, list } = buildSkeleton();
  const group = new THREE.Group();
  group.name = 'MainCharacter';
  group.add(root);
  buildProceduralVisuals(bones);
  const sockets = attachSockets(bones);
  if (withWeapon) sockets.weaponSocket.add(createDefaultWeapon());
  group.updateMatrixWorld(true);
  return {
    group,
    bones,
    skeleton: new THREE.Skeleton(list),
    ...sockets,
    importedClips: [],
    source: 'procedural',
  };
}

// ---------------------------------------------------------------------------
// Imported asset binding (main_character.glb / .fbx)
// ---------------------------------------------------------------------------

const norm = (s: string) => s.toLowerCase().replace(/^mixamorig:?/, '').replace(/[^a-z0-9]/g, '');

/** Normalised alias -> canonical bone. Covers canonical names and Mixamo rigs. */
const ALIASES: Record<string, BoneName> = (() => {
  const a: Record<string, BoneName> = {};
  for (const n of BONE_NAMES) a[norm(n)] = n;
  const mixamo: Record<string, BoneName> = {
    spine1: 'Spine', spine2: 'Chest', upperchest: 'Chest',
    leftarm: 'LeftUpperArm', leftforearm: 'LeftLowerArm',
    rightarm: 'RightUpperArm', rightforearm: 'RightLowerArm',
    leftupleg: 'LeftUpperLeg', leftleg: 'LeftLowerLeg',
    rightupleg: 'RightUpperLeg', rightleg: 'RightLowerLeg',
    armature: 'Root',
    handr: 'RightHand', handl: 'LeftHand',
    forearmr: 'RightLowerArm', forearml: 'LeftLowerArm',
    upperarmr: 'RightUpperArm', upperarml: 'LeftUpperArm',
    thighr: 'RightUpperLeg', thighl: 'LeftUpperLeg',
    shinr: 'RightLowerLeg', shinl: 'LeftLowerLeg',
    footr: 'RightFoot', footl: 'LeftFoot',
    righthand: 'RightHand', lefthand: 'LeftHand',
    rightlowerarm: 'RightLowerArm', leftlowerarm: 'LeftLowerArm',
    rightupperarm: 'RightUpperArm', leftupperarm: 'LeftUpperArm',
    rightupperleg: 'RightUpperLeg', leftupperleg: 'LeftUpperLeg',
    rightlowerleg: 'RightLowerLeg', leftlowerleg: 'LeftLowerLeg',
    rightfoot: 'RightFoot', leftfoot: 'LeftFoot',
  };
  return Object.assign(a, mixamo);
})();

const REQUIRED: BoneName[] = ['Hips', 'Spine', 'Head', 'LeftHand', 'RightHand', 'LeftFoot', 'RightFoot'];

/**
 * Bind a loaded GLB/FBX scene to the canonical rig: renames bones (and the
 * matching animation track targets), creates missing sockets.
 * Returns `null` and the list of missing bones if the skeleton is unusable.
 */
export function bindImportedRig(
  scene: THREE.Object3D,
  clips: THREE.AnimationClip[],
): { rig: MainCharacterRig } | { missing: BoneName[] } {
  const found = {} as Partial<Record<BoneName, THREE.Object3D>>;
  const renames = new Map<string, BoneName>();
  scene.traverse((o) => {
    const canon = ALIASES[norm(o.name)];
    if (canon && !found[canon] && (o as THREE.Bone).isBone) {
      found[canon] = o;
      renames.set(o.name, canon);
    }
  });
  const missing = REQUIRED.filter((r) => !found[r]);
  if (missing.length) return { missing };

  for (const [orig, canon] of renames) {
    const o = scene.getObjectByName(orig);
    if (o) o.name = canon;
  }
  const group = new THREE.Group();
  group.name = 'MainCharacter';
  group.add(scene);
  const bones = {} as Record<BoneName, THREE.Object3D>;
  for (const n of BONE_NAMES) bones[n] = found[n] ?? (n === 'Root' ? scene : group); // optional bones fall back harmlessly
  let skeleton: THREE.Skeleton | null = null;
  scene.traverse((o) => { if (!skeleton && (o as THREE.SkinnedMesh).isSkinnedMesh) skeleton = (o as THREE.SkinnedMesh).skeleton; });

  const reClips = clips.map((c) => {
    const nc = c.clone();
    for (const t of nc.tracks) {
      const dot = t.name.indexOf('.');
      const canon = renames.get(t.name.slice(0, dot));
      if (canon) t.name = canon + t.name.slice(dot);
    }
    return nc;
  });

  // Reuse sockets if the artist authored them, otherwise create.
  const existing = (n: string) => scene.getObjectByName(n) ?? null;
  const made = attachSockets(bones);
  const weaponSocket = existing('socket_hand_r') ?? existing('hand_r_socket') ?? existing('WeaponSocket') ?? existing('hand_r') ?? made.weaponSocket;
  const spellOrigin = existing('socket_spell_origin') ?? existing('SpellOrigin') ?? made.spellOrigin;
  const authoredAnchor = existing('HitboxAnchor');
  const hitboxAnchor = authoredAnchor ?? made.hitboxAnchor;
  if (weaponSocket !== made.weaponSocket) { made.weaponSocket.removeFromParent(); if (!authoredAnchor) weaponSocket.add(made.hitboxAnchor); }
  if (spellOrigin !== made.spellOrigin) made.spellOrigin.removeFromParent();

  // Ensure socket_back exists for two-handed / stowed gear
  let backSocket = existing('socket_back') ?? existing('BackSocket') ?? existing('back');
  if (!backSocket) {
    backSocket = new THREE.Object3D();
    backSocket.name = 'socket_back';
    backSocket.position.set(0, 0.15, -0.15);
    backSocket.rotation.set(0, Math.PI, 0);
    bones.Chest.add(backSocket);
  }

  // Ensure socket_hand_l exists on left forearm/hand
  let offhandSocket = existing('socket_hand_l') ?? existing('hand_l') ?? existing('LeftLowerArm') ?? existing('forearm_l');
  if (!offhandSocket) {
    offhandSocket = new THREE.Object3D();
    offhandSocket.name = 'socket_hand_l';
    bones.LeftLowerArm.add(offhandSocket);
  }

  return {
    rig: { group, bones, skeleton, weaponSocket, spellOrigin, hitboxAnchor, importedClips: reClips, source: 'imported', bakedWeapon: !!existing('BakedWeaponMesh') },
  };
}
