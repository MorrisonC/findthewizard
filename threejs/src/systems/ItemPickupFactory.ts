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
  elapsed: number;
  update: (dt: number) => void;
}

const ITEM_EXPLICIT_MAP: Record<string, string> = {
  weapon_whisper: '/assets/models/items/weapon_whisper.glb',
  weapon_mirror_blade: '/assets/models/items/weapon_mirror_blade.glb',
  weapon_shadow_claw: '/assets/models/items/weapon_shadow_claw.glb',
  weapon_void_edge: '/assets/models/items/weapon_void_edge.glb',
  weapon_astral_staff: '/assets/models/items/weapon_astral_staff.glb',
  weapon_sunfire_bow: '/assets/models/items/weapon_sunfire_bow.glb',
  armor_arch_robes: '/assets/models/items/armor_arch_robes.glb',
  armor_shadow_mail: '/assets/models/items/armor_shadow_mail.glb',
  armor_astral_cuirass: '/assets/models/items/armor_astral_cuirass.glb',
  consumable_health_elixir: '/assets/models/items/consumable_health_elixir.glb',
  consumable_mana_potion: '/assets/models/items/consumable_mana_potion.glb',
  consumable_starlight_tonic: '/assets/models/items/consumable_starlight_tonic.glb',
  consumable_smoke_vial: '/assets/models/items/consumable_smoke_vial.glb',
  consumable_antidote_draught: '/assets/models/items/consumable_antidote_draught.glb',
  ITEM_GATEHOUSE_KEY: '/assets/models/items/ITEM_GATEHOUSE_KEY.glb',
  ITEM_BARC_SHIELD: '/assets/models/items/ITEM_BARC_SHIELD.glb',
  ITEM_SUNDIAL_GNOMON: '/assets/models/items/ITEM_SUNDIAL_GNOMON.glb',
  ITEM_ARENA_TOKEN: '/assets/models/items/ITEM_ARENA_TOKEN.glb',
  ITEM_PRISON_KEYRING: '/assets/models/items/ITEM_PRISON_KEYRING.glb',
  ITEM_HEARTH_EMBER: '/assets/models/items/ITEM_HEARTH_EMBER.glb',
  ITEM_CLOCKWORK_GEAR: '/assets/models/items/ITEM_CLOCKWORK_GEAR.glb',
  ITEM_SCHOLAR_CIPHER: '/assets/models/items/ITEM_SCHOLAR_CIPHER.glb',
  ITEM_TRUTH_LENS: '/assets/models/items/ITEM_TRUTH_LENS.glb',
  ITEM_ECHO_BELL: '/assets/models/items/ITEM_ECHO_BELL.glb',
  ITEM_IRON_NAIL: '/assets/models/items/ITEM_IRON_NAIL.glb',
  ITEM_UNDERCITY_VALVE_HANDLE: '/assets/models/items/ITEM_UNDERCITY_VALVE_HANDLE.glb',
  ITEM_ROOFTOP_WATER_KEY: '/assets/models/items/ITEM_ROOFTOP_WATER_KEY.glb',
  ITEM_RITUAL_ORB: '/assets/models/items/ITEM_RITUAL_ORB.glb',
  ITEM_DREAM_EMBER: '/assets/models/items/ITEM_DREAM_EMBER.glb',
  ITEM_HEART_OF_MIRRORS: '/assets/models/items/ITEM_HEART_OF_MIRRORS.glb',
  ITEM_MEMORY_SHARD_1: '/assets/models/items/ITEM_MEMORY_SHARD_1.glb',
  ITEM_MEMORY_SHARD_2: '/assets/models/items/ITEM_MEMORY_SHARD_2.glb',
  ITEM_MEMORY_SHARD_3: '/assets/models/items/ITEM_MEMORY_SHARD_3.glb',
  ITEM_MEMORY_SHARD_4: '/assets/models/items/ITEM_MEMORY_SHARD_4.glb',
  ITEM_MEMORY_SHARD_5: '/assets/models/items/ITEM_MEMORY_SHARD_5.glb',
  ITEM_MEMORY_SHARD_6: '/assets/models/items/ITEM_MEMORY_SHARD_6.glb',
  ITEM_MEMORY_SHARD_7: '/assets/models/items/ITEM_MEMORY_SHARD_7.glb',
  ITEM_GUILD_CONTRACT: '/assets/models/items/ITEM_GUILD_CONTRACT.glb',
  ITEM_VAELOR_SIGNET: '/assets/models/items/ITEM_VAELOR_SIGNET.glb',
};

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

  if (ITEM_EXPLICIT_MAP[id]) add(ITEM_EXPLICIT_MAP[id]);
  if (ITEM_EXPLICIT_MAP[upper]) add(ITEM_EXPLICIT_MAP[upper]);
  if (ITEM_EXPLICIT_MAP[lower]) add(ITEM_EXPLICIT_MAP[lower]);

  add(`/assets/models/items/${id}.glb`);
  add(`/assets/models/items/${upper}.glb`);
  add(`/assets/models/items/${lower}.glb`);
  if (!/^ITEM_/i.test(id)) {
    add(`/assets/models/items/ITEM_${upper}.glb`);
    add(`/assets/models/items/ITEM_${lower}.glb`);
  }
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
      return { scene: loaded.scene, path: url.startsWith('/') ? url : `/${url}` };
    } catch (err) {
      lastError = err;
    }
  }
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.35, 0.35),
    new THREE.MeshStandardMaterial({ color: 0xc9a227, emissive: 0xc9a227, emissiveIntensity: 0.4 }),
  );
  const group = new THREE.Group();
  group.add(box);
  void lastError;
  return { scene: group, path: ITEM_EXPLICIT_MAP[itemId] ?? `/assets/models/items/${itemId}.glb` };
}

export class ItemPickupFactory {
  static async spawn(itemId: string, position: ItemPosition, scene?: THREE.Scene): Promise<ItemPickupHandle> {
    const loaded = await loadModel(itemId);
    const pos = toVector3(position);
    const group = new THREE.Group();
    group.position.copy(pos);

    const isShard = itemId.toUpperCase().includes('SHARD') || itemId.toUpperCase().includes('HEART');
    const lightColor = isShard ? 0x38bdf8 : 0xfacc15;
    const light = new THREE.PointLight(lightColor, 1.8, 4);
    light.position.set(0, 0.5, 0);
    group.add(light);
    group.add(loaded.scene);

    const handle: ItemPickupHandle = {
      itemId,
      group,
      model: loaded.scene,
      modelPath: loaded.path,
      light,
      interactionRadius: 1.2,
      baseY: pos.y,
      bobAmplitude: 0.12,
      bobSpeed: 2.5,
      rotationSpeed: 1.2,
      elapsed: 0,
      update: (dt: number) => {
        handle.elapsed += dt;
        group.rotation.y += handle.rotationSpeed * dt;
        group.position.y = handle.baseY + Math.sin(handle.elapsed * handle.bobSpeed) * handle.bobAmplitude;
      },
    };

    group.userData.itemId = itemId;
    group.userData.pickupHandle = handle;
    group.userData.update = handle.update;
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
    if (handleOrGroup && typeof handleOrGroup.update === 'function' && !(handleOrGroup instanceof THREE.Group)) {
      handleOrGroup.update(dt);
      return;
    }
    const group: THREE.Group | null =
      handleOrGroup instanceof THREE.Group
        ? handleOrGroup
        : handleOrGroup?.group instanceof THREE.Group
        ? handleOrGroup.group
        : null;
    if (!group) return;
    const fn = group.userData?.update;
    if (typeof fn === 'function') fn(dt);
    else group.rotation.y += 1.2 * dt;
  }
}
