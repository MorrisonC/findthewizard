import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bindImportedRig, buildProceduralMainCharacter, createDefaultWeapon, type MainCharacterRig } from './MainCharacterRig';
import { CombatController, type CombatCallbacks, type CombatTarget } from './CombatController';

export const MAIN_CHARACTER_URLS = ['/assets/models/main_character.glb', '/assets/models/main_character.fbx'];

export interface SpawnOptions {
  scene?: THREE.Object3D;
  position?: THREE.Vector3Like;
  yaw?: number;
  /** Override asset URLs (tried in order). Pass [] to force the procedural rig. */
  urls?: string[];
  callbacks?: CombatCallbacks;
  targetProvider?: () => CombatTarget[];
  /** Attach the default hunter blade if the asset has no weapon of its own. */
  withWeapon?: boolean;
}

export interface SpawnedCharacter {
  rig: MainCharacterRig;
  combat: CombatController;
  source: 'procedural' | 'imported';
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
 * Falls back to the procedural wizard-hunter if the file is missing (Vite serves
 * index.html for unknown paths, which fails to parse) or lacks required bones.
 */
export async function loadMainCharacterRig(urls: string[] = MAIN_CHARACTER_URLS, withWeapon = true): Promise<MainCharacterRig> {
  for (const url of urls) {
    try {
      const { scene, clips } = await loadScene(url);
      const bound = bindImportedRig(scene, clips);
      if ('rig' in bound) {
        scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        if (withWeapon && !bound.rig.bakedWeapon && bound.rig.weaponSocket.children.length <= 1) bound.rig.weaponSocket.add(createDefaultWeapon());
        return bound.rig;
      }
      console.warn(`[MainCharacter] ${url} is missing bones: ${bound.missing.join(', ')} - skipping`);
    } catch (err) {
      console.info(`[MainCharacter] ${url} unavailable (${(err as Error).message}); trying next`);
    }
  }
  return buildProceduralMainCharacter(withWeapon);
}

/** Load (or build) the protagonist, place it in the scene and attach a CombatController. */
export async function spawnMainCharacter(opts: SpawnOptions = {}): Promise<SpawnedCharacter> {
  const rig = await loadMainCharacterRig(opts.urls ?? MAIN_CHARACTER_URLS, opts.withWeapon ?? true);
  if (opts.position) rig.group.position.set(opts.position.x, opts.position.y, opts.position.z);
  rig.group.rotation.y = opts.yaw ?? 0;
  opts.scene?.add(rig.group);
  const combat = new CombatController(rig, opts.callbacks);
  if (opts.targetProvider) combat.targetProvider = opts.targetProvider;
  return { rig, combat, source: rig.source };
}
