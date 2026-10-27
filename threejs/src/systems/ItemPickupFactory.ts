import * as THREE from 'three';
import { AssetLoader } from '../core/AssetLoader';

export type ItemPosition = THREE.Vector3 | { x: number; y?: number; z: number };

export interface ItemPickupHandle {
  itemId: string;
  group: THREE.Group;
  model: THREE.Group;
  modelPath: string;
  light: THREE.PointLight;
  interactionRadius: number;
  baseY: number;
  bobAmplitude: number;
  bobSpeed: number;
  rotationSpeed: number;
  update: (dt: number) => void;
}

function toVector3(position: ItemPosition): THREE.Vector3 {
  if (position instanceof THREE.Vector3) return position.clone();
  return new THREE.Vector3(position.x, position.y ?? 0, position.z);
}

function normalizeId(id: string): string {
  return String(id ?? '').trim();
}

function candidatePaths(itemId: string): string[] {
  const id = normalizeId(itemId);
  const upper = id.toUpperCase();
  const lower = id.toLowerCase();
  const paths = new Set<string>();
  const add = (p: string) => paths.add(p);

  // Requirement path first.
  add(`/assets/models/items/${id}.glb`);
  add(`/assets/models/items/${upper}.glb`);
  add(`/assets/models/items/${lower}.glb`);
  if (!/^ITEM_/i.test(id)) {
    add(`/assets/models/items/ITEM_${upper}.glb`);
    add(`/assets/models/items/item_${lower}.glb`);
  }
  // Relative variants (matches PuzzleFactory convention).
  const collected = Array.from(paths);
  const variants: string[] = [];
  for (const p of collected) {
    variants.push(p);
    variants.push(p.replace(/^\//, ''));
    variants.push(p.replace('/assets/', 'assets/'));
  }
  return variants;
}

async function loadModel(itemId: string): Promise<{ scene: THREE.Group; path: string }> {
  let lastError: unknown;
  for (const url of candidatePaths(itemId)) {
    try {
      const loaded = await AssetLoader.load(url);
      return { scene: loaded.scene, path: url };
    } catch (err) {
      lastError = err;
    }
  }
  // Final fallback so spawn never hard-fails.
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.35, 0.35),
    new THREE.MeshStandardMaterial({ color: 0xc9a227, emissive: 0xc9a227, emissiveIntensity: 0.4 }),
  );
  const group = new THREE.Group();
  group.add(box);
  void lastError;
  return { scene: group, path: `/assets/models/items/${itemId}.glb` };
}

export class ItemPickupFactory {
  static async spawn(itemId: string, position: ItemPosition, scene?: THREE.Scene): Promise<ItemPickupHandle> {
    const loaded = await loadModel(itemId);
    const pos = toVector3(position);

    const group = new THREE.Group();
    group.add(loaded.scene);
    group.position.copy(pos);

    const bobAmplitude = 0.12;
    const bobSpeed = 1.8;
    const rotationSpeed = 1.0;

    // Starlight halo.
    const light = new THREE.PointLight(0x9ad6ff, 1.6, 6, 2);
    light.position.set(0, 0.35, 0);
    group.add(light);

    const baseY = pos.y;
    let elapsed = 0;

    const handle: ItemPickupHandle = {
      itemId,
      group,
      model: loaded.scene,
      modelPath: loaded.path,
      light,
      interactionRadius: 1.2,
      baseY,
      bobAmplitude,
      bobSpeed,
      rotationSpeed,
      update: (dt: number) => {
        elapsed += Math.max(0, dt || 0);
        group.rotation.y += rotationSpeed * (dt || 0);
        group.position.y = baseY + Math.sin(elapsed * bobSpeed) * bobAmplitude;
      },
    };

    group.userData.itemId = itemId;
    group.userData.modelPath = loaded.path;
    group.userData.interactionRadius = handle.interactionRadius;
    group.userData.colliderRadius = handle.interactionRadius;
    group.userData.colliderType = 'sphere';
    group.userData.baseY = baseY;
    group.userData.bob = true;
    group.userData.bobAmplitude = bobAmplitude;
    group.userData.bobSpeed = bobSpeed;
    group.userData.bobbingSpeed = bobSpeed;
    group.userData.rotationSpeed = rotationSpeed;
    group.userData.rotateSpeed = rotationSpeed;
    group.userData.bobbing = true;
    group.userData.rotating = true;
    group.userData.haloLight = light;
    group.userData.itemPickupHandle = handle;
    group.userData.update = handle.update;

    // Rapier trigger metadata.
    group.userData.rapierCollider = {
      type: 'ball',
      radius: handle.interactionRadius,
      translation: { x: pos.x, y: pos.y + 0.5, z: pos.z },
      sensor: true,
    };

    if (scene) scene.add(group);

    return handle;
  }

  static update(handleOrGroup: ItemPickupHandle | THREE.Group | any, dt: number): void {
    const group: THREE.Group | null =
      handleOrGroup instanceof THREE.Group
        ? handleOrGroup
        : handleOrGroup?.group instanceof THREE.Group
          ? handleOrGroup.group
          : null;
    if (!group) return;
    const fn = group.userData?.update;
    if (typeof fn === 'function') fn(dt);
  }
}

export default ItemPickupFactory;
