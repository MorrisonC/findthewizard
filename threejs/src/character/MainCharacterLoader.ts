import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bindImportedRig, buildProceduralMainCharacter, type MainCharacterRig } from './MainCharacterRig';
import { CombatController, type CombatCallbacks, type CombatTarget } from './CombatController';
import { equipWeapon, equipShield, type WeaponId, type EquippedWeapon, type EquippedShield } from './WeaponArsenal';
import { WeaponTrail } from './WeaponTrail';
import { CombatParticles } from './CombatParticles';

export const MAIN_CHARACTER_URLS = ['/assets/models/main_character.glb', '/assets/models/main_character.fbx'];

export interface SpawnOptions {
  scene?: THREE.Object3D;
  position?: THREE.Vector3Like;
  yaw?: number;
  /** Override asset URLs (tried in order). Pass [] to force the procedural rig. */
  urls?: string[];
  callbacks?: CombatCallbacks;
  targetProvider?: () => CombatTarget[];
  /** Attach a modular weapon to hand_r_socket (defaults to true). */
  withWeapon?: boolean;
  /** Which weapon to equip initially (defaults to 'hunter_blade'). */
  weaponId?: WeaponId;
  /** Attach the runic ward buckler to LeftLowerArm (defaults to true). */
  withShield?: boolean;
  /** Enable dynamic luminous ribbon weapon trail on swings (defaults to true). */
  withTrail?: boolean;
}

export interface SpawnedCharacter {
  rig: MainCharacterRig;
  combat: CombatController;
  source: 'procedural' | 'imported';
  equippedWeapon?: EquippedWeapon;
  equippedShield?: EquippedShield;
  weaponTrail?: WeaponTrail;
  combatParticles?: CombatParticles;
  equipWeapon: (id: WeaponId) => EquippedWeapon;
  equipShield: (enabled?: boolean) => EquippedShield | null;
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

/**
 * Load `main_character.glb/.fbx` and bind it to the canonical humanoid rig.
 * Falls back to the procedural wizard-hunter if the file is missing or lacks required bones.
 */
export async function loadMainCharacterRig(urls: string[] = MAIN_CHARACTER_URLS, withWeapon = true): Promise<MainCharacterRig> {
  for (const url of urls) {
    try {
      const { scene, clips } = await loadScene(url);
      const bound = bindImportedRig(scene, clips);
      if ('rig' in bound) {
        scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        if (withWeapon && !bound.rig.bakedWeapon && bound.rig.weaponSocket.children.length <= 1) {
          equipWeapon(bound.rig, 'hunter_blade');
        }
        return bound.rig;
      }
      console.warn(`[MainCharacter] ${url} is missing bones: ${bound.missing.join(', ')} - skipping`);
    } catch (err) {
      console.info(`[MainCharacter] ${url} unavailable (${(err as Error).message}); trying next`);
    }
  }
  return buildProceduralMainCharacter(withWeapon);
}

/** Load (or build) the protagonist, place it in the scene, equip weapon/shield, and attach CombatController + WeaponTrail. */
export async function spawnMainCharacter(opts: SpawnOptions = {}): Promise<SpawnedCharacter> {
  const rig = await loadMainCharacterRig(opts.urls ?? MAIN_CHARACTER_URLS, false);
  if (opts.position) rig.group.position.set(opts.position.x, opts.position.y, opts.position.z);
  rig.group.rotation.y = opts.yaw ?? 0;
  opts.scene?.add(rig.group);

  const combat = new CombatController(rig, opts.callbacks);
  if (opts.targetProvider) combat.targetProvider = opts.targetProvider;

  let currentWeapon: EquippedWeapon | undefined;
  let currentShield: EquippedShield | undefined;
  let trail: WeaponTrail | undefined;

  const doEquipWeapon = (id: WeaponId): EquippedWeapon => {
    currentWeapon = equipWeapon(rig, id);
    combat.attachWeapon(currentWeapon);
    return currentWeapon;
  };

  const doEquipShield = (enabled = true): EquippedShield | null => {
    if (!enabled) {
      const existing = rig.bones.LeftLowerArm.getObjectByName('HarmonicAegis');
      if (existing) existing.removeFromParent();
      currentShield = undefined;
      return null;
    }
    currentShield = equipShield(rig);
    combat.attachShield(currentShield);
    return currentShield;
  };

  // Initial equipment setup
  if (opts.withWeapon !== false) {
    doEquipWeapon(opts.weaponId ?? 'hunter_blade');
  }
  if (opts.withShield !== false) {
    doEquipShield(true);
  }
  let particles: CombatParticles | undefined;
  if (opts.scene && (opts.scene as THREE.Scene).isScene) {
    particles = new CombatParticles(opts.scene as THREE.Scene);
    combat.attachParticles(particles);
  }

  return {
    rig,
    combat,
    source: rig.source,
    get equippedWeapon() { return currentWeapon; },
    get equippedShield() { return currentShield; },
    get weaponTrail() { return trail; },
    get combatParticles() { return particles; },
    equipWeapon: doEquipWeapon,
    equipShield: doEquipShield,
  };
}
