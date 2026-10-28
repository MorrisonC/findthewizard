import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bindImportedRig, buildProceduralMainCharacter, type MainCharacterRig } from './MainCharacterRig';
import { CombatController, type CombatCallbacks, type CombatTarget } from './CombatController';
import { equipWeapon, equipShield, type WeaponId, type EquippedWeapon, type EquippedShield } from './WeaponArsenal';
import { WeaponTrail } from './WeaponTrail';
import { CombatParticles } from './CombatParticles';

export type OriginHeroId = 'default' | 'alchemist' | 'charlatan' | 'enforcer' | 'antiquarian';

export const ORIGIN_CHARACTER_URLS: Record<OriginHeroId, string[]> = {
  default: ['/assets/models/kaelen.glb', 'assets/models/kaelen.glb', 'assets/models/main_character.glb'],
  alchemist: ['/assets/models/kaelen_alchemist.glb', 'assets/models/kaelen_alchemist.glb', '/assets/models/kaelen.glb'],
  charlatan: ['/assets/models/kaelen_charlatan.glb', 'assets/models/kaelen_charlatan.glb', '/assets/models/kaelen.glb'],
  enforcer: ['/assets/models/kaelen_enforcer.glb', 'assets/models/kaelen_enforcer.glb', '/assets/models/kaelen.glb'],
  antiquarian: ['/assets/models/kaelen_antiquarian.glb', 'assets/models/kaelen_antiquarian.glb', '/assets/models/kaelen.glb'],
};

export const MAIN_CHARACTER_URLS = [
  '/assets/models/kaelen.glb',
  'assets/models/kaelen.glb',
  'assets/models/main_character.glb',
  'assets/models/main_character.fbx',
];

export const CANONICAL_PLAYER_CLIPS = [
  'Idle',
  'Run',
  'Sprint_Stealth',
  'Attack_Combo_1_3',
  'Dodge_Roll',
  'Death',
  'Cast_Illusion',
  'Hit_React',
  'Stagger_Heavy',
  'Interact_Kneel',
  'Interact_Lever',
  'AirDash_Starlight',
  'WallLeap',
  'MirrorPhase_Enter',
  'MirrorPhase_Exit',
  'Parley_Gesture',
] as const;

export interface SpawnOptions {
  scene?: THREE.Object3D;
  position?: THREE.Vector3Like;
  yaw?: number;
  /** Origin archetype for Kaelen Voss ('alchemist' | 'charlatan' | 'enforcer' | 'antiquarian'). */
  originId?: OriginHeroId | string;
  /** Override asset URLs (tried in order). Pass [] to force the procedural rig. */
  urls?: string[];
  callbacks?: CombatCallbacks;
  targetProvider?: () => CombatTarget[];
  /** Attach a modular weapon to socket_hand_r / hand_r_socket (defaults to true). */
  withWeapon?: boolean;
  /** Which weapon to equip initially (defaults to 'hunter_blade'). */
  weaponId?: WeaponId;
  /** Attach the runic ward buckler to socket_hand_l / LeftLowerArm (defaults to true). */
  withShield?: boolean;
  /** Enable dynamic luminous ribbon weapon trail on swings (defaults to true). */
  withTrail?: boolean;
}

export interface SpawnedCharacter {
  rig: MainCharacterRig;
  combat: CombatController;
  source: 'procedural' | 'imported';
  originId: string;
  equippedWeapon?: EquippedWeapon;
  equippedShield?: EquippedShield;
  weaponTrail?: WeaponTrail;
  combatParticles?: CombatParticles;
  equipWeapon: (id: WeaponId) => EquippedWeapon;
  equipShield: (enabled?: boolean) => EquippedShield | null;
}

export function resolveCanonicalSocket(
  root: THREE.Object3D,
  kind: 'hand_r' | 'hand_l' | 'spell_origin' | 'chest' | 'back',
): THREE.Object3D | null {
  const candidatesByKind: Record<typeof kind, string[]> = {
    hand_r: ['socket_hand_r', 'hand_r_socket', 'weaponsocketr', 'hand_r', 'righthand'],
    hand_l: ['socket_hand_l', 'hand_l_socket', 'weaponsocketl', 'leftlowerarm', 'forearm_l', 'hand_l', 'lefthand'],
    spell_origin: ['socket_spell_origin', 'spell_origin', 'socket_hand_l', 'hand_l'],
    chest: ['socket_chest', 'spine_03', 'chest', 'spine'],
    back: ['socket_back', 'backsocket', 'spine_03', 'chest'],
  };
  const needles = candidatesByKind[kind];
  let match: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (match) return;
    const clean = obj.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (needles.some((n) => clean === n || clean.includes(n))) {
      match = obj;
    }
  });
  return match;
}

async function loadScene(url: string): Promise<{ scene: THREE.Object3D; clips: THREE.AnimationClip[] }> {
  if (url.toLowerCase().endsWith('.fbx')) {
    const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
    const obj = await new FBXLoader().loadAsync(url);
    return { scene: obj, clips: obj.animations ?? [] };
  }
  const gltf = await new GLTFLoader().loadAsync(url);
  return { scene: gltf.scene, clips: gltf.animations ?? [] };
}

export function resolveOriginUrls(originId?: string): string[] {
  if (!originId) return MAIN_CHARACTER_URLS;
  const clean = originId.toLowerCase().replace(/^origin_/i, '') as OriginHeroId;
  return ORIGIN_CHARACTER_URLS[clean] ?? MAIN_CHARACTER_URLS;
}

/**
 * Load `kaelen.glb` / `main_character.glb/.fbx` and bind it to the canonical humanoid rig.
 * Falls back to the procedural wizard-hunter if the file is missing or lacks required bones.
 */
export async function loadMainCharacterRig(urls: string[] = MAIN_CHARACTER_URLS, withWeapon = true): Promise<MainCharacterRig> {
  for (const url of urls) {
    try {
      const { scene, clips } = await loadScene(url);
      const bound = bindImportedRig(scene, clips);
      if ('rig' in bound) {
        scene.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        const handR = resolveCanonicalSocket(scene, 'hand_r');
        if (handR && !bound.rig.weaponSocket) {
          (bound.rig as any).weaponSocket = handR;
        }
        if (withWeapon && !bound.rig.bakedWeapon && bound.rig.weaponSocket.children.length <= 1) {
          equipWeapon(bound.rig, 'hunter_blade');
        }
        return bound.rig;
      }
    } catch {
      // try next fallback URL
    }
  }
  return buildProceduralMainCharacter();
}

/**
 * Convenience entry point. Asynchronously spawns the main character, constructs
 * the combat controller + VFX extensions, attaches the weapon/shield, and adds to scene.
 */
export async function spawnMainCharacter(opts: SpawnOptions = {}): Promise<SpawnedCharacter> {
  const originId = opts.originId ?? 'default';
  const urls = opts.urls ?? resolveOriginUrls(originId);
  const withWeapon = opts.withWeapon ?? true;
  const withShield = opts.withShield ?? true;
  const withTrail = opts.withTrail ?? true;
  const weaponId = opts.weaponId ?? 'hunter_blade';

  const rig = await loadMainCharacterRig(urls, false);
  const combat = new CombatController(rig, opts.callbacks);
  if (opts.targetProvider) combat.targetProvider = opts.targetProvider;

  if (opts.position) rig.group.position.copy(opts.position);
  if (opts.yaw !== undefined) rig.group.rotation.y = opts.yaw;

  let equippedWeapon: EquippedWeapon | undefined;
  if (withWeapon) equippedWeapon = equipWeapon(rig, weaponId);

  let equippedShield: EquippedShield | undefined;
  if (withShield) equippedShield = equipShield(rig, true) ?? undefined;

  let weaponTrail: WeaponTrail | undefined;
  if (withTrail && equippedWeapon) {
    weaponTrail = new WeaponTrail(rig.group.parent ?? rig.group, equippedWeapon);
    combat.attachWeaponTrail(weaponTrail);
  }

  const combatParticles = new CombatParticles(rig.group.parent ?? rig.group);
  combat.attachParticles(combatParticles);

  if (equippedWeapon) combat.attachWeapon(equippedWeapon);
  if (equippedShield) combat.attachShield(equippedShield);

  if (opts.scene) opts.scene.add(rig.group);

  const character: SpawnedCharacter = {
    rig,
    combat,
    source: rig.source,
    originId,
    equippedWeapon,
    equippedShield,
    weaponTrail,
    combatParticles,
    equipWeapon: (id: WeaponId) => {
      const w = equipWeapon(rig, id);
      character.equippedWeapon = w;
      combat.attachWeapon(w);
      return w;
    },
    equipShield: (enabled = true) => {
      const s = equipShield(rig, enabled);
      character.equippedShield = s ?? undefined;
      if (s) combat.attachShield(s);
      return s;
    },
  };

  return character;
}
