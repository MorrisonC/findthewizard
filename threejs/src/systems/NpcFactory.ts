import * as THREE from 'three';
import { AssetLoader } from '../core/AssetLoader';

export type NpcPosition = THREE.Vector3 | { x: number; y?: number; z: number };

export interface PlayerStatBlock {
  STR?: number;
  AGI?: number;
  VIT?: number;
  INT?: number;
  CHA?: number;
  LCK?: number;
  originId?: string;
}

export interface DialogueStatCheck {
  stat?: 'STR' | 'AGI' | 'VIT' | 'INT' | 'CHA' | 'LCK';
  dc?: number;
  requiredOrigin?: string;
}

export interface NpcHandle {
  npcId: string;
  modelId: string;
  group: THREE.Group;
  mesh: THREE.Group;
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: Record<string, THREE.AnimationAction>;
  headBone: THREE.Bone | null;
  spineBone: THREE.Bone | null;
  update: (playerPosition: NpcPosition, dt: number) => void;
}

const NPC_MODEL_MAP: Record<string, string> = {
  sable: 'starlight_raven',
  orin: 'gatekeeper_orin',
  gatekeeper_orin: 'gatekeeper_orin',
  bartholomew: 'npc_steward_sterling',
  sterling: 'npc_steward_sterling',
  eldrin: 'npc_eldrin_starcarver',
  maren: 'npc_librarian_maren',
  eleanor: 'npc_lady_eleanor',
  aurelius: 'npc_statue_aurelius',
  asterion: 'boss_asterion',
  vaelor: 'vaelor',
  cynthia: 'npc_lady_cynthia',
  morvath: 'npc_portrait_morvath',
  yggdra: 'boss_yggdra_rigged',
  hazel: 'mother_hazel',
  mother_hazel: 'mother_hazel',
  kord: 'npc_blacksmith_kord',
  venn: 'npc_alchemist_venn',
  hal: 'npc_quartermaster_hal',
  griggs: 'npc_jailer_griggs',
  lyra: 'npc_astronomer_lyra',
  moss: 'npc_gardener_moss',
  tol: 'npc_bellringer_tol',
  duval: 'npc_sommelier_duval',
  charon: 'npc_ferryman_charon',
};

const ORIGIN_BONUS_STAT: Record<string, keyof PlayerStatBlock> = {
  alchemist: 'INT',
  charlatan: 'CHA',
  enforcer: 'STR',
  antiquarian: 'LCK',
};

function toVector3(position: NpcPosition): THREE.Vector3 {
  if (position instanceof THREE.Vector3) return position.clone();
  return new THREE.Vector3(position.x, position.y ?? 0, position.z);
}

function resolveModelId(npcId: string): string {
  const clean = String(npcId ?? '').trim().toLowerCase();
  return NPC_MODEL_MAP[clean] ?? NPC_MODEL_MAP[npcId] ?? npcId;
}

function modelUrls(modelId: string): string[] {
  return [
    `/assets/models/npcs/${modelId}.glb`,
    `/assets/models/${modelId}.glb`,
    `/assets/models/enemies/${modelId}.glb`,
    `assets/models/npcs/${modelId}.glb`,
    `assets/models/${modelId}.glb`,
    `assets/models/enemies/${modelId}.glb`,
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

function findClip(clips: THREE.AnimationClip[], target: string): THREE.AnimationClip | undefined {
  const needle = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clips.find((clip) => {
    const hay = clip.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return hay.includes(needle) || needle.includes(hay);
  });
}

function findBone(root: THREE.Object3D, names: string[]): THREE.Bone | null {
  const targets = names.map((n) => n.toLowerCase().replace(/[^a-z0-9]/g, ''));
  let found: THREE.Bone | null = null;
  root.traverse((node) => {
    if (found) return;
    if ((node as THREE.Bone).isBone || node.type === 'Bone') {
      const clean = node.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (targets.some((t) => clean === t || clean.includes(t))) {
        found = node as THREE.Bone;
      }
    }
  });
  return found;
}

export class NpcFactory {
  static async spawn(npcId: string, position: NpcPosition, scene?: THREE.Scene): Promise<NpcHandle> {
    const modelId = resolveModelId(npcId);
    const loaded = await loadModel(modelId);
    const group = loaded.scene;
    const pos = toVector3(position);
    group.position.copy(pos);

    const mixer = new THREE.AnimationMixer(group);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const clip of loaded.animations) {
      actions[clip.name] = mixer.clipAction(clip);
    }
    const idleClip = findClip(loaded.animations, 'Idle');
    if (idleClip && !actions.Idle) actions.Idle = mixer.clipAction(idleClip);
    const parleyClip = findClip(loaded.animations, 'Parley_Gesture');
    if (parleyClip && !actions.Parley_Gesture) actions.Parley_Gesture = mixer.clipAction(parleyClip);

    const headBone = findBone(group, ['head', 'neck']);
    const spineBone = findBone(group, ['spine_03', 'spine03', 'spine 03', 'chest', 'spine']);

    const handle: NpcHandle = {
      npcId,
      modelId,
      group,
      mesh: group,
      root: group,
      mixer,
      actions,
      headBone,
      spineBone,
      update: (playerPosition: NpcPosition, dt: number) => {
        NpcFactory.update(handle, playerPosition, dt);
      },
    };

    if (actions.Idle) {
      actions.Idle.play();
    }

    group.userData.npcId = npcId;
    group.userData.modelId = modelId;
    group.userData.npcHandle = handle;
    group.userData.interactionRadius = 2.2;

    if (scene) scene.add(group);

    return handle;
  }

  static update(npc: NpcHandle, playerPosition: NpcPosition, dt: number): void {
    if (npc.mixer) npc.mixer.update(dt);

    const playerPos = toVector3(playerPosition);
    const npcPos = new THREE.Vector3();
    npc.group.getWorldPosition(npcPos);
    const distance = npcPos.distanceTo(playerPos);
    if (distance > 2.2) return;

    const bones = [npc.headBone, npc.spineBone].filter(Boolean) as THREE.Bone[];
    for (const bone of bones) {
      const parent = bone.parent;
      if (!parent) continue;
      const localTarget = parent.worldToLocal(playerPos.clone());
      const dir = localTarget.sub(bone.position).normalize();
      const yaw = Math.atan2(dir.x, dir.z);
      bone.rotation.y = yaw;
    }
  }

  static onDialogueOpen(npc: NpcHandle): void {
    const parley = npc.actions.Parley_Gesture ?? findAction(npc.actions, 'Parley_Gesture');
    if (!parley || !npc.mixer) return;
    Object.values(npc.actions).forEach((a) => {
      if (a !== parley && a.isRunning()) a.fadeOut(0.15);
    });
    parley.reset().fadeIn(0.15).play();
    const idle = npc.actions.Idle;
    if (idle) {
      const duration = parley.getClip().duration;
      setTimeout(() => {
        parley.fadeOut(0.2);
        idle.reset().fadeIn(0.2).play();
      }, Math.max(0, duration * 1000));
    }
  }

  static evaluateDialogueCheck(check: DialogueStatCheck, stats: PlayerStatBlock = {}): boolean {
    if (check.requiredOrigin) {
      const cleanOrigin = (stats.originId ?? '').toLowerCase().replace(/^origin_/i, '');
      if (cleanOrigin === check.requiredOrigin.toLowerCase().replace(/^origin_/i, '')) {
        return true;
      }
    }
    if (!check.stat) return true;
    const baseVal = Number(stats[check.stat] ?? 10);
    const originClean = (stats.originId ?? '').toLowerCase().replace(/^origin_/i, '');
    const bonus = ORIGIN_BONUS_STAT[originClean] === check.stat ? 2 : 0;
    return baseVal + bonus >= (check.dc ?? 10);
  }
}

function findAction(actions: Record<string, THREE.AnimationAction>, target: string): THREE.AnimationAction | undefined {
  const needle = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = Object.keys(actions).find((k) => {
    const hay = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return hay.includes(needle) || needle.includes(hay);
  });
  return key ? actions[key] : undefined;
}

export default NpcFactory;
