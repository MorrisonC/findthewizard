import * as THREE from 'three';
import { AssetLoader } from '../core/AssetLoader';
import { ItemPickupFactory } from './ItemPickupFactory';
import encountersData from '../data/encounters.json';

export type EnemyPosition = THREE.Vector3 | { x: number; y?: number; z: number };

export interface EnemyHandle {
  encounterId: string;
  sceneId: string;
  modelId: string;
  group: THREE.Group;
  mesh: THREE.Group;
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: Record<string, THREE.AnimationAction>;
  colliderRadius: number;
  hp: number;
  maxHp: number;
  poise: number;
  maxPoise: number;
  dead: boolean;
  telegraphMesh?: THREE.Mesh;
  update: (dt: number, scene?: THREE.Scene) => void;
  playClip: (name: string, fade?: number) => void;
  takeDamage: (amount: number, poiseDamage?: number, scene?: THREE.Scene) => { staggered: boolean; dead: boolean };
  setTelegraph: (active: boolean, radius?: number, colorHex?: number) => void;
  playDeath: (scene?: THREE.Scene) => void;
}

const ENCOUNTER_MODEL_MAP: Record<string, string> = {
  ENC_GH3_CAPTAIN: 'barbican_captain',
  ENC_CO1_MAJOR_CAPTAIN: 'archer_guard',
  ENC_PB2_DREDGE: 'boss_dredge',
  ENC_CO3_SERAPHINA: 'boss_seraphina',
  ENC_MH1_HAZEL: 'mother_hazel',
  ENC_AG1_YGGDRA: 'boss_yggdra_rigged',
  ENC_VR3_DREAM_DESCENT: 'boss_dream_descent',
  ENC_SAN1_VAELOR: 'vaelor',
  ENC_AR1_BRUTUS: 'boss_brutus',
  ENC_AR2_VESPER: 'boss_vesper',
  ENC_AR3_MALAKOR: 'boss_malakor',
  ENC_LH1_ASTERION: 'boss_asterion',
  ENC_ZOO_BYAKKO: 'boss_byakko',
  ENC_S00_MONK: 'corrupted_monk',
  ENC_OW1_GUARD: 'keep_guard',
  ENC_HM1_WRAITH: 'mirror_wraith',
  ENC_TR2_MIMIC: 'mimic_chest',
};

const ROOT_ENEMY_MODELS = new Set([
  'keep_guard',
  'mirror_wraith',
  'mimic_chest',
  'vaelor',
  'mother_hazel',
  'corrupted_monk',
]);

const AGILE_EVADE_MODELS = new Set([
  'brigand_cutpurse',
  'boss_vesper',
  'dream_stalker',
  'shadow_hound',
]);

const BOSS_LOOT_TABLE: Record<string, string> = {
  barbican_captain: 'ITEM_GATEHOUSE_KEY',
  boss_brutus: 'ITEM_ARENA_TOKEN',
  boss_vesper: 'weapon_shadow_claw',
  boss_malakor: 'weapon_void_edge',
  boss_seraphina: 'weapon_mirror_blade',
  boss_dredge: 'ITEM_PRISON_KEYRING',
  mother_hazel: 'ITEM_HEARTH_EMBER',
  boss_asterion: 'ITEM_SCHOLAR_CIPHER',
  boss_byakko: 'consumable_starlight_tonic',
  boss_yggdra_rigged: 'ITEM_ROOFTOP_WATER_KEY',
  boss_dream_descent: 'ITEM_DREAM_EMBER',
  vaelor: 'weapon_astral_staff',
};

const STANDARD_LOOT_POOL = [
  'consumable_health_elixir',
  'consumable_mana_potion',
  'consumable_starlight_tonic',
];

const CLIP_NAMES = [
  'Idle',
  'Run',
  'Sprint_Stealth',
  'Attack_Combo_1_3',
  'Dodge_Roll',
  'Death',
  'Hit_React',
  'Stagger_Heavy',
] as const;

const RIG_RADIUS: Record<string, number> = {
  boss_dredge: 1.1,
  boss_seraphina: 1.0,
  boss_yggdra_rigged: 1.2,
  boss_dream_descent: 1.1,
  boss_brutus: 1.15,
  boss_vesper: 0.85,
  boss_malakor: 1.05,
  boss_asterion: 1.15,
  boss_byakko: 1.1,
  vaelor: 1.0,
  mother_hazel: 0.8,
  barbican_captain: 0.7,
  archer_guard: 0.6,
};

function toVector3(position: EnemyPosition): THREE.Vector3 {
  if (position instanceof THREE.Vector3) return position.clone();
  return new THREE.Vector3(position.x, position.y ?? 0, position.z);
}

function resolveModelId(encounterId: string): string {
  if (ENCOUNTER_MODEL_MAP[encounterId]) return ENCOUNTER_MODEL_MAP[encounterId];
  return encounterId.replace(/^enemy_/i, '');
}

function colliderRadiusFor(modelId: string): number {
  if (RIG_RADIUS[modelId]) return RIG_RADIUS[modelId];
  if (modelId.startsWith('boss_')) return 1.1;
  if (modelId.includes('hound') || modelId.includes('byakko')) return 0.55;
  if (modelId.includes('chest') || modelId.includes('mimic')) return 0.5;
  if (modelId.includes('wraith') || modelId.includes('poltergeist') || modelId.includes('wisp')) return 0.6;
  if (modelId.includes('gargoyle') || modelId.includes('construct') || modelId.includes('golem')) return 0.75;
  return 0.6;
}

function findClip(clips: THREE.AnimationClip[], target: string): THREE.AnimationClip | undefined {
  const needle = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clips.find((clip) => {
    const hay = clip.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return hay.includes(needle) || needle.includes(hay);
  });
}

function modelUrls(modelId: string): string[] {
  const urls: string[] = [];
  if (ROOT_ENEMY_MODELS.has(modelId)) {
    urls.push(`/assets/models/${modelId}.glb`, `assets/models/${modelId}.glb`);
  }
  urls.push(
    `/assets/models/enemies/${modelId}.glb`,
    `assets/models/enemies/${modelId}.glb`,
    `/assets/models/${modelId}.glb`,
    `assets/models/${modelId}.glb`,
  );
  return Array.from(new Set(urls));
}

async function loadModel(modelId: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  let lastError: unknown;
  for (const url of modelUrls(modelId)) {
    try {
      const loaded = await AssetLoader.load(url);
      return { scene: loaded.scene, animations: loaded.animations };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error(`Unable to load model for ${modelId}`);
}

function spawnLoot(scene: THREE.Scene | null, position: THREE.Vector3, modelId: string): void {
  if (!scene) return;
  const geom = new THREE.SphereGeometry(0.25, 12, 12);
  const mat = new THREE.MeshStandardMaterial({ color: 0xfbf24, emissive: 0xf59e0b, emissiveIntensity: 0.8 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(position);
  mesh.position.y += 0.6;
  mesh.userData.loot = true;
  const dropItemId =
    BOSS_LOOT_TABLE[modelId] ??
    STANDARD_LOOT_POOL[Math.abs(modelId.length) % STANDARD_LOOT_POOL.length];
  mesh.userData.itemId = dropItemId;
  scene.add(mesh);

  // Also asynchronously spawn the 3D GLB item pickup if available
  void ItemPickupFactory.spawn(dropItemId, { x: position.x, y: position.y + 0.15, z: position.z }, scene).catch(() => {
    // Keep glowing loot orb fallback if GLB load fails in headless unit test
  });
}

export class EnemyFactory {
  static async spawn(
    encounterId: string,
    sceneId: string,
    position: EnemyPosition,
    scene?: THREE.Scene,
  ): Promise<EnemyHandle> {
    const modelId = resolveModelId(encounterId);
    const loaded = await loadModel(modelId);
    const group = loaded.scene;
    const pos = toVector3(position);
    group.position.copy(pos);

    const mixer = new THREE.AnimationMixer(group);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const clip of loaded.animations) {
      actions[clip.name] = mixer.clipAction(clip);
    }
    for (const name of CLIP_NAMES) {
      const clip = findClip(loaded.animations, name);
      if (clip && !actions[name]) {
        actions[name] = mixer.clipAction(clip);
      }
    }

    let currentAction: THREE.AnimationAction | null = actions.Idle ?? null;
    if (currentAction) {
      currentAction.play();
    }

    const colliderRadius = colliderRadiusFor(modelId);
    const capsule = new THREE.Group();
    capsule.name = 'collider_capsule';
    capsule.userData.colliderRadius = colliderRadius;
    capsule.userData.colliderHeight = colliderRadius * 2.4;
    group.add(capsule);

    // Ground telegraph decal ring for wind-up attacks & boss AoEs
    const telegraphGeom = new THREE.RingGeometry(colliderRadius * 0.6, colliderRadius * 2.1, 32);
    const telegraphMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    const telegraphMesh = new THREE.Mesh(telegraphGeom, telegraphMat);
    telegraphMesh.rotation.x = -Math.PI / 2;
    telegraphMesh.position.set(0, 0.04, 0);
    telegraphMesh.visible = false;
    telegraphMesh.name = 'enemy_telegraph_decal';
    group.add(telegraphMesh);

    const isBoss = modelId.startsWith('boss_') || modelId === 'vaelor' || modelId === 'mother_hazel';
    const maxHp = isBoss ? 220 : 65;
    const maxPoise = isBoss ? 100 : 35;

    const handle: EnemyHandle = {
      encounterId,
      sceneId,
      modelId,
      group,
      mesh: group,
      root: group,
      mixer,
      actions,
      colliderRadius,
      hp: maxHp,
      maxHp,
      poise: maxPoise,
      maxPoise,
      dead: false,
      telegraphMesh,
      update: (dt: number, _nextScene?: THREE.Scene) => {
        if (handle.dead) return;
        mixer?.update(dt);
        if (telegraphMesh.visible) {
          const pulse = 0.45 + 0.35 * Math.sin((typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.012);
          (telegraphMesh.material as THREE.MeshBasicMaterial).opacity = pulse;
        }
      },
      playClip: (name: string, fade = 0.15) => {
        const next = actions[name] ?? actions[Object.keys(actions).find((k) => k.toLowerCase() === name.toLowerCase()) ?? ''];
        if (!next) return;
        if (currentAction && currentAction !== next) {
          currentAction.fadeOut(fade);
        }
        next.reset().fadeIn(fade).play();
        currentAction = next;
      },
      takeDamage: (amount: number, poiseDamage = 18, activeScene?: THREE.Scene) => {
        if (handle.dead) return { staggered: false, dead: true };
        handle.hp = Math.max(0, handle.hp - amount);
        handle.poise = Math.max(0, handle.poise - poiseDamage);
        handle.setTelegraph(false);

        if (handle.hp <= 0) {
          handle.playDeath(activeScene ?? scene);
          return { staggered: false, dead: true };
        }

        if (handle.poise <= 0) {
          handle.poise = handle.maxPoise;
          handle.playClip(actions.Stagger_Heavy ? 'Stagger_Heavy' : 'Hit_React', 0.1);
          return { staggered: true, dead: false };
        }

        if (AGILE_EVADE_MODELS.has(modelId) && actions.Dodge_Roll && Math.random() < 0.35) {
          handle.playClip('Dodge_Roll', 0.12);
        } else if (actions.Hit_React) {
          handle.playClip('Hit_React', 0.1);
        }
        return { staggered: false, dead: false };
      },
      setTelegraph: (active: boolean, radius?: number, colorHex = 0xef4444) => {
        telegraphMesh.visible = active;
        const mat = telegraphMesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(colorHex);
        mat.opacity = active ? 0.65 : 0.0;
        if (radius && radius > 0) {
          const scale = radius / (colliderRadius * 2.1);
          telegraphMesh.scale.set(scale, scale, 1);
        }
      },
      playDeath: (activeScene?: THREE.Scene) => {
        handle.dead = true;
        handle.setTelegraph(false);
        if (actions.Death) {
          actions.Death.setLoop(THREE.LoopOnce, 1);
          actions.Death.clampWhenFinished = true;
          handle.playClip('Death', 0.12);
        }
        spawnLoot(activeScene ?? scene ?? null, group.position, modelId);
      },
    };

    group.userData.encounterId = encounterId;
    group.userData.sceneId = sceneId;
    group.userData.modelId = modelId;
    group.userData.colliderRadius = colliderRadius;
    group.userData.enemyHandle = handle;

    if (scene) scene.add(group);
    void encountersData;
    return handle;
  }
}

export default EnemyFactory;
