import * as THREE from 'three';
import { AssetLoader } from '../core/AssetLoader';
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
  dead: boolean;
  update: (dt: number, scene?: THREE.Scene) => void;
  playClip: (name: string, fade?: number) => void;
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
};

const CLIP_NAMES = ['Idle', 'Run', 'Sprint_Stealth', 'Attack_Combo_1_3', 'Dodge_Roll', 'Death'] as const;

const RIG_RADIUS: Record<string, number> = {
  boss_dredge: 1.1,
  boss_seraphina: 1.0,
  boss_yggdra_rigged: 1.2,
  boss_dream_descent: 1.1,
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
  // Generic enemy ids are treated as model names directly.
  return encounterId;
}

function colliderRadiusFor(modelId: string): number {
  if (RIG_RADIUS[modelId]) return RIG_RADIUS[modelId];
  if (modelId.startsWith('boss_')) return 1.1;
  if (modelId.includes('hound')) return 0.5;
  if (modelId.includes('chest') || modelId.includes('mimic')) return 0.5;
  if (modelId.includes('wraith')) return 0.6;
  if (modelId.includes('gargoyle')) return 0.7;
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
  return [
    `/assets/models/enemies/${modelId}.glb`,
    `/assets/models/${modelId}.glb`,
    `assets/models/enemies/${modelId}.glb`,
    `assets/models/${modelId}.glb`,
  ];
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

function spawnLoot(scene: THREE.Scene | null, position: THREE.Vector3): void {
  if (!scene) return;
  const geom = new THREE.SphereGeometry(0.25, 12, 12);
  const mat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 0.8 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(position);
  mesh.position.y += 0.6;
  mesh.userData.loot = true;
  scene.add(mesh);
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
    for (const name of CLIP_NAMES) {
      const clip = findClip(loaded.animations, name);
      if (clip) {
        actions[name] = mixer.clipAction(clip);
      }
    }

    const colliderRadius = colliderRadiusFor(modelId);
    const capsule = new THREE.Group();
    capsule.name = 'collider_capsule';
    capsule.userData.colliderRadius = colliderRadius;
    capsule.userData.colliderHeight = colliderRadius * 2.4;
    group.add(capsule);

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
      dead: false,
      update: (dt: number, nextScene?: THREE.Scene) => {
        if (handle.dead) return;
        mixer?.update(dt);
        if (nextScene && group.parent !== nextScene) {
          // noop: parent management left to caller
        }
      },
      playClip: (name: string, fade = 0.15) => {
        const next = actions[name];
        if (!next) return;
        Object.values(actions).forEach((a) => {
          if (a !== next && a.isRunning()) a.fadeOut(fade);
        });
        next.reset().fadeIn(fade).play();
      },
      playDeath: (deathScene?: THREE.Scene) => {
        if (handle.dead) return;
        handle.dead = true;
        const deathAction = actions.Death;
        const targetScene = deathScene ?? scene ?? (group.parent as THREE.Scene | null);
        if (deathAction) {
          Object.values(actions).forEach((a) => {
            if (a !== deathAction && a.isRunning()) a.stop();
          });
          deathAction.reset();
          deathAction.setLoop(THREE.LoopOnce, 1);
          deathAction.clampWhenFinished = true;
          const onFinished = (e: { action: THREE.AnimationAction }) => {
            if (e.action !== deathAction) return;
            mixer?.removeEventListener('finished', onFinished);
            spawnLoot(targetScene, group.position);
            if (group.parent) group.parent.remove(group);
          };
          mixer?.addEventListener('finished', onFinished);
          deathAction.play();
        } else {
          spawnLoot(targetScene, group.position);
          if (group.parent) group.parent.remove(group);
        }
      },
    };

    // Default idle
    if (actions.Idle) {
      actions.Idle.play();
    }

    // Wire death finish automatically when Death clip exists.
    const deathAction = actions.Death;
    if (deathAction) {
      const autoDeathHandler = (e: { action: THREE.AnimationAction }) => {
        if (e.action !== deathAction || handle.dead) return;
        // Only auto-loot if explicitly flagged dead via playDeath; otherwise ignore.
      };
      mixer.addEventListener('finished', autoDeathHandler);
      void autoDeathHandler;
    }

    if (scene) {
      scene.add(group);
    }

    // Attach encounter metadata for integration/debugging.
    group.userData.encounterId = encounterId;
    group.userData.sceneId = sceneId;
    group.userData.modelId = modelId;
    group.userData.colliderRadius = colliderRadius;
    group.userData.enemyHandle = handle;

    // Expose encounters list for potential consumers (no-op reference).
    void encountersData;

    return handle;
  }
}

export default EnemyFactory;